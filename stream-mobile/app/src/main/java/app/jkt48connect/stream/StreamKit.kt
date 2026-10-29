package app.jkt48connect.stream

import android.graphics.Bitmap
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.*
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.*
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.*
import androidx.compose.ui.unit.*
import app.jkt48connect.stream.ui.glass.*
import app.jkt48connect.stream.ui.theme.*
import com.kyant.backdrop.backdrops.*
import org.json.JSONArray
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/*
 * Kit komponen Stream. Gayanya meniru aplikasi 2.6.1: judul besar, judul bagian dengan "Semua ›",
 * kartu kaca, dan tombol kaca. Semua layar memakai komponen ini supaya konsisten.
 */

fun displayDate(value: String): String = runCatching {
    DateTimeFormatter.ofPattern("d MMM yyyy · HH.mm 'WIB'", Locale.forLanguageTag("id-ID")).withZone(ZoneId.of("Asia/Jakarta")).format(Instant.parse(value))
}.getOrDefault(value)

fun JSONArray.rows() = (0 until length()).mapNotNull { optJSONObject(it) }

/** Nama platform live untuk ditampilkan di chip. */
fun platformName(platform: String): String = when (platform.lowercase(Locale.ROOT)) {
    "idn" -> "IDN"
    "showroom" -> "SHOWROOM"
    else -> "LIVE"
}

@Composable fun Label(text: String, size: Int = 15, strong: Boolean = false, color: Color = LocalColors.current.ink, modifier: Modifier = Modifier) {
    BasicText(text = text, modifier = modifier, style = if (strong) AppText.title(size.sp, color) else AppText.body(size.sp, color))
}

@Composable fun Micro(text: String, color: Color = LocalColors.current.inkSoft, modifier: Modifier = Modifier) {
    BasicText(text = text.uppercase(), modifier = modifier, style = AppText.micro(color, 10.sp))
}

/** Judul halaman besar (large title) dengan label kecil di atasnya. */
@Composable fun PageHeader(label: String, title: String, trailing: (@Composable () -> Unit)? = null) {
    val c = LocalColors.current
    Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 10.dp), verticalAlignment = Alignment.Bottom) {
        Column(Modifier.weight(1f)) {
            BasicText(text = title, maxLines = 1, style = AppText.title(34.sp, c.ink))
            if (label.isNotEmpty()) {
                Spacer(Modifier.height(4.dp))
                Micro(label)
            }
        }
        trailing?.invoke()
    }
}

/** Judul bagian dengan pil kaca "Semua ›" di kanan. */
@Composable fun SectionHead(label: String, title: String, onMore: (() -> Unit)? = null) {
    val c = LocalColors.current
    Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 24.dp, bottom = 10.dp), verticalAlignment = Alignment.Bottom) {
        Column(Modifier.weight(1f)) {
            Micro(label)
            Spacer(Modifier.height(2.dp))
            BasicText(text = title.uppercase(), maxLines = 1, style = AppText.display(26.sp, c.ink))
        }
        if (onMore != null) {
            LiquidButton(onMore, Modifier.height(34.dp)) {
                Label("Semua ›", 13, true, c.brand, Modifier.padding(horizontal = 12.dp))
            }
        }
    }
}

/** Kartu kaca. Isinya diberi jarak [spacing] dan padding [padding] di sekelilingnya. */
@Composable fun GlassCard(
    modifier: Modifier = Modifier,
    radius: Dp = 26.dp,
    padding: Dp = 18.dp,
    spacing: Dp = 12.dp,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier.fillMaxWidth().glass(LocalBackdrop.current, RoundedCornerShape(radius), glassFill(), blur = 3.dp).padding(padding),
        verticalArrangement = Arrangement.spacedBy(spacing),
        content = content,
    )
}

/** Garis rambut antar baris dalam grup, menjorok dari kiri seperti daftar iOS. */
@Composable fun GroupDivider() {
    Box(Modifier.padding(start = 16.dp).fillMaxWidth().height(0.5.dp).background(LocalColors.current.line))
}

@Composable fun ActionButton(text: String, primary: Boolean = false, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val c = LocalColors.current
    LiquidButton(onClick, modifier.fillMaxWidth().height(52.dp), tint = if (primary) c.brand else Color.Unspecified) {
        Label(text, 15, true, if (primary) Color.White else c.ink)
    }
}

@Composable fun Field(label: String, value: String, password: Boolean = false, onChange: (String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Micro(label)
        BasicTextField(
            value, onChange, Modifier.fillMaxWidth().glass(LocalBackdrop.current, RoundedCornerShape(16.dp), glassFill()).padding(16.dp),
            singleLine = true, textStyle = AppText.body(16.sp, LocalColors.current.ink), cursorBrush = SolidColor(LocalColors.current.brand),
            visualTransformation = if (password) PasswordVisualTransformation() else VisualTransformation.None,
        )
    }
}

@Composable fun Pill(text: String, background: Color, foreground: Color = Color.White) {
    Box(Modifier.clip(CircleShape).background(background).padding(horizontal = 10.dp, vertical = 5.dp)) {
        BasicText(text = text.uppercase(), style = AppText.micro(foreground, 10.sp))
    }
}

/** Titik merah berdenyut untuk penanda LIVE. */
@Composable fun LiveDot() {
    val alpha by rememberInfiniteTransition(label = "live-dot").animateFloat(
        initialValue = .35f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(900), RepeatMode.Reverse),
        label = "live-dot-alpha",
    )
    Box(Modifier.size(8.dp).clip(CircleShape).background(Color(0xFFFF2D55).copy(alpha = alpha)))
}

/** Gambar dari URL. Dimuat di latar, dan tampil ikon cadangan saat belum siap. */
@Composable fun Picture(url: String, modifier: Modifier = Modifier) {
    var bitmap by remember(url) { mutableStateOf<Bitmap?>(null) }
    LaunchedEffect(url) { if (url.isNotEmpty()) runCatching { StreamApi.bitmap(url) }.onSuccess { bitmap = it } }
    Box(modifier.background(LocalColors.current.surface)) {
        bitmap?.let { Image(it.asImageBitmap(), null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop) }
        if (bitmap == null) {
            Image(StreamIcons.TheaterComedy, null, Modifier.size(56.dp).align(Alignment.Center), colorFilter = ColorFilter.tint(LocalColors.current.inkSoft))
        }
    }
}

/** Logo merah berkaca di kiri atas. */
@Composable fun Mark(size: Dp = 40.dp) {
    Box(Modifier.size(size).glass(LocalBackdrop.current, RoundedCornerShape(size * .34f), Color(0xFFE52740).copy(alpha = .78f)), contentAlignment = Alignment.Center) {
        Image(StreamIcons.PlayArrow, "JKT48Connect Stream", Modifier.size(size * .62f), colorFilter = ColorFilter.tint(Color.White))
    }
}
