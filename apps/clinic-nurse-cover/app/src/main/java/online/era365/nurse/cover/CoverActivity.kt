package online.era365.nurse.cover

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.TextView

/**
 * Full-screen cover shown while the nurse app PackageInstaller replaces the APK.
 * Stays alive in the lock-task whitelist so HyperOS does not flash the launcher.
 */
class CoverActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    if (intent?.action == ACTION_FINISH) {
      finishCover()
      return
    }
    window.addFlags(
      WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
        WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
        WindowManager.LayoutParams.FLAG_FULLSCREEN,
    )
    immersive()
    val root = FrameLayout(this).apply { setBackgroundColor(Color.parseColor("#0F172A")) }
    val label = TextView(this).apply {
      text = "Yenilənir…"
      setTextColor(Color.WHITE)
      textSize = 22f
      gravity = Gravity.CENTER
    }
    root.addView(
      label,
      FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.MATCH_PARENT,
      ),
    )
    setContentView(root)
    try {
      startLockTask()
      Log.i(TAG, "cover lock task started")
    } catch (err: Exception) {
      Log.w(TAG, "cover startLockTask failed", err)
    }
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    if (intent.action == ACTION_FINISH) {
      Log.i(TAG, "finish intent received")
      finishCover()
    }
  }

  override fun onResume() {
    super.onResume()
    immersive()
  }

  private fun finishCover() {
    try {
      stopLockTask()
    } catch (_: Exception) {
    }
    finishAndRemoveTask()
  }

  private fun immersive() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      window.setDecorFitsSystemWindows(false)
      window.insetsController?.hide(
        android.view.WindowInsets.Type.statusBars() or android.view.WindowInsets.Type.navigationBars(),
      )
    } else {
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
  }

  companion object {
    private const val TAG = "NurseCover"
    const val ACTION_SHOW = "online.era365.nurse.cover.ACTION_SHOW"
    const val ACTION_FINISH = "online.era365.nurse.cover.ACTION_FINISH"
  }
}
