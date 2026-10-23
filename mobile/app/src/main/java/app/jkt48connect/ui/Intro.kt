package app.jkt48connect.ui

import android.os.Build
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.lerp
import androidx.compose.ui.unit.sp
import app.jkt48connect.ui.components.PixelLogo
import app.jkt48connect.ui.components.SignalBars
import app.jkt48connect.ui.components.Txt
import app.jkt48connect.ui.theme.AppText
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Intro saat aplikasi dibuka (±1,9 detik): salib piksel dari splash sistem mengecil sambil memancarkan
 * gelombang sinyal, wordmark naik dari balik garis, lalu layar merah terangkat seperti tirai panggung.
 * Ketuk untuk melewati.
 */
@Composable
fun Intro(onDone: () -> Unit) {
    val logo = remember { Animatable(0f) }
    val word = remember { Animatable(0f) }
    val tag = remember { Animatable(0f) }
    val curtain = remember { Animatable(0f) }
    val scope = androidx.compose.runtime.rememberCoroutineScope()
    fun finish() = scope.launch {
        curtain.animateTo(1f, tween(520, easing = FastOutSlowInEasing))
        onDone()
    }
    LaunchedEffect(Unit) {
        // Android 12+ sudah menampilkan salib piksel di splash sistem, jadi intro melanjutkannya;
        // di versi lama pikselnya dirakit dulu.
        delay(if (Build.VERSION.SDK_INT >= 31) 220 else 900)
        launch { logo.animateTo(1f, spring(0.72f, 180f)) }
        delay(180)
        launch { word.animateTo(1f, tween(560, easing = FastOutSlowInEasing)) }
        delay(320)
        tag.animateTo(1f, tween(420))
        delay(420)
        if (curtain.value == 0f) finish()
    }
    Box(
        Modifier
            .fillMaxSize()
            .graphicsLayer { translationY = -size.height * curtain.value }
            .clip(RoundedCornerShape(bottomStart = 48.dp * curtain.value, bottomEnd = 48.dp * curtain.value))
            .background(Brush.linearGradient(listOf(Color(0xFFF0304A), Color(0xFFE1243A), Color(0xFFA5122A)), Offset.Zero, Offset(900f, 2200f)))
            .pointerInput(Unit) { detectTapGestures { if (curtain.value == 0f && !curtain.isRunning) finish() } },
        contentAlignment = Alignment.Center,
    ) {
        // Gelombang sinyal yang memancar dari logo.
        Canvas(Modifier.fillMaxSize()) {
            val p = logo.value.coerceIn(0f, 1.2f)
            for (i in 0..2) {
                val k = (p - i * 0.18f).coerceIn(0f, 1f)
                if (k <= 0f) continue
                drawCircle(
                    Color.White.copy(alpha = 0.22f * (1f - k)),
                    radius = 80.dp.toPx() + size.minDimension * 0.7f * k,
                    center = Offset(size.width / 2, size.height / 2 - 40.dp.toPx() * logo.value),
                    style = Stroke(1.5.dp.toPx()),
                )
            }
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            PixelLogo(
                lerp(128.dp, 72.dp, logo.value.coerceIn(0f, 1f)),
                Modifier.graphicsLayer { translationY = -16.dp.toPx() * logo.value },
                color = Color.White,
                assemble = Build.VERSION.SDK_INT < 31,
            )
            Box(Modifier.padding(top = 10.dp).clipToBounds()) {
                Row(Modifier.graphicsLayer { translationY = size.height * (1f - word.value); alpha = word.value }) {
                    Txt("JKT48", AppText.display(44.sp, Color.White))
                    Txt("CONNECT", AppText.display(44.sp, Color(0xFF1A0508)))
                }
            }
            Row(
                Modifier.padding(top = 8.dp).graphicsLayer { alpha = tag.value; translationY = 8.dp.toPx() * (1f - tag.value) },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                SignalBars(color = Color.White, height = 11.dp)
                Txt("FAN SIGNAL · LIVE · THEATER · REPLAY", AppText.micro(Color.White.copy(alpha = 0.8f), 9.5.sp))
            }
        }
        Box(Modifier.align(Alignment.BottomCenter).padding(bottom = 48.dp).graphicsLayer { alpha = tag.value * 0.7f }) {
            Txt("FAN PLATFORM · BUKAN APLIKASI RESMI", AppText.micro(Color.White, 8.5.sp))
        }
    }
}
