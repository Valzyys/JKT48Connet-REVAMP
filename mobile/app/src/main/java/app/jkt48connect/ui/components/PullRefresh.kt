package app.jkt48connect.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.Velocity
import androidx.compose.ui.unit.dp
import app.jkt48connect.ui.LocalInsets
import app.jkt48connect.ui.glass.LocalBackdrop
import app.jkt48connect.ui.glass.glass
import app.jkt48connect.ui.glass.glassFill
import com.kyant.shapes.Capsule
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

/**
 * Tarik ke bawah untuk memuat ulang. Indikatornya lensa kaca bulat berisi logo piksel
 * yang ikut turun bersama tarikan dan berputar saat memuat.
 */
@Composable
fun PullRefresh(onRefresh: suspend () -> Unit, modifier: Modifier = Modifier, content: @Composable BoxScope.() -> Unit) {
    val scope = rememberCoroutineScope()
    val density = LocalDensity.current
    val threshold = with(density) { 80.dp.toPx() }
    val pull = remember { Animatable(0f) }
    var refreshing by remember { mutableStateOf(false) }
    val refresh by rememberUpdatedState(onRefresh)

    val connection = remember {
        object : NestedScrollConnection {
            override fun onPreScroll(available: Offset, source: NestedScrollSource): Offset {
                if (pull.value > 0f && available.y < 0f && !refreshing) {
                    val used = maxOf(available.y, -pull.value)
                    scope.launch { pull.snapTo(pull.value + used) }
                    return Offset(0f, used)
                }
                return Offset.Zero
            }

            override fun onPostScroll(consumed: Offset, available: Offset, source: NestedScrollSource): Offset {
                if (source == NestedScrollSource.UserInput && available.y > 0f && !refreshing) {
                    // Makin jauh ditarik, makin berat (rubber band).
                    val resist = 0.5f * (1f - (pull.value / (threshold * 2.2f)).coerceIn(0f, 0.85f))
                    scope.launch { pull.snapTo(pull.value + available.y * resist) }
                    return Offset(0f, available.y)
                }
                return Offset.Zero
            }

            override suspend fun onPreFling(available: Velocity): Velocity {
                if (refreshing || pull.value == 0f) return Velocity.Zero
                if (pull.value >= threshold) {
                    refreshing = true
                    pull.animateTo(threshold * 0.75f, spring(0.7f, 400f))
                    scope.launch {
                        try {
                            refresh()
                        } finally {
                            pull.animateTo(0f, spring(0.8f, 300f))
                            refreshing = false
                        }
                    }
                } else {
                    pull.animateTo(0f, spring(0.6f, 400f))
                }
                return Velocity.Zero
            }
        }
    }

    Box(modifier.fillMaxSize().nestedScroll(connection)) {
        Box(Modifier.fillMaxSize().graphicsLayer { translationY = pull.value * 0.6f }, content = content)
        if (pull.value > 1f || refreshing) {
            val spin = rememberInfiniteTransition(label = "spin").animateFloat(0f, 360f, infiniteRepeatable(tween(900, easing = LinearEasing)), label = "r")
            val p = (pull.value / threshold).coerceIn(0f, 1f)
            Box(
                Modifier
                    .align(Alignment.TopCenter)
                    .padding(top = LocalInsets.current.calculateTopPadding() - 30.dp)
                    .offset { IntOffset(0, (pull.value * 0.6f).roundToInt()) }
                    .graphicsLayer {
                        alpha = p
                        scaleX = 0.6f + 0.4f * p
                        scaleY = 0.6f + 0.4f * p
                        rotationZ = if (refreshing) spin.value else p * 270f
                    }
                    .size(44.dp)
                    .glass(LocalBackdrop.current, Capsule(), glassFill(), lensHeight = 10.dp, lensAmount = 20.dp),
                contentAlignment = Alignment.Center,
            ) {
                PixelLogo(18.dp)
            }
        }
    }
}
