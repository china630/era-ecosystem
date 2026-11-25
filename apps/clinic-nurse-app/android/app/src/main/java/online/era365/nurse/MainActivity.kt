package online.era365.nurse

import android.app.AlertDialog
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.InputType
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper
import expo.modules.kiosk.KioskBootstrap
import expo.modules.kiosk.KioskChrome

class MainActivity : ReactActivity() {
  private val mainHandler = Handler(Looper.getMainLooper())
  private var bootWatchdog: Runnable? = null
  private var errorOverlay: FrameLayout? = null
  private var adminTapZone: View? = null
  private var adminBar: LinearLayout? = null
  private var adminTapCount = 0
  private var adminTapWindowStart = 0L

  override fun onCreate(savedInstanceState: Bundle?) {
    setTheme(R.style.AppTheme)
    super.onCreate(null)
    // Stop any previous OTA relaunch loop before anything else.
    KioskBootstrap.cancelRelaunchAlarms(this)
    KioskBootstrap.scrubLeftoverApks(this)
    if (!KioskBootstrap.isPausedByAdmin(this)) {
      KioskBootstrap.enterKiosk(this, force = false)
    }
    NativeSilentUpdate.schedule(this)
    installNativeAdminChrome()
    scheduleReactBootWatchdog()
  }

  override fun onResume() {
    super.onResume()
    if (!KioskBootstrap.isPausedByAdmin(this)) {
      KioskBootstrap.enterKiosk(this, force = false)
      KioskChrome.apply(this)
    } else {
      ensureAdminBar()
    }
    if (isReactReady()) {
      dismissBootError()
    }
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus && !KioskBootstrap.isPausedByAdmin(this)) {
      KioskBootstrap.enterKiosk(this, force = false)
      KioskChrome.apply(this)
    }
  }

  override fun onDestroy() {
    bootWatchdog?.let { mainHandler.removeCallbacks(it) }
    bootWatchdog = null
    super.onDestroy()
  }

  override fun getMainComponentName(): String = "main"

  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
      this,
      BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
      object : DefaultReactActivityDelegate(
        this,
        mainComponentName,
        fabricEnabled,
      ) {},
    )
  }

  override fun invokeDefaultOnBackPressed() {
    if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
      if (!moveTaskToBack(false)) {
        super.invokeDefaultOnBackPressed()
      }
      return
    }
    super.invokeDefaultOnBackPressed()
  }

  private fun installNativeAdminChrome() {
    val decor = window.decorView as? FrameLayout ?: return
    if (adminTapZone != null) return
    val density = resources.displayMetrics.density
    val size = (72 * density).toInt()
    val zone = View(this).apply {
      setBackgroundColor(Color.TRANSPARENT)
      isClickable = true
      setOnClickListener { onAdminCornerTap() }
    }
    val lp = FrameLayout.LayoutParams(size, size, Gravity.TOP or Gravity.END)
    decor.addView(zone, lp)
    adminTapZone = zone
    if (KioskBootstrap.isPausedByAdmin(this)) {
      ensureAdminBar()
    }
  }

  private fun onAdminCornerTap() {
    val now = System.currentTimeMillis()
    if (now - adminTapWindowStart > 2_500L) {
      adminTapCount = 0
      adminTapWindowStart = now
    }
    adminTapCount += 1
    Log.i("NurseApp", "admin corner tap $adminTapCount")
    if (adminTapCount < 5) return
    adminTapCount = 0
    promptAdminPin()
  }

  private fun promptAdminPin() {
    val input = EditText(this).apply {
      inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_VARIATION_PASSWORD
      hint = "PIN"
    }
    AlertDialog.Builder(this)
      .setTitle("Admin")
      .setView(input)
      .setPositiveButton("OK") { _, _ ->
        val pin = input.text?.toString()?.trim().orEmpty()
        if (pin == ADMIN_PIN) {
          Log.i("Kiosk", "native PIN ok — leaveKiosk / adminMode")
          KioskBootstrap.leaveKiosk(this)
          KioskChrome.clear(this)
          KioskChrome.active = false
          ensureAdminBar()
          Toast.makeText(this, "Admin mode", Toast.LENGTH_SHORT).show()
        } else {
          Toast.makeText(this, "Wrong PIN", Toast.LENGTH_SHORT).show()
        }
      }
      .setNegativeButton("Cancel", null)
      .show()
  }

  private fun ensureAdminBar() {
    if (adminBar != null) return
    val decor = window.decorView as? FrameLayout ?: return
    val density = resources.displayMetrics.density
    val pad = (8 * density).toInt()
    fun btn(label: String, action: () -> Unit): Button {
      return Button(this).apply {
        text = label
        setOnClickListener { action() }
        setPadding(pad, pad / 2, pad, pad / 2)
      }
    }
    val bar = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      setBackgroundColor(Color.parseColor("#CC0F172A"))
      setPadding(pad, pad, pad, pad)
      gravity = Gravity.CENTER_VERTICAL
      addView(btn("Desktop") { KioskBootstrap.openDesktop(this@MainActivity) })
      addView(btn("Settings") { KioskBootstrap.openSettings(this@MainActivity) })
      addView(btn("Wi-Fi") { KioskBootstrap.openWifi(this@MainActivity) })
      addView(btn("Kiosk") {
        KioskBootstrap.enterKiosk(this@MainActivity, force = true)
        KioskChrome.active = true
        KioskChrome.apply(this@MainActivity)
        adminBar?.let { (it.parent as? android.view.ViewGroup)?.removeView(it) }
        adminBar = null
      })
    }
    val lp = FrameLayout.LayoutParams(
      FrameLayout.LayoutParams.MATCH_PARENT,
      FrameLayout.LayoutParams.WRAP_CONTENT,
      Gravity.TOP,
    )
    decor.addView(bar, lp)
    adminBar = bar
  }

  private fun scheduleReactBootWatchdog() {
    bootWatchdog?.let { mainHandler.removeCallbacks(it) }
    val task = Runnable {
      if (isFinishing || isDestroyed) return@Runnable
      if (isReactReady()) {
        Log.i("NurseApp", "React boot watchdog: instance ready")
        dismissBootError()
        return@Runnable
      }
      // Do not keep relaunching into a dead ReactInstance.
      KioskBootstrap.cancelRelaunchAlarms(this)
      val msg = lastReactHostError ?: "ReactInstance failed to start (empty UI)."
      Log.e("NurseApp", "boot watchdog: $msg")
      showBootError(msg)
    }
    bootWatchdog = task
    mainHandler.postDelayed(task, 6_000L)
    // Second check in case first race with soft-exception timing
    mainHandler.postDelayed({
      if (!isReactReady() && errorOverlay == null) {
        KioskBootstrap.cancelRelaunchAlarms(this@MainActivity)
        showBootError(lastReactHostError ?: "ReactInstance still null")
      }
    }, 12_000L)
  }

  private fun isReactReady(): Boolean {
    return try {
      val host = reactHost
      host != null && host.currentReactContext != null
    } catch (err: Exception) {
      Log.w("NurseApp", "isReactReady check failed", err)
      false
    }
  }

  private fun showBootError(message: String) {
    if (errorOverlay != null) return
    KioskBootstrap.cancelRelaunchAlarms(this)
    val density = resources.displayMetrics.density
    val pad = (24 * density).toInt()

    val title = TextView(this).apply {
      text = "Clinic-Nurse"
      setTextColor(Color.WHITE)
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 22f)
      gravity = Gravity.CENTER
    }
    val body = TextView(this).apply {
      text = "Не удалось запустить интерфейс.\n$message\n\n5× тап справа сверху + PIN $ADMIN_PIN — выход из киоска."
      setTextColor(Color.parseColor("#FFCDD2"))
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
      gravity = Gravity.CENTER
      setPadding(0, pad / 2, 0, pad)
    }
    val restart = Button(this).apply {
      text = "Перезапустить"
      setOnClickListener {
        Log.i("NurseApp", "boot error — restart requested")
        KioskBootstrap.cancelRelaunchAlarms(this@MainActivity)
        try {
          KioskBootstrap.launchMain(this@MainActivity, "MainActivity.bootErrorRestart")
        } catch (err: Exception) {
          Log.e("NurseApp", "restart via launchMain failed", err)
        }
        mainHandler.postDelayed({ Runtime.getRuntime().exit(0) }, 250)
      }
    }
    val admin = Button(this).apply {
      text = "Admin PIN"
      setOnClickListener { promptAdminPin() }
    }
    val column = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setPadding(pad, pad, pad, pad)
      setBackgroundColor(Color.parseColor("#B3000000"))
      addView(title)
      addView(body)
      addView(restart)
      addView(admin)
    }
    val overlay = FrameLayout(this).apply {
      setBackgroundColor(Color.parseColor("#FF1A1A1A"))
      addView(
        column,
        FrameLayout.LayoutParams(
          FrameLayout.LayoutParams.MATCH_PARENT,
          FrameLayout.LayoutParams.MATCH_PARENT,
        ),
      )
      isClickable = true
      isFocusable = true
    }
    val decor = window.decorView as? FrameLayout
    if (decor != null) {
      decor.addView(
        overlay,
        FrameLayout.LayoutParams(
          FrameLayout.LayoutParams.MATCH_PARENT,
          FrameLayout.LayoutParams.MATCH_PARENT,
        ),
      )
      errorOverlay = overlay
      // Keep admin tap zone above the overlay
      adminTapZone?.bringToFront()
    } else {
      setContentView(overlay)
      errorOverlay = overlay
    }
  }

  private fun dismissBootError() {
    val overlay = errorOverlay ?: return
    try {
      (overlay.parent as? android.view.ViewGroup)?.removeView(overlay)
    } catch (_: Exception) {
    }
    errorOverlay = null
  }

  companion object {
    private const val ADMIN_PIN = "0000"
    @Volatile
    var lastReactHostError: String? = null
  }
}
