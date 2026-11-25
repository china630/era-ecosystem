package expo.modules.kiosk

import android.app.Activity
import android.os.Build
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import java.util.Collections
import java.util.WeakHashMap

/**
 * Chrome helpers only. The Expo Modules Kotlin DSL for Kiosk was removed —
 * JS talks to [online.era365.nurse.KioskReactModule] (classic RN bridge) to avoid
 * throwUndefinedForReified during ReactInstance creation.
 */
object KioskChrome {
  @Volatile var active: Boolean = false
  private val focusHooked = Collections.newSetFromMap(WeakHashMap<View, Boolean>())

  fun hookFocus(activity: Activity) {
    val decor = activity.window.decorView
    if (!focusHooked.add(decor)) return
    decor.viewTreeObserver.addOnWindowFocusChangeListener { hasFocus ->
      if (hasFocus) apply(activity)
    }
  }

  fun apply(activity: Activity) {
    if (!active || Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return
    val window = activity.window
    window.setDecorFitsSystemWindows(false)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      val params = window.attributes
      params.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
      window.attributes = params
    }
    val controller = window.insetsController ?: return
    controller.hide(
      WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars() or WindowInsets.Type.captionBar(),
    )
    controller.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    @Suppress("DEPRECATION")
    window.decorView.systemUiVisibility = (
      View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        or View.SYSTEM_UI_FLAG_FULLSCREEN
        or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
        or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
        or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
      )
  }

  fun clear(activity: Activity) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return
    activity.window.insetsController?.show(
      WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars() or WindowInsets.Type.captionBar(),
    )
  }
}
