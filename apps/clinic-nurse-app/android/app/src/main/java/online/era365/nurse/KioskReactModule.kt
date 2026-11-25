package online.era365.nurse

import android.app.ActivityManager
import android.app.admin.DevicePolicyManager
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import expo.modules.kiosk.KioskBootstrap
import java.net.URL

/**
 * Classic RN native module — avoids Expo Modules Kotlin reified/inline DSL
 * (which was throwing throwUndefinedForReified at ReactInstance create).
 */
class KioskReactModule(
  private val ctx: ReactApplicationContext,
) : ReactContextBaseJavaModule(ctx) {

  override fun getName(): String = "Kiosk"

  @ReactMethod(isBlockingSynchronousMethod = true)
  fun isDeviceOwner(): Boolean {
    val policy = ctx.getSystemService(DevicePolicyManager::class.java) ?: return false
    return policy.isDeviceOwnerApp(ctx.packageName)
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  fun isInKioskMode(): Boolean {
    val activity = reactApplicationContext.currentActivity ?: return false
    val manager = activity.getSystemService(ActivityManager::class.java) ?: return false
    return manager.lockTaskModeState != ActivityManager.LOCK_TASK_MODE_NONE
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  fun isKioskPaused(): Boolean = KioskBootstrap.isPausedByAdmin(ctx)

  @ReactMethod
  fun startKiosk() {
    val activity = reactApplicationContext.currentActivity ?: return
    activity.runOnUiThread { KioskBootstrap.enterKiosk(activity, force = false) }
  }

  @ReactMethod
  fun stopKiosk() {
    val activity = reactApplicationContext.currentActivity ?: return
    activity.runOnUiThread { KioskBootstrap.leaveKiosk(activity) }
  }

  @ReactMethod
  fun resumeKiosk() {
    val activity = reactApplicationContext.currentActivity ?: return
    activity.runOnUiThread { KioskBootstrap.enterKiosk(activity, force = true) }
  }

  @ReactMethod
  fun openDesktop() {
    KioskBootstrap.openDesktop(ctx)
  }

  @ReactMethod
  fun openSettings() {
    KioskBootstrap.openSettings(ctx)
  }

  @ReactMethod
  fun openWifi() {
    KioskBootstrap.openWifi(ctx)
  }

  @ReactMethod
  fun nativeLog(tag: String, message: String) {
    Log.i(tag.ifBlank { "NurseApp" }, message)
  }

  @ReactMethod
  fun installUpdate(url: String, promise: Promise) {
    Thread {
      try {
        doInstallUpdate(url)
        promise.resolve(null)
      } catch (err: Exception) {
        Log.e("Kiosk", "installUpdate failed", err)
        promise.reject("E_INSTALL", err.message, err)
      }
    }.start()
  }

  private fun doInstallUpdate(url: String) {
    KioskBootstrap.scrubUpdateArtifacts(ctx)
    KioskBootstrap.grantExactAlarmIfOwner(ctx)
    KioskBootstrap.ensureCoverInstalled(ctx)
    val file = KioskBootstrap.updateApkFile(ctx)
    try {
      URL(url).openStream().use { input ->
        file.outputStream().use { output -> input.copyTo(output) }
      }
    } catch (err: Exception) {
      KioskBootstrap.deleteUpdateApk(ctx, file.absolutePath)
      throw err
    }
    val installer = ctx.packageManager.packageInstaller
    val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
    }
    val sessionId = installer.createSession(params)
    val session = installer.openSession(sessionId)
    try {
      session.openWrite("clinic-nurse", 0, file.length()).use { output ->
        file.inputStream().use { input -> input.copyTo(output) }
        try {
          session.fsync(output)
        } catch (err: Exception) {
          Log.w("Kiosk", "nurse session fsync skipped", err)
        }
      }
      KioskBootstrap.showCover(ctx)
      KioskBootstrap.scheduleRelaunchAlarms(ctx)
      val broadcast = Intent(ctx, InstallResultReceiver::class.java)
        .putExtra(KioskBootstrap.EXTRA_APK_PATH, file.absolutePath)
        .putExtra(KioskBootstrap.EXTRA_INSTALL_KIND, KioskBootstrap.INSTALL_KIND_NURSE)
      val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_MUTABLE
      } else {
        android.app.PendingIntent.FLAG_UPDATE_CURRENT
      }
      val pending = android.app.PendingIntent.getBroadcast(ctx, sessionId, broadcast, flags)
      session.commit(pending.intentSender)
      Log.i("Kiosk", "PackageInstaller session $sessionId committed for $url")
    } catch (err: Exception) {
      try {
        installer.abandonSession(sessionId)
      } catch (_: Exception) {
      }
      KioskBootstrap.cancelRelaunchAlarms(ctx)
      KioskBootstrap.dismissCover(ctx)
      KioskBootstrap.deleteUpdateApk(ctx, file.absolutePath)
      throw err
    } finally {
      session.close()
    }
  }
}
