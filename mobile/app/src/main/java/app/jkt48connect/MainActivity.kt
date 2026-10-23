package app.jkt48connect

import android.graphics.Color
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import app.jkt48connect.core.Api
import app.jkt48connect.core.Images
import app.jkt48connect.ui.App
import app.jkt48connect.ui.theme.ThemeController

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Api.init(this)
        Images.init(this)
        ThemeController.init(this)
        enableEdgeToEdge()
        setContent {
            App(onDarkChanged = { dark ->
                // Ikon status bar & navigasi mengikuti tema aplikasi; latarnya transparan.
                val style = if (dark) SystemBarStyle.dark(Color.TRANSPARENT) else SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT)
                enableEdgeToEdge(statusBarStyle = style, navigationBarStyle = style)
            })
        }
    }
}
