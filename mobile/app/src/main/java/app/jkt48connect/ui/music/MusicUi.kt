package app.jkt48connect.ui.music

import android.graphics.Bitmap
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.MusicNote
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import app.jkt48connect.core.Images
import app.jkt48connect.core.MusicTrack
import app.jkt48connect.ui.theme.LocalColors
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** "3:07" dari milidetik. */
fun fmtClock(ms: Long): String {
    val s = (ms / 1000).coerceAtLeast(0)
    return "${s / 60}:${(s % 60).toString().padStart(2, '0')}"
}

/** Thumbnail YouTube 16:9 tanpa garis hitam (maxres → mq), dipotong persegi di tengah sebagai cover. */
private fun coverCandidates(t: MusicTrack): List<String> {
    val mq = t.cover.replace("/hqdefault.jpg", "/mqdefault.jpg")
    return listOf(t.coverLarge, mq, t.cover).filter { it.isNotEmpty() }.distinct()
}

/** Bitmap cover pertama yang berhasil dimuat (untuk tampilan & warna latar). */
@Composable
fun rememberCover(track: MusicTrack?, widthPx: Int): Bitmap? = produceState<Bitmap?>(null, track?.id, widthPx) {
    value = null
    if (track == null || widthPx <= 0) return@produceState
    for (u in coverCandidates(track)) {
        val b = Images.load(u, widthPx)
        if (b != null) {
            value = b
            return@produceState
        }
    }
}.value

/** Cover persegi dengan fade-in; placeholder not musik saat belum ada gambar. */
@Composable
fun MusicCover(track: MusicTrack?, modifier: Modifier = Modifier, radius: Dp = 14.dp) {
    val c = LocalColors.current
    var width by remember { mutableStateOf(0) }
    val bitmap = rememberCover(track, width)
    val image: ImageBitmap? = remember(bitmap) { bitmap?.asImageBitmap() }
    val alpha = remember(track?.id) { Animatable(0f) }
    LaunchedEffect(image) { if (image != null) alpha.animateTo(1f, tween(320)) }
    Box(
        modifier
            .graphicsLayer { clip = true; shape = RoundedCornerShape(radius) }
            .background(if (c.dark) Color(0xFF2A2326) else Color(0xFFE9E2D7))
            .onSizeChanged { if (it.width > 0) width = it.width },
        contentAlignment = Alignment.Center,
    ) {
        if (image != null) {
            Image(image, null, Modifier.fillMaxSize().graphicsLayer { this.alpha = alpha.value }, contentScale = ContentScale.Crop)
        } else {
            Image(Icons.Rounded.MusicNote, null, Modifier.size(28.dp), colorFilter = ColorFilter.tint(c.inkSoft.copy(alpha = 0.6f)))
        }
    }
}

/**
 * Warna dominan cover (rata-rata berbobot saturasi dari gambar kecil), untuk latar layar pemutar & mini player.
 * Dihitung sekali per lagu di thread latar.
 */
@Composable
fun rememberCoverColors(track: MusicTrack?): Pair<Color, Color>? = produceState<Pair<Color, Color>?>(null, track?.id) {
    if (track == null) return@produceState
    val bmp = coverCandidates(track).firstNotNullOfOrNull { Images.load(it, 96) } ?: return@produceState
    value = withContext(Dispatchers.Default) { dominant(bmp) }
}.value

private fun dominant(src: Bitmap): Pair<Color, Color> {
    val small = Bitmap.createScaledBitmap(src, 24, 24, true)
    var r = 0.0; var g = 0.0; var b = 0.0; var w = 0.0
    var r2 = 0.0; var g2 = 0.0; var b2 = 0.0; var w2 = 0.0
    val hsv = FloatArray(3)
    for (y in 0 until small.height) for (x in 0 until small.width) {
        val p = small.getPixel(x, y)
        android.graphics.Color.colorToHSV(p, hsv)
        val weight = (hsv[1] * hsv[2]).toDouble() + 0.05
        val pr = android.graphics.Color.red(p); val pg = android.graphics.Color.green(p); val pb = android.graphics.Color.blue(p)
        // Bagian atas & bawah gambar dirata-ratakan terpisah: dua warna untuk gradasi latar.
        if (y < small.height / 2) { r += pr * weight; g += pg * weight; b += pb * weight; w += weight } else { r2 += pr * weight; g2 += pg * weight; b2 += pb * weight; w2 += weight }
    }
    if (small != src) small.recycle()
    fun tone(rr: Double, gg: Double, bb: Double, ww: Double): Color {
        val col = android.graphics.Color.rgb((rr / ww).toInt(), (gg / ww).toInt(), (bb / ww).toInt())
        android.graphics.Color.colorToHSV(col, hsv)
        // Gelapkan & jaga saturasi supaya teks putih selalu terbaca.
        hsv[1] = (hsv[1] * 1.15f).coerceIn(0.25f, 0.85f)
        hsv[2] = hsv[2].coerceIn(0.22f, 0.5f)
        return Color(android.graphics.Color.HSVToColor(hsv))
    }
    return tone(r, g, b, w) to tone(r2, g2, b2, w2)
}

/** Ekualiser kecil yang bergoyang saat lagu berjalan (penanda lagu yang sedang diputar di daftar). */
@Composable
fun EqualizerBars(playing: Boolean, color: Color, modifier: Modifier = Modifier) {
    val t = rememberInfiniteTransition(label = "eq")
    val bars = listOf(520, 380, 640, 450).mapIndexed { i, d ->
        t.animateFloat(0.25f, 1f, infiniteRepeatable(tween(d), RepeatMode.Reverse), label = "eq$i")
    }
    Row(modifier.size(16.dp, 14.dp), horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.Bottom) {
        bars.forEach { a ->
            Box(
                Modifier
                    .width(2.5.dp)
                    .fillMaxHeight(if (playing) a.value else 0.3f)
                    .background(color, RoundedCornerShape(2.dp)),
            )
        }
    }
}
