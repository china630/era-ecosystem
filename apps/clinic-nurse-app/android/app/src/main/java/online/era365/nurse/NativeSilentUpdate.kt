package online.era365.nurse

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import expo.modules.kiosk.KioskBootstrap
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Runs WITHOUT React/JS. Installs only when remote/local versionCode is STRICTLY greater
 * than the installed app — never re-commits the same APK on every cold start.
 */
object NativeSilentUpdate {
  private const val TAG = "NurseApp"
  private const val LOCAL_UPDATE = "/data/local/tmp/Clinic-Nurse-update.apk"
  private val started = AtomicBoolean(false)
  private val bg = Executors.newSingleThreadExecutor()

  fun schedule(context: Context) {
    if (!started.compareAndSet(false, true)) return
    val app = context.applicationContext
    bg.execute {
      try {
        maybeInstallLocal(app)
        maybeInstallFromServer(app)
      } catch (err: Exception) {
        Log.e(TAG, "NativeSilentUpdate failed: ${err.javaClass.name}: ${err.message}", err)
      }
    }
  }

  private fun selfVersionCode(context: Context): Long {
    return try {
      val info = context.packageManager.getPackageInfo(context.packageName, 0)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.longVersionCode
      else @Suppress("DEPRECATION") info.versionCode.toLong()
    } catch (err: Exception) {
      Log.w(TAG, "native update: cannot read self version", err)
      -1L
    }
  }

  private fun apkVersionCode(context: Context, file: File): Long {
    return try {
      val info = if (Build.VERSION.SDK_INT >= 33) {
        context.packageManager.getPackageArchiveInfo(
          file.absolutePath,
          PackageManager.PackageInfoFlags.of(0),
        )
      } else {
        @Suppress("DEPRECATION")
        context.packageManager.getPackageArchiveInfo(file.absolutePath, 0)
      } ?: return -1L
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.longVersionCode
      else @Suppress("DEPRECATION") info.versionCode.toLong()
    } catch (err: Exception) {
      Log.w(TAG, "native update: cannot read apk version ${file.absolutePath}", err)
      -1L
    }
  }

  private fun maybeInstallLocal(context: Context) {
    val file = File(LOCAL_UPDATE)
    if (!file.isFile || file.length() < 1_000_000L) {
      Log.i(TAG, "native update: no local apk at $LOCAL_UPDATE")
      return
    }
    val selfCode = selfVersionCode(context)
    val apkCode = apkVersionCode(context, file)
    Log.i(TAG, "native update: local apk code=$apkCode self=$selfCode size=${file.length()}")
    if (apkCode < 0) {
      Log.w(TAG, "native update: skip local — unreadable versionCode")
      return
    }
    if (apkCode <= selfCode) {
      Log.i(TAG, "native update: skip local — not newer (apk=$apkCode <= self=$selfCode)")
      return
    }
    installFile(context, file, deleteAfter = false)
  }

  private fun maybeInstallFromServer(context: Context) {
    val base = BuildConfig.UPDATE_BASE_URL.trimEnd('/')
    if (base.isBlank()) {
      Log.w(TAG, "native update: UPDATE_BASE_URL empty")
      return
    }
    val versionUrl = "$base/version.json"
    Log.i(TAG, "native update: fetching $versionUrl")
    val conn = (URL(versionUrl).openConnection() as HttpURLConnection).apply {
      connectTimeout = 10_000
      readTimeout = 10_000
      requestMethod = "GET"
    }
    val body = try {
      conn.inputStream.bufferedReader().use { it.readText() }
    } finally {
      conn.disconnect()
    }
    val json = JSONObject(body)
    val remoteCode = json.optLong("versionCode", -1)
    val apkUrl = json.optString("apkUrl", "")
    val selfCode = selfVersionCode(context)
    Log.i(TAG, "native update: self=$selfCode remote=$remoteCode")
    if (remoteCode <= selfCode || apkUrl.isBlank()) {
      Log.i(TAG, "native update: skip server — not newer or empty url")
      return
    }

    val dest = KioskBootstrap.updateApkFile(context)
    Log.i(TAG, "native update: downloading $apkUrl → ${dest.absolutePath}")
    val apkConn = (URL(apkUrl).openConnection() as HttpURLConnection).apply {
      connectTimeout = 15_000
      readTimeout = 120_000
      requestMethod = "GET"
    }
    try {
      apkConn.inputStream.use { input ->
        dest.outputStream().use { output -> input.copyTo(output) }
      }
    } finally {
      apkConn.disconnect()
    }
    val downloadedCode = apkVersionCode(context, dest)
    if (downloadedCode >= 0 && downloadedCode <= selfCode) {
      Log.i(TAG, "native update: skip downloaded — not newer (apk=$downloadedCode <= self=$selfCode)")
      KioskBootstrap.deleteUpdateApk(context, dest.absolutePath)
      return
    }
    installFile(context, dest, deleteAfter = true)
  }

  private fun installFile(context: Context, file: File, deleteAfter: Boolean) {
    val installer = context.packageManager.packageInstaller
    val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
    }
    val sessionId = installer.createSession(params)
    val session = installer.openSession(sessionId)
    try {
      session.openWrite("clinic-nurse-native", 0, file.length()).use { output ->
        file.inputStream().use { input -> input.copyTo(output) }
        try {
          session.fsync(output)
        } catch (err: Exception) {
          Log.w(TAG, "native update fsync skipped", err)
        }
      }
      KioskBootstrap.showCover(context)
      KioskBootstrap.scheduleRelaunchAlarms(context)
      val broadcast = Intent(context, InstallResultReceiver::class.java)
        .putExtra(KioskBootstrap.EXTRA_APK_PATH, if (deleteAfter) file.absolutePath else null)
        .putExtra(KioskBootstrap.EXTRA_INSTALL_KIND, KioskBootstrap.INSTALL_KIND_NURSE)
      val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
      } else {
        PendingIntent.FLAG_UPDATE_CURRENT
      }
      val pending = PendingIntent.getBroadcast(context, sessionId + 5000, broadcast, flags)
      session.commit(pending.intentSender)
      Log.i(TAG, "native update: PackageInstaller session $sessionId committed for ${file.absolutePath}")
    } catch (err: Exception) {
      try {
        installer.abandonSession(sessionId)
      } catch (_: Exception) {
      }
      KioskBootstrap.cancelRelaunchAlarms(context)
      KioskBootstrap.dismissCover(context)
      Log.e(TAG, "native update: install failed: ${err.javaClass.name}: ${err.message}", err)
      throw err
    } finally {
      session.close()
    }
  }
}
