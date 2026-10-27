package app.jkt48connect.ui.theme

import android.content.Context
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.text.selection.LocalTextSelectionColors
import androidx.compose.foundation.text.selection.TextSelectionColors
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.ExperimentalTextApi
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import app.jkt48connect.R

/**
 * Palet JKT48Connect ala iOS: latar abu sistem (grouped background) dengan kartu putih di tema terang,
 * hitam pekat dengan kartu abu tua di tema gelap; merah JKT48 sebagai warna aksen.
 */
@Immutable
data class AppColors(
    val bg: Color,
    val card: Color,
    val surface: Color,
    val ink: Color,
    val inkSoft: Color,
    val line: Color,
    val brand: Color,
    val blush: Color,
    val butter: Color,
    val butterInk: Color,
    /** Panel kontras (show berikutnya, replay, statistik besar). */
    val panel: Color,
    /** Isian kaca agar teks tetap terbaca. */
    val glass: Color,
    val dark: Boolean,
) {
    val brandGradient: Brush
        get() = Brush.linearGradient(
            if (dark) listOf(Color(0xFFD42340), Color(0xFF7A0E1F)) else listOf(Color(0xFFFF4A5F), Color(0xFFC3142B)),
            start = Offset.Zero,
            end = Offset.Infinite,
        )

    companion object {
        val Light = AppColors(
            bg = Color(0xFFF2F2F7),
            card = Color(0xFFFFFFFF),
            surface = Color(0xFFE5E5EA),
            ink = Color(0xFF0B0B0F),
            inkSoft = Color(0xFF6E6E76),
            line = Color(0x243C3C43),
            brand = Color(0xFFE1243A),
            blush = Color(0xFFFFE5E8),
            butter = Color(0xFFFFF0C7),
            butterInk = Color(0xFF8A5A00),
            panel = Color(0xFF0E0E11),
            glass = Color(0xFFFFFFFF).copy(alpha = 0.6f),
            dark = false,
        )
        val Dark = AppColors(
            bg = Color(0xFF000000),
            card = Color(0xFF1C1C1E),
            surface = Color(0xFF2C2C2E),
            ink = Color(0xFFF5F5F7),
            inkSoft = Color(0xFF98989F),
            line = Color(0x26FFFFFF),
            brand = Color(0xFFFF4259),
            blush = Color(0xFF3A141B),
            butter = Color(0xFF2E2410),
            butterInk = Color(0xFFFFC95C),
            panel = Color(0xFF1A1A1F),
            glass = Color(0xFF2C2C2E).copy(alpha = 0.55f),
            dark = true,
        )
    }
}

val LocalColors = staticCompositionLocalOf { AppColors.Light }

/** Pilihan tema pengguna (Sistem / Putih / Gelap), disimpan di perangkat. */
enum class ThemeMode { System, Light, Dark }

object ThemeController {
    var mode by mutableStateOf(ThemeMode.System)
        private set
    private var prefs: android.content.SharedPreferences? = null

    fun init(context: Context) {
        prefs = context.getSharedPreferences("app", Context.MODE_PRIVATE)
        mode = ThemeMode.entries.firstOrNull { it.name == prefs?.getString("theme_mode", null) } ?: ThemeMode.System
    }

    fun set(m: ThemeMode) {
        mode = m
        prefs?.edit()?.putString("theme_mode", m.name)?.apply()
    }
}

@Composable
fun isDarkTheme(): Boolean = when (ThemeController.mode) {
    ThemeMode.System -> isSystemInDarkTheme()
    ThemeMode.Light -> false
    ThemeMode.Dark -> true
}

@Composable
fun AppTheme(dark: Boolean, content: @Composable () -> Unit) {
    val c = if (dark) AppColors.Dark else AppColors.Light
    CompositionLocalProvider(
        LocalColors provides c,
        LocalTextSelectionColors provides TextSelectionColors(c.brand, c.brand.copy(alpha = 0.3f)),
        content = content,
    )
}

// Tipografi: Archivo condensed untuk judul, IBM Plex Mono untuk label mikro.

@OptIn(ExperimentalTextApi::class)
private fun archivo(weight: Int, width: Float) = Font(
    R.font.archivo,
    weight = FontWeight(weight),
    variationSettings = FontVariation.Settings(FontVariation.weight(weight), FontVariation.width(width)),
)

private val Display = FontFamily(archivo(900, 62f), archivo(800, 62f))
private val Body = FontFamily(archivo(500, 100f), archivo(600, 100f), archivo(700, 100f), archivo(800, 100f))
private val Mono = FontFamily(Font(R.font.plexmono_medium, FontWeight.Medium), Font(R.font.plexmono_semibold, FontWeight.SemiBold))

object AppText {
    /** Judul besar ala iOS (large title): tebal, huruf biasa, sedikit rapat. */
    fun title(size: TextUnit, color: Color = Color.Unspecified) =
        TextStyle(fontFamily = Body, fontWeight = FontWeight(800), fontSize = size, lineHeight = size * 1.12f, letterSpacing = (-0.02).em, color = color)

    fun display(size: TextUnit, color: Color = Color.Unspecified) =
        TextStyle(fontFamily = Display, fontWeight = FontWeight(900), fontSize = size, lineHeight = size * 0.92f, letterSpacing = (-0.01).em, color = color)

    fun body(size: TextUnit, color: Color = Color.Unspecified, weight: Int = 500, lineHeight: Float = 1.35f) =
        TextStyle(fontFamily = Body, fontWeight = FontWeight(weight), fontSize = size, lineHeight = size * lineHeight, color = color)

    fun micro(color: Color = Color.Unspecified, size: TextUnit = 10.5.sp) =
        TextStyle(fontFamily = Mono, fontWeight = FontWeight.SemiBold, fontSize = size, letterSpacing = 0.15.em, color = color)

    fun mono(size: TextUnit, color: Color = Color.Unspecified, weight: FontWeight = FontWeight.Medium) =
        TextStyle(fontFamily = Mono, fontWeight = weight, fontSize = size, color = color, fontFeatureSettings = "tnum")
}
