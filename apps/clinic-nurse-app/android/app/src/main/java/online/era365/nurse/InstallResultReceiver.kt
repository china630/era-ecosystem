package online.era365.nurse

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.util.Log
import expo.modules.kiosk.KioskBootstrap

class InstallResultReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
    val message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE)
    val apkPath = intent.getStringExtra(KioskBootstrap.EXTRA_APK_PATH)
    val kind = intent.getStringExtra(KioskBootstrap.EXTRA_INSTALL_KIND)
      ?: KioskBootstrap.INSTALL_KIND_NURSE
    Log.i("Kiosk", "APK install status=$status kind=$kind message=$message apk=$apkPath")
    try {
      KioskBootstrap.deleteUpdateApk(context, apkPath)
    } catch (err: Exception) {
      Log.e("Kiosk", "deleteUpdateApk after install status failed", err)
    }
    if (kind == KioskBootstrap.INSTALL_KIND_COVER) {
      KioskBootstrap.onCoverInstallFinished()
      Log.i("Kiosk", "cover install finished status=$status — MainActivity not relaunched")
      return
    }
    if (status == PackageInstaller.STATUS_SUCCESS) {
      try {
        KioskBootstrap.launchMain(context, "InstallResultReceiver.SUCCESS.nurse")
      } catch (err: Exception) {
        Log.e("Kiosk", "InstallResultReceiver relaunch failed", err)
      }
    }
  }
}
