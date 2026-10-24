package app.jkt48connect

import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import app.jkt48connect.core.Api
import app.jkt48connect.core.Images
import app.jkt48connect.core.Notify
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import app.jkt48connect.ui.App
import app.jkt48connect.ui.theme.ThemeController

class MainActivity : ComponentActivity() {
    // Tujuan dari notifikasi yang diketuk ("tab:1", "theater:…"); dikonsumsi oleh App.
    private var openTarget by mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Api.init(this)
        Images.init(this)
        app.jkt48connect.core.Favorites.init(this)
        ThemeController.init(this)
        Notify.schedule(this)
        openTarget = intent?.getStringExtra(Notify.EXTRA_OPEN)
        val intro = savedInstanceState == null && openTarget == null
        enableEdgeToEdge()
        setContent {
            App(intro = intro, openTarget = openTarget, onOpened = { openTarget = null }, onDarkChanged = { dark ->
                // Ikon status bar & navigasi mengikuti tema aplikasi; latarnya transparan.
                val style = if (dark) SystemBarStyle.dark(Color.TRANSPARENT) else SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT)
                enableEdgeToEdge(statusBarStyle = style, navigationBarStyle = style)
            })
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        intent.getStringExtra(Notify.EXTRA_OPEN)?.let { openTarget = it }
    }
}
