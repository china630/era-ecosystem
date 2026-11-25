package expo.modules.kiosk

import android.Manifest
import android.app.Activity
import android.app.AlarmManager
import android.app.PendingIntent
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageInstaller
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Shared kiosk relaunch / update cleanup / cover overlay.
 * Full APK replace always kills the nurse process — cover + receivers bring UI back.
 */
object KioskBootstrap {
  private const val TAG = "Kiosk"
  const val EXTRA_APK_PATH = "online.era365.nurse.EXTRA_UPDATE_APK_PATH"
  /** "nurse" = main APK update; "cover" = companion overlay install. */
  const val EXTRA_INSTALL_KIND = "online.era365.nurse.EXTRA_INSTALL_KIND"
  const val INSTALL_KIND_NURSE = "nurse"
  const val INSTALL_KIND_COVER = "cover"
  const val COVER_PACKAGE = "online.era365.nurse.cover"
  const val COVER_ACTIVITY = "online.era365.nurse.cover.CoverActivity"
  const val COVER_ACTION_SHOW = "online.era365.nurse.cover.ACTION_SHOW"
  const val COVER_ACTION_FINISH = "online.era365.nurse.cover.ACTION_FINISH"
  /** Must match versionCode of apps/clinic-nurse-cover bundled in assets/nurse-cover.apk. */
  const val COVER_BUNDLED_VERSION = 1
  private const val COVER_ASSET = "nurse-cover.apk"
  private const val PREFS = "kiosk_prefs"
  private const val KEY_PAUSED = "kioskPausedByAdmin"
  private const val ALARM_3S = 71003
  private const val ALARM_10S = 71010

  private val coverInstallInFlight = AtomicBoolean(false)
  private val coverEnsureScheduled = AtomicBoolean(false)
  private val bg = Executors.newSingleThreadExecutor()

  fun updatesDir(context: Context): File {
    return File(context.filesDir, "updates").also { it.mkdirs() }
  }

  fun updateApkFile(context: Context): File {
    return File(updatesDir(context), "update.apk")
  }

  private fun prefs(context: Context) =
    context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun isPausedByAdmin(context: Context): Boolean {
    return prefs(context).getBoolean(KEY_PAUSED, false)
  }

  fun setPausedByAdmin(context: Context, paused: Boolean) {
    prefs(context).edit().putBoolean(KEY_PAUSED, paused).apply()
    Log.i(TAG, "kioskPausedByAdmin=$paused")
  }

  fun mainActivityIntent(context: Context): Intent {
    return Intent().setClassName(context.packageName, "${context.packageName}.MainActivity").apply {
      addFlags(
        Intent.FLAG_ACTIVITY_NEW_TASK or
          Intent.FLAG_ACTIVITY_CLEAR_TASK or
          Intent.FLAG_ACTIVITY_CLEAR_TOP,
      )
    }
  }

  fun launchMain(context: Context, reason: String) {
    val intent = mainActivityIntent(context)
    try {
      context.startActivity(intent)
      Log.i(TAG, "launchMain ok reason=$reason")
    } catch (err: Exception) {
      Log.e(TAG, "launchMain failed reason=$reason", err)
      throw err
    }
  }

  fun deleteUpdateApk(context: Context, path: String? = null) {
    val targets = linkedSetOf<File>()
    if (!path.isNullOrBlank()) targets.add(File(path))
    targets.add(updateApkFile(context))
    updatesDir(context).listFiles()?.filter { it.isFile && it.name.endsWith(".apk", ignoreCase = true) }
      ?.let { targets.addAll(it) }
    targets.add(File(context.filesDir, "update.apk"))
    for (file in targets) {
      if (file.exists() && file.delete()) {
        Log.i(TAG, "deleted update apk ${file.absolutePath}")
      }
    }
  }

  fun abandonStaleSessions(context: Context) {
    val installer = context.packageManager.packageInstaller
    for (info in installer.mySessions) {
      try {
        installer.abandonSession(info.sessionId)
        Log.i(TAG, "abandoned PackageInstaller session ${info.sessionId}")
      } catch (err: Exception) {
        Log.w(TAG, "abandonSession ${info.sessionId} failed", err)
      }
    }
  }

  /** Leftover APK files only — do not abandon in-flight cover installs on every cold start. */
  fun scrubLeftoverApks(context: Context) {
    deleteUpdateApk(context)
  }

  fun scrubUpdateArtifacts(context: Context) {
    deleteUpdateApk(context)
    abandonStaleSessions(context)
  }

  private fun pendingFlags(mutable: Boolean): Int {
    var flags = PendingIntent.FLAG_UPDATE_CURRENT
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      flags = flags or if (mutable) PendingIntent.FLAG_MUTABLE else PendingIntent.FLAG_IMMUTABLE
    }
    return flags
  }

  fun scheduleRelaunchAlarms(context: Context) {
    val am = context.getSystemService(AlarmManager::class.java) ?: return
    val delays = listOf(ALARM_3S to 3_000L, ALARM_10S to 10_000L)
    for ((code, delayMs) in delays) {
      val pi = PendingIntent.getActivity(
        context,
        code,
        mainActivityIntent(context),
        pendingFlags(mutable = false),
      )
      val at = SystemClock.elapsedRealtime() + delayMs
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
          am.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, at, pi)
        } else {
          @Suppress("DEPRECATION")
          am.setExact(AlarmManager.ELAPSED_REALTIME_WAKEUP, at, pi)
        }
        Log.i(TAG, "scheduled relaunch alarm code=$code in ${delayMs}ms")
      } catch (err: Exception) {
        Log.e(TAG, "schedule relaunch alarm code=$code failed", err)
      }
    }
  }

  fun cancelRelaunchAlarms(context: Context) {
    val am = context.getSystemService(AlarmManager::class.java) ?: return
    for (code in listOf(ALARM_3S, ALARM_10S)) {
      val pi = PendingIntent.getActivity(
        context,
        code,
        mainActivityIntent(context),
        pendingFlags(mutable = false),
      )
      am.cancel(pi)
      pi.cancel()
    }
  }

  fun grantExactAlarmIfOwner(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return
    val policy = context.getSystemService(DevicePolicyManager::class.java) ?: return
    if (!policy.isDeviceOwnerApp(context.packageName)) return
    val admin = ComponentName(context.packageName, "${context.packageName}.AdminReceiver")
    try {
      policy.setPermissionGrantState(
        admin,
        context.packageName,
        Manifest.permission.SCHEDULE_EXACT_ALARM,
        DevicePolicyManager.PERMISSION_GRANT_STATE_GRANTED,
      )
      Log.i(TAG, "granted SCHEDULE_EXACT_ALARM as device owner")
    } catch (err: Exception) {
      Log.w(TAG, "setPermissionGrantState SCHEDULE_EXACT_ALARM failed", err)
    }
  }

  fun installedCoverVersion(context: Context): Long {
    return try {
      val info = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        context.packageManager.getPackageInfo(COVER_PACKAGE, PackageManager.PackageInfoFlags.of(0))
      } else {
        @Suppress("DEPRECATION")
        context.packageManager.getPackageInfo(COVER_PACKAGE, 0)
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.longVersionCode else @Suppress("DEPRECATION") info.versionCode.toLong()
    } catch (_: PackageManager.NameNotFoundException) {
      -1L
    }
  }

  fun isCoverInstalled(context: Context): Boolean = installedCoverVersion(context) >= 0

  fun coverNeedsInstall(context: Context): Boolean {
    val installed = installedCoverVersion(context)
    return installed < COVER_BUNDLED_VERSION
  }

  /** One background attempt per process; never blocks the UI thread. */
  fun scheduleEnsureCoverInstalled(context: Context) {
    val app = context.applicationContext
    if (!coverEnsureScheduled.compareAndSet(false, true)) {
      Log.i(TAG, "cover ensure already scheduled")
      return
    }
    bg.execute {
      try {
        ensureCoverInstalled(app)
      } catch (err: Exception) {
        Log.e(TAG, "scheduleEnsureCoverInstalled failed", err)
        coverEnsureScheduled.set(false)
      }
    }
  }

  /**
   * Install cover only when missing or older than [COVER_BUNDLED_VERSION].
   * Must not run on the main thread. No-op if an install is already in flight.
   */
  fun ensureCoverInstalled(context: Context) {
    if (!coverNeedsInstall(context)) {
      Log.i(TAG, "cover ok version=${installedCoverVersion(context)} (bundled=$COVER_BUNDLED_VERSION)")
      return
    }
    if (!coverInstallInFlight.compareAndSet(false, true)) {
      Log.i(TAG, "cover install already in flight — skip")
      return
    }
    try {
      val policy = context.getSystemService(DevicePolicyManager::class.java)
      if (policy == null || !policy.isDeviceOwnerApp(context.packageName)) {
        Log.w(TAG, "cover install skipped — not device owner")
        return
      }
      // Re-check after winning the lock (another thread may have finished).
      if (!coverNeedsInstall(context)) return

      val out = File(updatesDir(context), "nurse-cover.apk")
      try {
        context.assets.open(COVER_ASSET).use { input ->
          out.outputStream().use { output -> input.copyTo(output) }
        }
      } catch (err: Exception) {
        Log.w(TAG, "cover asset missing or unreadable ($COVER_ASSET)", err)
        return
      }
      val installer = context.packageManager.packageInstaller
      val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
      }
      val sessionId = installer.createSession(params)
      val session = installer.openSession(sessionId)
      try {
        session.openWrite("nurse-cover", 0, out.length()).use { output ->
          out.inputStream().use { input -> input.copyTo(output) }
          // Android 16 / HyperOS: fsync across the PackageInstaller binder can throw EPIPE
          // even after a successful write — commit still works without it.
          try {
            session.fsync(output)
          } catch (err: Exception) {
            Log.w(TAG, "cover session fsync skipped (write ok)", err)
          }
        }
        val receiver = Class.forName("${context.packageName}.InstallResultReceiver")
        val broadcast = Intent(context, receiver)
          .putExtra(EXTRA_APK_PATH, out.absolutePath)
          .putExtra(EXTRA_INSTALL_KIND, INSTALL_KIND_COVER)
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        } else {
          PendingIntent.FLAG_UPDATE_CURRENT
        }
        val pending = PendingIntent.getBroadcast(context, sessionId + 9000, broadcast, flags)
        session.commit(pending.intentSender)
        Log.i(TAG, "cover PackageInstaller session $sessionId committed (no MainActivity relaunch)")
      } catch (err: Exception) {
        try {
          installer.abandonSession(sessionId)
        } catch (_: Exception) {
        }
        Log.e(TAG, "cover install failed", err)
        coverInstallInFlight.set(false)
      } finally {
        session.close()
      }
    } finally {
      // Keep inFlight true until InstallResultReceiver reports cover status, so we do not double-commit.
      // If commit never fires, the next process start can retry (AtomicBoolean resets with process).
    }
  }

  fun onCoverInstallFinished() {
    coverInstallInFlight.set(false)
  }

  fun showCover(context: Context) {
    // Never block the update path on cover install. Overlay is best-effort only.
    if (coverNeedsInstall(context)) {
      Log.w(TAG, "showCover — cover not installed yet; skipping overlay (update continues)")
      return
    }
    if (!isCoverInstalled(context)) {
      Log.w(TAG, "showCover skipped — cover package not installed")
      return
    }
    val intent = Intent(COVER_ACTION_SHOW).setClassName(COVER_PACKAGE, COVER_ACTIVITY).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    }
    try {
      context.startActivity(intent)
      Log.i(TAG, "cover activity launched")
      val latch = CountDownLatch(1)
      Handler(Looper.getMainLooper()).postDelayed({ latch.countDown() }, 450)
      latch.await(700, TimeUnit.MILLISECONDS)
    } catch (err: Exception) {
      Log.e(TAG, "showCover failed", err)
    }
  }

  fun dismissCover(context: Context) {
    if (!isCoverInstalled(context)) return
    try {
      val intent = Intent(COVER_ACTION_FINISH).setClassName(COVER_PACKAGE, COVER_ACTIVITY).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      }
      context.startActivity(intent)
      Log.i(TAG, "cover finish activity started")
    } catch (err: Exception) {
      Log.w(TAG, "dismissCover failed", err)
    }
  }

  fun leaveKiosk(activity: Activity) {
    val context = activity.applicationContext
    Log.i(TAG, "leaveKiosk begin")
    setPausedByAdmin(context, true)
    KioskChrome.active = false
    KioskChrome.clear(activity)
    val policy = context.getSystemService(DevicePolicyManager::class.java)
    val admin = ComponentName(context.packageName, "${context.packageName}.AdminReceiver")
    if (policy != null && policy.isDeviceOwnerApp(context.packageName)) {
      try {
        policy.setStatusBarDisabled(admin, false)
        policy.setKeyguardDisabled(admin, false)
        Log.i(TAG, "leaveKiosk statusBar/keyguard re-enabled")
      } catch (err: Exception) {
        Log.w(TAG, "re-enable status/keyguard failed", err)
      }
      try {
        // Must clear before launching HOME — otherwise we are still the preferred launcher.
        policy.clearPackagePersistentPreferredActivities(admin, context.packageName)
        Log.i(TAG, "leaveKiosk cleared persistent preferred HOME for ${context.packageName}")
      } catch (err: Exception) {
        Log.w(TAG, "clearPackagePersistentPreferredActivities failed", err)
      }
    } else {
      Log.w(TAG, "leaveKiosk not device owner — cannot clear preferred HOME")
    }
    try {
      activity.stopLockTask()
      Log.i(TAG, "leaveKiosk stopLockTask ok")
    } catch (err: Exception) {
      Log.w(TAG, "stopLockTask failed", err)
    }
    openDesktop(context)
  }

  fun openDesktop(context: Context) {
    val app = context.applicationContext
    val candidates = listOf(
      Intent().setClassName("com.miui.home", "com.miui.home.launcher.Launcher"),
      Intent().setPackage("com.miui.home").setAction(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME),
      Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME),
      Intent(android.provider.Settings.ACTION_SETTINGS),
    )
    for (intent in candidates) {
      try {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        app.startActivity(intent)
        Log.i(TAG, "openDesktop launched ${intent.component ?: intent.action}")
        return
      } catch (err: Exception) {
        Log.w(TAG, "openDesktop candidate failed ${intent.component ?: intent.action}", err)
      }
    }
    Log.e(TAG, "openDesktop all candidates failed")
  }

  fun openSettings(context: Context) {
    try {
      context.applicationContext.startActivity(
        Intent(android.provider.Settings.ACTION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
      )
      Log.i(TAG, "openSettings ok")
    } catch (err: Exception) {
      Log.e(TAG, "openSettings failed", err)
    }
  }

  fun openWifi(context: Context) {
    try {
      context.applicationContext.startActivity(
        Intent(android.provider.Settings.ACTION_WIFI_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
      )
      Log.i(TAG, "openWifi ok")
    } catch (err: Exception) {
      Log.e(TAG, "openWifi failed", err)
      openSettings(context)
    }
  }

  fun enterKiosk(activity: Activity, force: Boolean = false) {
    val context = activity.applicationContext
    if (!force && isPausedByAdmin(context)) {
      Log.i(TAG, "enterKiosk skipped — adminMode/paused (no startLockTask, no HOME preferred)")
      KioskChrome.active = false
      return
    }
    if (force) {
      Log.i(TAG, "enterKiosk force=true — clearing adminMode and restoring HOME preferred")
      setPausedByAdmin(context, false)
    }
    val policy = context.getSystemService(DevicePolicyManager::class.java)
    val admin = ComponentName(context.packageName, "${context.packageName}.AdminReceiver")
    val owner = policy != null && policy.isDeviceOwnerApp(context.packageName)
    if (owner && policy != null) {
      // Do NOT install cover here — that caused the install→relaunch loop on resume.
      val packages = if (isCoverInstalled(context)) {
        arrayOf(context.packageName, COVER_PACKAGE)
      } else {
        arrayOf(context.packageName)
      }
      policy.setLockTaskPackages(admin, packages)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        policy.setLockTaskFeatures(admin, DevicePolicyManager.LOCK_TASK_FEATURE_NONE)
      }
      val filter = IntentFilter(Intent.ACTION_MAIN)
      filter.addCategory(Intent.CATEGORY_HOME)
      filter.addCategory(Intent.CATEGORY_DEFAULT)
      policy.addPersistentPreferredActivity(
        admin,
        filter,
        ComponentName(context.packageName, "${context.packageName}.MainActivity"),
      )
      policy.setStatusBarDisabled(admin, true)
      policy.setKeyguardDisabled(admin, true)
      grantExactAlarmIfOwner(context)
    } else {
      Log.w(TAG, "Not device owner; screen pinning only.")
    }
    try {
      activity.startLockTask()
    } catch (err: Exception) {
      Log.w(TAG, "startLockTask failed", err)
    }
    KioskChrome.active = true
    KioskChrome.hookFocus(activity)
    KioskChrome.apply(activity)
    dismissCover(context)
  }
}
