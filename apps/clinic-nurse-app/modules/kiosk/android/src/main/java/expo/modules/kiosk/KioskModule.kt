package expo.modules.kiosk

import android.app.Activity
import android.app.ActivityManager
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageInstaller
import android.os.Build
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.net.URL

class KioskModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("Kiosk")

    Function("isDeviceOwner") {
      isDeviceOwner()
    }

    Function("isInKioskMode") {
      isInKioskMode()
    }

    Function("startKiosk") {
      startKiosk()
    }

    Function("stopKiosk") {
      stopKiosk()
    }

    AsyncFunction("installUpdate") { url: String ->
      installUpdate(url)
    }
  }

  private fun admin(): ComponentName? {
    val context = appContext.reactContext ?: return null
    return ComponentName(context.packageName, "${context.packageName}.AdminReceiver")
  }

  private fun dpm(): DevicePolicyManager? {
    return appContext.reactContext?.getSystemService(DevicePolicyManager::class.java)
  }

  private fun isDeviceOwner(): Boolean {
    val policy = dpm() ?: return false
    val component = admin() ?: return false
    return policy.isDeviceOwnerApp(component.packageName)
  }

  private fun isInKioskMode(): Boolean {
    val activity = appContext.currentActivity ?: return false
    val manager = activity.getSystemService(ActivityManager::class.java) ?: return false
    return manager.lockTaskModeState != ActivityManager.LOCK_TASK_MODE_NONE
  }

  private fun startKiosk() {
    val activity = appContext.currentActivity ?: return
    activity.runOnUiThread {
      val policy = dpm()
      val component = admin()
      val owner = policy != null && component != null && policy.isDeviceOwnerApp(activity.packageName)
      if (owner && policy != null && component != null) {
        policy.setLockTaskPackages(component, arrayOf(activity.packageName))
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
          policy.setLockTaskFeatures(component, DevicePolicyManager.LOCK_TASK_FEATURE_NONE)
        }
        val filter = IntentFilter(Intent.ACTION_MAIN)
        filter.addCategory(Intent.CATEGORY_HOME)
        filter.addCategory(Intent.CATEGORY_DEFAULT)
        policy.addPersistentPreferredActivity(component, filter, activity.componentName)
        policy.setStatusBarDisabled(component, true)
        policy.setKeyguardDisabled(component, true)
      } else {
        Log.w("Kiosk", "Not device owner; screen pinning only. Home and silent APK install stay unavailable.")
      }
      try {
        activity.startLockTask()
      } catch (err: Exception) {
        Log.w("Kiosk", "startLockTask failed", err)
      }
    }
  }

  private fun stopKiosk() {
    val activity = appContext.currentActivity ?: return
    activity.runOnUiThread {
      val policy = dpm()
      val component = admin()
      if (policy != null && component != null && policy.isDeviceOwnerApp(activity.packageName)) {
        policy.setStatusBarDisabled(component, false)
        policy.setKeyguardDisabled(component, false)
      }
      try {
        activity.stopLockTask()
      } catch (err: Exception) {
        Log.w("Kiosk", "stopLockTask failed", err)
      }
    }
  }

  private fun installUpdate(url: String) {
    val context = appContext.reactContext ?: error("No Android context")
    val file = File(context.filesDir, "update.apk")
    URL(url).openStream().use { input ->
      file.outputStream().use { output -> input.copyTo(output) }
    }
    val installer = context.packageManager.packageInstaller
    val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
    }
    val sessionId = installer.createSession(params)
    val session = installer.openSession(sessionId)
    try {
      session.openWrite("clinic-nurse", 0, file.length()).use { output ->
        file.inputStream().use { input -> input.copyTo(output) }
        session.fsync(output)
      }
      val receiver = Class.forName("${context.packageName}.InstallResultReceiver")
      val intent = Intent(context, receiver)
      val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_MUTABLE
      } else {
        android.app.PendingIntent.FLAG_UPDATE_CURRENT
      }
      val pending = android.app.PendingIntent.getBroadcast(context, sessionId, intent, flags)
      session.commit(pending.intentSender)
    } finally {
      session.close()
    }
    Log.i("Kiosk", "PackageInstaller session $sessionId committed for $url")
  }
}
