package app.jkt48connect.ui.music

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Image
import androidx.compose.foundation.basicMarquee
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.BasicText
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.FastForward
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.jkt48connect.core.Music
import app.jkt48connect.ui.components.pressable
import app.jkt48connect.ui.glass.LocalBackdrop
import app.jkt48connect.ui.glass.clearGlassFill
import app.jkt48connect.ui.glass.glass
import app.jkt48connect.ui.theme.AppText
import app.jkt48connect.ui.theme.LocalColors
import com.kyant.shapes.Capsule
import kotlinx.coroutines.delay

/**
 * Mini player kaca yang mengapung di atas tab bar: cover, judul berjalan, putar/jeda, berikutnya, dan garis progres
 * tipis di tepi bawah kapsul. Ketuk untuk membuka layar "Sedang diputar".
 */
@Composable
fun MiniPlayer(modifier: Modifier = Modifier) {
    val t = Music.current ?: return
    val c = LocalColors.current
    var progress by remember { mutableFloatStateOf(0f) }
    LaunchedEffect(t.id) {
        while (true) {
            val d = Music.durationMs
            progress = if (d > 0) (Music.position().toFloat() / d).coerceIn(0f, 1f) else 0f
            delay(250)
        }
    }
    Row(
        modifier
            .fillMaxWidth()
            .height(62.dp)
            .glass(LocalBackdrop.current, Capsule(), clearGlassFill(), blur = 3.dp, lensHeight = 18.dp, lensAmount = 24.dp)
            .drawWithContent {
                drawContent()
                // Progres di tepi bawah kapsul (tipis, merah brand).
                val inset = size.height / 2
                val y = size.height - 2.5.dp.toPx()
                val w = size.width - inset * 2
                drawLine(c.brand.copy(alpha = 0.18f), Offset(inset, y), Offset(inset + w, y), 2.5.dp.toPx(), StrokeCap.Round)
                drawLine(c.brand, Offset(inset, y), Offset(inset + w * progress, y), 2.5.dp.toPx(), StrokeCap.Round)
            }
            .pressable({ Music.nowPlayingOpen = true }, 0.98f)
            .padding(start = 9.dp, end = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        MusicCover(t, Modifier.size(44.dp), 22.dp)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            BasicText(t.title, style = AppText.body(14.5.sp, c.ink, 750), maxLines = 1, modifier = Modifier.basicMarquee(iterations = Int.MAX_VALUE, initialDelayMillis = 3000))
            BasicText(t.artist.ifEmpty { "JKT48" }, style = AppText.body(12.sp, c.inkSoft, 600), maxLines = 1)
        }
        Box(Modifier.size(46.dp).pressable({ Music.toggle() }, 0.85f), contentAlignment = Alignment.Center) {
            AnimatedContent(
                Music.playing,
                transitionSpec = { (scaleIn(spring(0.55f, 420f), 0.5f) + fadeIn(tween(120))) togetherWith (scaleOut(tween(120), 0.5f) + fadeOut(tween(90))) },
                label = "miniPlay",
            ) { p -> Image(if (p) Icons.Rounded.Pause else Icons.Rounded.PlayArrow, if (p) "Jeda" else "Putar", Modifier.size(30.dp), colorFilter = ColorFilter.tint(c.ink)) }
        }
        Box(Modifier.size(42.dp).pressable({ Music.next() }, 0.85f), contentAlignment = Alignment.Center) {
            Image(Icons.Rounded.FastForward, "Berikutnya", Modifier.size(26.dp), colorFilter = ColorFilter.tint(c.ink))
        }
        Spacer(Modifier.padding(end = 2.dp))
    }
}
