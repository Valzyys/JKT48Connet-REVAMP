// Komponen liquid glass. Tombol, tab, dan slider diadaptasi dari Backdrop Catalog
// (github.com/Kyant0/AndroidLiquidGlass, Apache License 2.0).
package app.jkt48connect.ui.glass

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.EaseOut
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.isSpecified
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.util.fastCoerceAtMost
import androidx.compose.ui.util.fastCoerceIn
import androidx.compose.ui.util.fastRoundToInt
import androidx.compose.ui.util.lerp
import androidx.compose.foundation.Image
import app.jkt48connect.ui.theme.AppText
import app.jkt48connect.ui.theme.LocalColors
import com.kyant.backdrop.Backdrop
import com.kyant.backdrop.backdrops.emptyBackdrop
import com.kyant.backdrop.backdrops.layerBackdrop
import com.kyant.backdrop.backdrops.rememberBackdrop
import com.kyant.backdrop.backdrops.rememberCombinedBackdrop
import com.kyant.backdrop.backdrops.rememberLayerBackdrop
import com.kyant.backdrop.drawBackdrop
import com.kyant.backdrop.effects.blur
import com.kyant.backdrop.effects.lens
import com.kyant.backdrop.effects.vibrancy
import com.kyant.backdrop.highlight.Highlight
import com.kyant.backdrop.highlight.HighlightStyle
import com.kyant.backdrop.isRenderEffectSupported
import com.kyant.backdrop.shadow.InnerShadow
import com.kyant.backdrop.shadow.Shadow
import com.kyant.shapes.Capsule
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sign
import kotlin.math.sin
import kotlin.math.tanh

/**
 * Kilau tepi kaca ala iOS 26/27: garis cahaya tipis & samar di tengah sisi atas (dan lebih redup di bawah) yang
 * memudar halus ke kiri-kanan, tanpa outline di sekeliling kaca dan tanpa sorot diagonal di pojok.
 */
private class SoftRimStyle(
    override val color: Color = Color.White,
    private val falloff: Float = 2.2f,
    private val spread: Float = 0.78f,
    /** false = atas & bawah, true = kiri & kanan. */
    private val sides: Boolean = false,
    /** Kecerahan, sama untuk kedua sisi (atas tidak lebih terang dari bawah). */
    private val level: Float = 0.42f,
) : HighlightStyle {
    override val blendMode: BlendMode get() = BlendMode.Plus

    override fun androidx.compose.ui.graphics.drawscope.DrawScope.createShader(shape: Shape, runtimeShaderCache: com.kyant.backdrop.RuntimeShaderCache): com.kyant.backdrop.RuntimeShader? {
        if (!com.kyant.backdrop.isRuntimeShaderSupported()) return null
        val shader = runtimeShaderCache.obtainRuntimeShader("JkcSoftRim", SOFT_RIM)
        val w = size.width
        val h = size.height
        val radii = when (val o = shape.createOutline(size, layoutDirection, this)) {
            is androidx.compose.ui.graphics.Outline.Rounded -> o.roundRect.let { floatArrayOf(it.topLeftCornerRadius.x, it.topRightCornerRadius.x, it.bottomRightCornerRadius.x, it.bottomLeftCornerRadius.x) }
            else -> floatArrayOf(0f, 0f, 0f, 0f)
        }
        shader.setFloatUniform("size", w, h)
        shader.setFloatUniform("cornerRadii", radii)
        shader.setColorUniform("color", color)
        shader.setFloatUniform("falloff", falloff)
        shader.setFloatUniform("spread", spread)
        shader.setFloatUniform("axis", if (sides) 1f else 0f)
        shader.setFloatUniform("level", level)
        return shader
    }
}

private const val SOFT_RIM = """
uniform float2 size;
uniform float4 cornerRadii;
layout(color) uniform half4 color;
uniform float falloff;
uniform float spread;
uniform float axis;
uniform float level;

float radiusAt(float2 coord, float4 radii) {
    if (coord.x >= 0.0) { return coord.y <= 0.0 ? radii.y : radii.z; }
    return coord.y <= 0.0 ? radii.x : radii.w;
}

float2 gradSdRoundedRect(float2 coord, float2 halfSize, float radius) {
    float2 cornerCoord = abs(coord) - (halfSize - float2(radius));
    if (cornerCoord.x >= 0.0 || cornerCoord.y >= 0.0) {
        return sign(coord) * normalize(max(cornerCoord, 0.0));
    }
    float gradX = step(cornerCoord.y, cornerCoord.x);
    return sign(coord) * float2(gradX, 1.0 - gradX);
}

half4 main(float2 coord) {
    float2 halfSize = size * 0.5;
    float2 c = coord - halfSize;
    float radius = radiusAt(c, cornerRadii);
    float gradRadius = min(radius * 1.5, min(halfSize.x, halfSize.y));
    float2 grad = gradSdRoundedRect(c, halfSize, gradRadius);
    // axis 0: hanya atas & bawah (normal vertikal); axis 1: hanya kiri & kanan. Pangkat tinggi supaya tipis.
    bool sides = axis > 0.5;
    float intensity = pow(abs(sides ? grad.x : grad.y), falloff);
    // Memudar sepanjang sisinya: terang di tengah, hilang (blur) sebelum mencapai pojok.
    float t = sides ? abs(c.y) / max(halfSize.y, 1.0) : abs(c.x) / max(halfSize.x, 1.0);
    float fade = 1.0 - smoothstep(spread * 0.25, spread, t);
    // Kedua sisi sama redupnya.
    return color * (intensity * fade * level);
}
"""

/**
 * Tanpa RuntimeShader (Android 12 ke bawah) library menggambar kilau sebagai garis penuh di sekeliling bentuk
 * (outline); di perangkat itu kilau dimatikan saja supaya kaca tetap tanpa outline.
 */
val RimOk: Boolean = com.kyant.backdrop.isRuntimeShaderSupported()

/** Kilau atas & bawah: wadah dan panel (tab bar, kartu, hero, kolom cari, mini player). */
val RimHighlight: Highlight = Highlight.Default.copy(
    width = Highlight.Default.width * 0.75f,
    blurRadius = Highlight.Default.blurRadius * 1.8f,
    alpha = 1f,
    style = SoftRimStyle(),
)

/** Kilau kiri & kanan: tombol, chip, pil tab, jempol slider & toggle. */
val SideHighlight: Highlight = RimHighlight.copy(style = SoftRimStyle(sides = true, spread = 0.9f))

/** Backdrop latar (ambient + isi halaman) untuk kaca yang mengapung di atasnya. */
val LocalBackdrop = staticCompositionLocalOf<Backdrop> { emptyBackdrop() }

/** Isian kaca. Di bawah Android 12 efek blur/lensa tidak tersedia, jadi isian dibuat lebih pekat agar tetap terbaca. */
@Composable
fun glassFill(): Color {
    val c = LocalColors.current
    return if (isRenderEffectSupported()) c.glass else c.card.copy(alpha = 0.94f)
}

/** Isian kaca bening untuk kaca yang mengapung (tab bar, tombol bilah atas): tipis supaya isi tetap tembus. */
@Composable
fun clearGlassFill(): Color {
    val c = LocalColors.current
    return when {
        !isRenderEffectSupported() -> c.card.copy(alpha = 0.94f)
        c.dark -> Color(0xFF1C1C1E).copy(alpha = 0.3f)
        else -> Color.White.copy(alpha = 0.28f)
    }
}

/** Kaca statis: blur + lensa + isian, dengan sorot tepi dan bayangan bawaan Backdrop. */
fun Modifier.glass(
    backdrop: Backdrop,
    shape: Shape,
    fill: Color,
    tint: Color = Color.Unspecified,
    blur: Dp = 4.dp,
    lensHeight: Dp = 16.dp,
    lensAmount: Dp = 32.dp,
    depth: Boolean = false,
    shadow: Boolean = true,
    layerBlock: (androidx.compose.ui.graphics.GraphicsLayerScope.() -> Unit)? = null,
    exportedBackdrop: com.kyant.backdrop.backdrops.LayerBackdrop? = null,
    rim: Highlight = RimHighlight,
): Modifier = drawBackdrop(
    backdrop = backdrop,
    shape = { shape },
    effects = {
        vibrancy()
        blur(blur.toPx())
        lens(lensHeight.toPx(), lensAmount.toPx(), depth)
    },
    highlight = { if (!RimOk) null else rim },
    shadow = if (shadow) ({ Shadow() }) else null,
    layerBlock = layerBlock,
    exportedBackdrop = exportedBackdrop,
    onDrawSurface = {
        if (tint.isSpecified) {
            drawRect(tint, blendMode = BlendMode.Hue)
            drawRect(tint.copy(alpha = 0.78f))
        }
        drawRect(fill)
    },
)

/**
 * Tombol kaca interaktif seperti catalog Backdrop: membesar saat ditekan, kilau putih mengikuti jari,
 * dan kaca meregang ke arah tarikan lalu membal kembali saat dilepas.
 */
@Composable
fun LiquidButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    backdrop: Backdrop = LocalBackdrop.current,
    shape: Shape = Capsule(),
    tint: Color = Color.Unspecified,
    fill: Color = if (tint.isSpecified) Color.Transparent else glassFill(),
    blur: Dp = 2.5.dp,
    lensHeight: Dp = 12.dp,
    lensAmount: Dp = 24.dp,
    contentPadding: PaddingValues = PaddingValues(horizontal = 16.dp),
    horizontalArrangement: Arrangement.Horizontal = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
    content: @Composable RowScope.() -> Unit,
) {
    val scope = rememberCoroutineScope()
    val highlight = remember(scope) { InteractiveHighlight(scope) }
    val haptic = LocalHapticFeedback.current
    Row(
        modifier
            .glass(
                backdrop, shape, fill, tint, blur, lensHeight, lensAmount,
                rim = SideHighlight,
                layerBlock = {
                    val w = size.width
                    val h = size.height
                    val progress = highlight.pressProgress
                    val scale = lerp(1f, 1f + 4.dp.toPx() / h, progress)
                    // Kaca ikut tertarik (dengan peredam tanh) dan meregang searah tarikan.
                    val maxOffset = size.minDimension
                    val offset = highlight.offset
                    translationX = maxOffset * tanh(0.05f * offset.x / maxOffset)
                    translationY = maxOffset * tanh(0.05f * offset.y / maxOffset)
                    val maxDragScale = 4.dp.toPx() / h
                    val angle = atan2(offset.y, offset.x)
                    scaleX = scale + maxDragScale * abs(cos(angle) * offset.x / size.maxDimension) * (w / h).fastCoerceAtMost(1f)
                    scaleY = scale + maxDragScale * abs(sin(angle) * offset.y / size.maxDimension) * (h / w).fastCoerceAtMost(1f)
                },
            )
            .clickable(interactionSource = null, indication = null, role = Role.Button) {
                haptic.performHapticFeedback(HapticFeedbackType.ContextClick)
                onClick()
            }
            .then(highlight.modifier)
            .then(highlight.gestureModifier)
            .padding(contentPadding),
        horizontalArrangement = horizontalArrangement,
        verticalAlignment = Alignment.CenterVertically,
        content = content,
    )
}

/** Tombol ikon kaca bulat. */
@Composable
fun LiquidIconButton(
    icon: ImageVector,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    size: Dp = 48.dp,
    iconSize: Dp = 22.dp,
    tint: Color = Color.Unspecified,
    iconColor: Color = if (tint.isSpecified) Color.White else LocalColors.current.ink,
    contentDescription: String? = null,
    backdrop: Backdrop = LocalBackdrop.current,
    fill: Color = if (tint.isSpecified) Color.Transparent else clearGlassFill(),
) {
    LiquidButton(
        onClick = onClick,
        modifier = modifier.size(size),
        backdrop = backdrop,
        tint = tint,
        fill = fill,
        contentPadding = PaddingValues(0.dp),
    ) {
        Image(icon, contentDescription, Modifier.size(iconSize), colorFilter = ColorFilter.tint(iconColor))
    }
}

data class TabItem(val label: String, val icon: ImageVector? = null)

/**
 * Tab kaca dengan pil yang bisa diseret (tab bar bawah dan segmented).
 * Pil membesar saat disentuh, mengikuti jari dengan pegas teredam, meregang sesuai kecepatan,
 * dan ikon di bawahnya tampil berwarna aksen lewat lensa pil.
 */
@Composable
fun LiquidTabs(
    items: List<TabItem>,
    selectedIndex: Int,
    onSelected: (Int) -> Unit,
    modifier: Modifier = Modifier,
    height: Dp = 64.dp,
    backdrop: Backdrop = LocalBackdrop.current,
    /** Segmen di dalam halaman: wadah kaca lebih pekat & pil kaca bertint merah. Tab bar: wadah bening & pil abu. */
    segmented: Boolean = false,
) {
    val c = LocalColors.current
    val accent = c.brand
    val container = if (segmented) glassFill() else clearGlassFill()
    val count = items.size
    val tabsBackdrop = rememberLayerBackdrop()
    val haptic = LocalHapticFeedback.current
    val currentOnSelected by rememberUpdatedState(onSelected)
    val compact = items.all { it.icon == null }

    BoxWithConstraints(modifier, contentAlignment = Alignment.CenterStart) {
        val density = LocalDensity.current
        val tabWidth = with(density) { (constraints.maxWidth.toFloat() - 8.dp.toPx()) / count }
        val offsetAnim = remember { Animatable(0f) }
        val panelOffset by remember(density) {
            derivedStateOf {
                val fraction = (offsetAnim.value / constraints.maxWidth).fastCoerceIn(-1f, 1f)
                with(density) { 4.dp.toPx() * fraction.sign * EaseOut.transform(abs(fraction)) }
            }
        }
        val scope = rememberCoroutineScope()
        var currentIndex by remember { mutableIntStateOf(selectedIndex) }
        // Tab bar: pil lebih pendek dan sedikit lebih lebar dari slot tab supaya lonjong (bukan bulat).
        val pillHeight = if (segmented) height - 8.dp else height - 18.dp
        val pillExtra = if (segmented) 0.dp else 6.dp
        val drag = remember(scope, count) {
            DampedDragAnimation(
                animationScope = scope,
                initialValue = selectedIndex.toFloat(),
                valueRange = 0f..(count - 1).toFloat(),
                visibilityThreshold = 0.001f,
                initialScale = 1f,
                // Saat ditekan pil meregang keluar dari tab bar seperti 2.6.1 (±78dp tinggi); pil tab bar lebih pendek,
                // jadi skala vertikalnya lebih besar dari horizontal supaya tingginya tetap sama.
                pressedScale = if (segmented) 78f / 56f else 1.3f,
                pressedScaleY = if (segmented) 78f / 56f else 78f / (height - 18.dp).value,
                onDragStarted = {},
                onDragStopped = {
                    val target = targetValue.fastRoundToInt().fastCoerceIn(0, count - 1)
                    currentIndex = target
                    animateToValue(target.toFloat())
                    scope.launch { offsetAnim.animateTo(0f, spring(1f, 300f, 0.5f)) }
                },
                onDrag = { _, amount ->
                    updateValue((targetValue + amount.x / tabWidth).fastCoerceIn(0f, (count - 1).toFloat()))
                    scope.launch { offsetAnim.snapTo(offsetAnim.value + amount.x) }
                },
            )
        }
        LaunchedEffect(selectedIndex) { currentIndex = selectedIndex }
        LaunchedEffect(drag) {
            snapshotFlow { currentIndex }.drop(1).collectLatest { index ->
                drag.animateToValue(index.toFloat())
                haptic.performHapticFeedback(HapticFeedbackType.SegmentTick)
                currentOnSelected(index)
            }
        }
        val highlight = remember(scope) {
            InteractiveHighlight(scope, position = { size, _ ->
                Offset((drag.value + 0.5f) * tabWidth + panelOffset, size.height / 2f)
            })
        }
        val tabScale = { lerp(1f, 1.15f, drag.pressProgress) }

        @Composable
        fun TabRow(tinted: Boolean, rowModifier: Modifier) {
            Row(rowModifier, verticalAlignment = Alignment.CenterVertically) {
                items.forEachIndexed { i, item ->
                    Column(
                        Modifier
                            .clip(Capsule())
                            .clickable(interactionSource = null, indication = null, role = Role.Tab) { currentIndex = i }
                            .fillMaxHeight()
                            .weight(1f)
                            .graphicsLayer { val s = tabScale(); scaleX = s; scaleY = s },
                        verticalArrangement = Arrangement.spacedBy(2.dp, Alignment.CenterVertically),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        val color = if (tinted) accent else c.ink
                        item.icon?.let { Image(it, null, Modifier.size(23.dp), colorFilter = ColorFilter.tint(color)) }
                        BasicText(
                            item.label,
                            style = if (compact) AppText.body(14.sp, color, 800) else AppText.body(10.sp, color, if (tinted) 800 else 600),
                            maxLines = 1,
                        )
                    }
                }
            }
        }

        // Panel kaca.
        TabRow(
            tinted = false,
            rowModifier = Modifier
                .graphicsLayer { translationX = panelOffset }
                .drawBackdrop(
                    backdrop = backdrop,
                    shape = { Capsule() },
                    // Kaca bening ala tab bar iOS 26: blur tipis, isi di belakang tetap terlihat & terbiaskan lensa.
                    effects = { vibrancy(); blur(3.dp.toPx()); lens(24.dp.toPx(), 24.dp.toPx()) },
                    highlight = { if (!RimOk) null else RimHighlight },
                    layerBlock = {
                        val scale = lerp(1f, 1f + 16.dp.toPx() / size.width, drag.pressProgress)
                        scaleX = scale
                        scaleY = scale
                    },
                    onDrawSurface = { drawRect(container) },
                )
                .then(highlight.modifier)
                .height(height)
                .fillMaxWidth()
                .padding(4.dp),
        )
        // Salinan ikon berwarna aksen (tak terlihat) yang hanya muncul lewat lensa pil.
        TabRow(
            tinted = true,
            rowModifier = Modifier
                .clearAndSetSemantics {}
                .alpha(0f)
                .layerBackdrop(tabsBackdrop)
                .graphicsLayer { translationX = panelOffset }
                .drawBackdrop(
                    backdrop = backdrop,
                    shape = { Capsule() },
                    effects = {
                        val p = drag.pressProgress
                        vibrancy(); blur(3.dp.toPx()); lens(24.dp.toPx() * p, 24.dp.toPx() * p)
                    },
                    highlight = { if (!RimOk) null else SideHighlight.copy(alpha = drag.pressProgress) },
                    onDrawSurface = { drawRect(container) },
                )
                .then(highlight.modifier)
                .height(pillHeight)
                .fillMaxWidth()
                .padding(horizontal = 4.dp)
                .graphicsLayer(colorFilter = ColorFilter.tint(accent)),
        )
        // Pil yang bisa diseret.
        Box(
            Modifier
                .padding(horizontal = 4.dp - pillExtra / 2)
                .graphicsLayer { translationX = drag.value * tabWidth + panelOffset }
                .then(highlight.gestureModifier)
                .then(drag.modifier)
                .drawBackdrop(
                    backdrop = rememberCombinedBackdrop(backdrop, tabsBackdrop),
                    shape = { Capsule() },
                    effects = {
                        val p = drag.pressProgress
                        lens(10.dp.toPx() * p, 14.dp.toPx() * p, chromaticAberration = true)
                    },
                    highlight = { if (!RimOk) null else SideHighlight.copy(alpha = 0.6f + 0.4f * drag.pressProgress) },
                    shadow = { Shadow(alpha = drag.pressProgress) },
                    innerShadow = { InnerShadow(radius = 8.dp * drag.pressProgress, alpha = drag.pressProgress) },
                    layerBlock = {
                        scaleX = drag.scaleX
                        scaleY = drag.scaleY
                        val v = drag.velocity / 10f
                        scaleX /= 1f - (v * 0.75f).fastCoerceIn(-0.2f, 0.2f)
                        scaleY *= 1f - (v * 0.25f).fastCoerceIn(-0.2f, 0.2f)
                    },
                    onDrawSurface = {
                        val p = drag.pressProgress
                        // Pil terpilih abu netral seperti tab bar iOS 26 (ikon & label yang merah, bukan pilnya).
                        val pill = when {
                            segmented -> accent.copy(alpha = if (c.dark) 0.30f else 0.16f)
                            c.dark -> Color.White.copy(alpha = 0.14f)
                            else -> Color.Black.copy(alpha = 0.07f)
                        }
                        drawRect(pill, alpha = 1f - p)
                        drawRect(Color.Black.copy(alpha = 0.03f * p))
                    },
                )
                .height(pillHeight)
                .width(with(density) { tabWidth.toDp() } + pillExtra),
        )
    }
}

/** Slider kaca: jempol berupa lensa yang membesar saat diseret dan membiaskan track di bawahnya. */
@Composable
fun LiquidSlider(
    value: () -> Float,
    onValueChange: (Float) -> Unit,
    onValueChangeFinished: (Float) -> Unit,
    modifier: Modifier = Modifier,
    backdrop: Backdrop = LocalBackdrop.current,
    accent: Color = LocalColors.current.brand,
    track: Color = Color.White.copy(alpha = 0.28f),
) {
    val trackBackdrop = rememberLayerBackdrop()
    BoxWithConstraints(modifier.fillMaxWidth().height(32.dp), contentAlignment = Alignment.CenterStart) {
        val trackWidth = constraints.maxWidth
        val scope = rememberCoroutineScope()
        var didDrag by remember { mutableStateOf(false) }
        val finished by rememberUpdatedState(onValueChangeFinished)
        val changed by rememberUpdatedState(onValueChange)
        val drag = remember(scope) {
            DampedDragAnimation(
                animationScope = scope,
                initialValue = value(),
                valueRange = 0f..1f,
                visibilityThreshold = 0.001f,
                initialScale = 1f,
                pressedScale = 1.5f,
                onDragStarted = { didDrag = false },
                onDragStopped = { if (didDrag) finished(targetValue) },
                onDrag = { _, amount ->
                    if (!didDrag) didDrag = amount.x != 0f
                    val next = (targetValue + amount.x / trackWidth).coerceIn(0f, 1f)
                    updateValue(next)
                    changed(next)
                },
            )
        }
        LaunchedEffect(drag) {
            snapshotFlow { value() }.collectLatest { v -> if (drag.pressProgress == 0f && drag.targetValue != v) drag.updateValue(v) }
        }
        Box(Modifier.layerBackdrop(trackBackdrop)) {
            Box(
                Modifier
                    .clip(Capsule())
                    .background(track)
                    .pointerInput(scope) {
                        detectTapGestures { pos ->
                            val target = (pos.x / trackWidth).coerceIn(0f, 1f)
                            drag.animateToValue(target)
                            finished(target)
                        }
                    }
                    .height(6.dp)
                    .fillMaxWidth()
            )
            Box(
                Modifier
                    .clip(Capsule())
                    .background(accent)
                    .height(6.dp)
                    .layout { measurable, constraints ->
                        val placeable = measurable.measure(constraints)
                        val width = (constraints.maxWidth * drag.progress).fastRoundToInt()
                        layout(width, placeable.height) { placeable.place(0, 0) }
                    }
            )
        }
        Box(
            Modifier
                .graphicsLayer {
                    translationX = (-size.width / 2f + trackWidth * drag.progress)
                        .fastCoerceIn(-size.width / 4f, trackWidth - size.width * 3f / 4f)
                }
                .then(drag.modifier)
                .drawBackdrop(
                    backdrop = rememberCombinedBackdrop(
                        backdrop,
                        rememberBackdrop(trackBackdrop) { drawBackdrop ->
                            val p = drag.pressProgress
                            scale(lerp(2f / 3f, 1f, p), lerp(0f, 1f, p)) { drawBackdrop() }
                        },
                    ),
                    shape = { Capsule() },
                    effects = {
                        val p = drag.pressProgress
                        blur(8.dp.toPx() * (1f - p))
                        lens(10.dp.toPx() * p, 14.dp.toPx() * p, chromaticAberration = true)
                    },
                    highlight = {
                        if (!RimOk) null else SideHighlight.copy(
                            width = Highlight.Ambient.width / 1.5f,
                            blurRadius = Highlight.Ambient.blurRadius / 1.5f,
                            alpha = drag.pressProgress,
                        )
                    },
                    shadow = { Shadow(radius = 4.dp, color = Color.Black.copy(alpha = 0.12f)) },
                    innerShadow = { InnerShadow(radius = 4.dp * drag.pressProgress, alpha = drag.pressProgress) },
                    layerBlock = {
                        scaleX = drag.scaleX
                        scaleY = drag.scaleY
                        val v = drag.velocity / 10f
                        scaleX /= 1f - (v * 0.75f).fastCoerceIn(-0.2f, 0.2f)
                        scaleY *= 1f - (v * 0.25f).fastCoerceIn(-0.2f, 0.2f)
                    },
                    onDrawSurface = { drawRect(Color.White.copy(alpha = 1f - drag.pressProgress)) },
                )
                .size(40.dp, 24.dp)
        )
    }
}

/**
 * Sakelar kaca (seperti LiquidToggle di catalog Backdrop): jempol putih berubah jadi lensa saat ditekan,
 * bisa diseret, dan warna track mengikuti posisinya. Ketuk untuk membalik.
 */
@Composable
fun LiquidToggle(
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
    backdrop: Backdrop = LocalBackdrop.current,
    accent: Color = LocalColors.current.brand,
) {
    val c = LocalColors.current
    val offTrack = if (c.dark) Color(0xFF3A3A40) else Color(0xFFD5D5DB)
    val trackBackdrop = rememberLayerBackdrop()
    val travel = with(LocalDensity.current) { 20.dp.toPx() }
    val scope = rememberCoroutineScope()
    val haptic = LocalHapticFeedback.current
    val changed by rememberUpdatedState(onCheckedChange)
    var didDrag by remember { mutableStateOf(false) }
    val drag = remember(scope) {
        DampedDragAnimation(
            animationScope = scope,
            initialValue = if (checked) 1f else 0f,
            valueRange = 0f..1f,
            visibilityThreshold = 0.001f,
            initialScale = 1f,
            pressedScale = 1.5f,
            onDragStarted = { didDrag = false },
            onDragStopped = {
                val next = if (didDrag) targetValue >= 0.5f else targetValue < 0.5f
                animateToValue(if (next) 1f else 0f)
                haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                changed(next)
            },
            onDrag = { _, amount ->
                if (amount.x != 0f) didDrag = true
                updateValue((targetValue + amount.x / travel).coerceIn(0f, 1f))
            },
        )
    }
    LaunchedEffect(checked) { if (drag.pressProgress == 0f) drag.animateToValue(if (checked) 1f else 0f) }
    Box(modifier.size(64.dp, 28.dp), contentAlignment = Alignment.CenterStart) {
        Box(
            Modifier
                .layerBackdrop(trackBackdrop)
                .clip(Capsule())
                .drawWithTrack { androidx.compose.ui.graphics.lerp(offTrack, accent, drag.progress.fastCoerceIn(0f, 1f)) }
                .size(64.dp, 28.dp)
        )
        Box(
            Modifier
                .padding(horizontal = 2.dp)
                .graphicsLayer { translationX = travel * drag.progress }
                .then(drag.modifier)
                .drawBackdrop(
                    backdrop = rememberCombinedBackdrop(
                        backdrop,
                        rememberBackdrop(trackBackdrop) { drawBackdrop ->
                            val p = drag.pressProgress
                            scale(lerp(2f / 3f, 0.75f, p), lerp(0f, 0.75f, p)) { drawBackdrop() }
                        },
                    ),
                    shape = { Capsule() },
                    effects = {
                        val p = drag.pressProgress
                        blur(8.dp.toPx() * (1f - p))
                        lens(5.dp.toPx() * p, 10.dp.toPx() * p, chromaticAberration = true)
                    },
                    highlight = { if (!RimOk) null else SideHighlight.copy(width = Highlight.Ambient.width / 1.5f, blurRadius = Highlight.Ambient.blurRadius / 1.5f, alpha = drag.pressProgress) },
                    shadow = { Shadow(radius = 4.dp, color = Color.Black.copy(alpha = 0.1f)) },
                    innerShadow = { InnerShadow(radius = 4.dp * drag.pressProgress, alpha = drag.pressProgress) },
                    layerBlock = {
                        scaleX = drag.scaleX
                        scaleY = drag.scaleY
                        val v = drag.velocity / 50f
                        scaleX /= 1f - (v * 0.75f).fastCoerceIn(-0.2f, 0.2f)
                        scaleY *= 1f - (v * 0.25f).fastCoerceIn(-0.2f, 0.2f)
                    },
                    onDrawSurface = { drawRect(Color.White.copy(alpha = 1f - drag.pressProgress)) },
                )
                .size(40.dp, 24.dp)
        )
    }
}

// Warna track dibaca saat menggambar (bukan saat komposisi) supaya animasi seret tidak merekomposisi.
private fun Modifier.drawWithTrack(color: () -> Color) = this.then(
    Modifier.drawBehind { drawRect(color()) }
)
