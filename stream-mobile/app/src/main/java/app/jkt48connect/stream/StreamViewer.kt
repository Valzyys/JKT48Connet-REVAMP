package app.jkt48connect.stream

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animate
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.gestures.rememberTransformableState
import androidx.compose.foundation.gestures.transformable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.util.lerp
import app.jkt48connect.stream.ui.theme.AppText
import kotlinx.coroutines.launch
import kotlin.math.abs

/**
 * Penampil gambar layar penuh (pola penampil cuplikan 2.6.1): latar hitam, geser kiri/kanan, filmstrip,
 * ketuk dua kali / cubit untuk zoom, ketuk untuk menyembunyikan kontrol, geser ke bawah untuk menutup.
 * Dipakai untuk cuplikan live, poster theater, foto replay, dan foto lineup.
 */
@Composable
fun ImageViewer(urls: List<String>, start: Int, title: String, caption: String) {
    val nav = LocalNav.current
    val scope = rememberCoroutineScope()
    val pager = rememberPagerState(start.coerceIn(0, (urls.size - 1).coerceAtLeast(0))) { urls.size }
    val strip = rememberLazyListState((start - 2).coerceAtLeast(0))
    var chrome by remember { mutableStateOf(true) }
    var zoomed by remember { mutableStateOf(false) }
    val drag = remember { Animatable(0f) }
    val dismissPx = with(LocalDensity.current) { 140.dp.toPx() }
    val fade = (abs(drag.value) / (dismissPx * 2.5f)).coerceIn(0f, 1f)
    LaunchedEffect(pager.currentPage) { if (urls.size > 1) strip.animateScrollToItem((pager.currentPage - 2).coerceAtLeast(0)) }

    Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 1f - fade))) {
        HorizontalPager(
            pager,
            Modifier
                .fillMaxSize()
                .pointerInput(zoomed) {
                    if (zoomed) return@pointerInput
                    detectVerticalDragGestures(
                        onDragEnd = { scope.launch { if (abs(drag.value) > dismissPx) nav.pop() else drag.animateTo(0f, spring(0.75f, 400f)) } },
                        onDragCancel = { scope.launch { drag.animateTo(0f, spring(0.75f, 400f)) } },
                    ) { change, amount ->
                        change.consume()
                        scope.launch { drag.snapTo(drag.value + amount) }
                    }
                }
                .graphicsLayer {
                    translationY = drag.value
                    val k = 1f - fade * 0.2f
                    scaleX = k
                    scaleY = k
                },
            pageSpacing = 16.dp,
            beyondViewportPageCount = 1,
            userScrollEnabled = !zoomed,
        ) { page ->
            ZoomImage(urls[page], resetKey = pager.settledPage, onZoomChange = { if (page == pager.currentPage) zoomed = it }, onTap = { chrome = !chrome })
        }

        AnimatedVisibility(chrome && drag.value == 0f, enter = fadeIn(tween(180)), exit = fadeOut(tween(180))) {
            Box(Modifier.fillMaxSize()) {
                Box(Modifier.fillMaxWidth().height(150.dp).background(Brush.verticalGradient(listOf(Color.Black.copy(alpha = 0.7f), Color.Transparent))))
                Row(Modifier.statusBarsPadding().padding(14.dp).fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(46.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.16f)).pressable({ nav.pop() }), contentAlignment = Alignment.Center) {
                        Image(StreamIcons.Close, "Tutup", Modifier.size(22.dp), colorFilter = ColorFilter.tint(Color.White))
                    }
                    Gap(12.dp)
                    Column(Modifier.weight(1f)) {
                        Txt(title.ifEmpty { "Gambar" }, AppText.body(15.sp, Color.White, 800), maxLines = 1)
                        Txt(caption.uppercase(), AppText.micro(Color.White.copy(alpha = 0.6f), 9.sp), maxLines = 1)
                    }
                    if (urls.size > 1) {
                        Gap(10.dp)
                        Box(Modifier.background(Color.White.copy(alpha = 0.16f), CircleShape).padding(horizontal = 14.dp, vertical = 9.dp)) {
                            Txt("${pager.currentPage + 1} / ${urls.size}", AppText.mono(13.sp, Color.White, FontWeight.SemiBold))
                        }
                    }
                }
                if (urls.size > 1) {
                    Column(
                        Modifier
                            .align(Alignment.BottomCenter)
                            .fillMaxWidth()
                            .background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = 0.75f))))
                            .navigationBarsPadding()
                            .padding(top = 36.dp, bottom = 14.dp),
                    ) {
                        LazyRow(state = strip, contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            itemsIndexed(urls) { i, url ->
                                val selected = i == pager.currentPage
                                val k by animateFloatAsState(if (selected) 1f else 0.86f, spring(0.7f, 500f), label = "thumb")
                                Picture(
                                    url,
                                    Modifier
                                        .size(54.dp, 72.dp)
                                        .graphicsLayer {
                                            scaleX = k
                                            scaleY = k
                                            alpha = if (selected) 1f else 0.55f
                                        }
                                        .clip(RoundedCornerShape(12.dp))
                                        .then(if (selected) Modifier.border(2.dp, Color.White, RoundedCornerShape(12.dp)) else Modifier)
                                        .pressable({ scope.launch { pager.animateScrollToPage(i) } }),
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

/** Satu gambar: cubit untuk zoom, ketuk dua kali untuk zoom di titik itu, geser hanya saat di-zoom. */
@Composable
private fun ZoomImage(url: String, resetKey: Int, onZoomChange: (Boolean) -> Unit, onTap: () -> Unit) {
    val scope = rememberCoroutineScope()
    var scale by remember { mutableFloatStateOf(1f) }
    var offset by remember { mutableStateOf(Offset.Zero) }
    var size by remember { mutableStateOf(IntSize.Zero) }
    LaunchedEffect(resetKey) {
        scale = 1f
        offset = Offset.Zero
    }
    fun clamp(o: Offset, s: Float): Offset {
        val mx = size.width * (s - 1f) / 2f
        val my = size.height * (s - 1f) / 2f
        return Offset(o.x.coerceIn(-mx, mx), o.y.coerceIn(-my, my))
    }
    val state = rememberTransformableState { _, zoom, pan, _ ->
        val s = (scale * zoom).coerceIn(1f, 5f)
        offset = if (s == 1f) Offset.Zero else clamp(offset + pan, s)
        scale = s
        onZoomChange(s > 1f)
    }
    var bitmap by remember(url) { mutableStateOf<ImageBitmap?>(null) }
    var failed by remember(url) { mutableStateOf(false) }
    LaunchedEffect(url) {
        val b = runCatching { StreamApi.bitmap(url) }.getOrNull()
        if (b == null) failed = true else bitmap = b.asImageBitmap()
    }
    Box(
        Modifier
            .fillMaxSize()
            .onSizeChanged { size = it }
            .pointerInput(Unit) {
                detectTapGestures(
                    onTap = { onTap() },
                    onDoubleTap = { p ->
                        scope.launch {
                            val target = if (scale > 1f) 1f else 2.5f
                            val to = if (target == 1f) Offset.Zero else clamp((Offset(size.width / 2f, size.height / 2f) - p) * (target - 1f), target)
                            val fromScale = scale
                            val fromOffset = offset
                            onZoomChange(target > 1f)
                            animate(0f, 1f, animationSpec = spring(0.85f, 400f)) { t, _ ->
                                scale = lerp(fromScale, target, t)
                                offset = androidx.compose.ui.geometry.lerp(fromOffset, to, t)
                            }
                        }
                    },
                )
            }
            .transformable(state, canPan = { scale > 1f }),
        contentAlignment = Alignment.Center,
    ) {
        val b = bitmap
        if (b == null && failed) Txt("Gambar belum bisa dimuat.", AppText.body(14.sp, Color.White.copy(alpha = 0.7f)))
        else if (b == null) Spinner(color = Color.White)
        else Image(
            b,
            null,
            Modifier.fillMaxSize().graphicsLayer {
                scaleX = scale
                scaleY = scale
                translationX = offset.x
                translationY = offset.y
            },
            contentScale = ContentScale.Fit,
        )
    }
}
