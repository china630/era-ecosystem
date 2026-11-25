package online.era365.nurse

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import expo.modules.kiosk.KioskBootstrap

class PackageReplacedReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.action
    Log.i("Kiosk", "PackageReplacedReceiver action=$action")
    if (action != Intent.ACTION_MY_PACKAGE_REPLACED && action != Intent.ACTION_BOOT_COMPLETED) {
      return
    }
    try {
      // Reboot and package replace always restore kiosk (admin pause is intentional only until reboot).
      KioskBootstrap.setPausedByAdmin(context, false)
      // APK leftovers only — do NOT abandon PackageInstaller sessions here.
      // BOOT used to race with cover/OTA sessions (INSTALL_FAILED_ABORTED / EPIPE).
      KioskBootstrap.scrubLeftoverApks(context)
      KioskBootstrap.dismissCover(context)
      KioskBootstrap.launchMain(context, "PackageReplacedReceiver.$action")
    } catch (err: Exception) {
      Log.e("Kiosk", "PackageReplacedReceiver relaunch failed action=$action", err)
      throw err
    }
  }
}
