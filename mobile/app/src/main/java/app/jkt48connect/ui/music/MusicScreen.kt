package app.jkt48connect.ui.music

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.SizeTransform
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.GraphicEq
import androidx.compose.material.icons.rounded.MusicNote
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Shuffle
import androidx.compose.material.icons.rounded.SkipNext
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.jkt48connect.core.Api
import app.jkt48connect.core.ApiException
import app.jkt48connect.core.Fetch
import app.jkt48connect.core.Music
import app.jkt48connect.core.MusicSearch
import app.jkt48connect.core.MusicTrack
import app.jkt48connect.ui.LocalInsets
import app.jkt48connect.ui.components.ErrorRetry
import app.jkt48connect.ui.components.Micro
import app.jkt48connect.ui.components.PageHeader
import app.jkt48connect.ui.components.SectionHead
import app.jkt48connect.ui.components.Skeleton
import app.jkt48connect.ui.components.Txt
import app.jkt48connect.ui.components.glassCard
import app.jkt48connect.ui.components.glassRim
import app.jkt48connect.ui.components.pressable
import app.jkt48connect.ui.components.staggerIn
import app.jkt48connect.ui.glass.LiquidButton
import app.jkt48connect.ui.rememberLoad
import app.jkt48connect.ui.theme.AppText
import app.jkt48connect.ui.theme.LocalColors
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.graphics.lerp
import app.jkt48connect.ui.glass.LiquidIconButton
import app.jkt48connect.ui.glass.LocalBackdrop
import app.jkt48connect.ui.glass.glass
import app.jkt48connect.ui.glass.glassFill
import com.kyant.backdrop.backdrops.layerBackdrop
import com.kyant.backdrop.backdrops.rememberLayerBackdrop
import com.kyant.backdrop.isRenderEffectSupported
import com.kyant.shapes.Capsule
import com.kyant.shapes.RoundedRectangle
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay

/** Pilihan cepat: lagu-lagu JKT48 yang sering dicari. */
private val QUICK = listOf("Heavy Rotation", "River", "Fortune Cookie", "Aitakatta", "Flying Get", "Rapsodi", "Pajama Drive", "Sakura no Hanabiratachi")

/** Halaman Musik: cari lagu JKT48 (atau artis lain), putar dengan lirik sinkron, dan lanjut di latar. */
@Composable
fun MusicScreen() {
    val c = LocalColors.current
    val context = LocalContext.current
    val focus = LocalFocusManager.current
    var query by rememberSaveable { mutableStateOf("") }
    var submitted by rememberSaveable { mutableStateOf("JKT48") }
    LaunchedEffect(query) {
        val q = query.trim()
        if (q.isEmpty()) submitted = "JKT48" else if (q.length >= 2) {
            delay(550)
            submitted = q
        }
    }
    val result = rememberLoad(submitted) { searchMusic(submitted, it) }
    val tracks = result.data?.tracks
    val current = Music.current
    val feature = current ?: tracks?.firstOrNull()
    // Latar halaman sendiri (cover blur + bulatan warna cover) yang dibiaskan semua kaca di halaman ini.
    val musicBg = rememberLayerBackdrop()

    Box(Modifier.fillMaxSize()) {
    MusicAmbient(feature, Modifier.fillMaxSize().layerBackdrop(musicBg))
    CompositionLocalProvider(LocalBackdrop provides musicBg) {
    LazyColumn(state = rememberLazyListState(), contentPadding = LocalInsets.current) {
        item { PageHeader("Lirik bergerak · putar di latar", "Musik") }
        item { MusicHero(current, tracks, onPlay = { list -> Music.play(context, list, 0); Music.nowPlayingOpen = true }) }
        item {
            SearchField(
                query,
                onChange = { query = it },
                onSubmit = { if (query.trim().length >= 2) submitted = query.trim(); focus.clearFocus() },
                modifier = Modifier.padding(16.dp, 18.dp, 16.dp, 0.dp),
            )
        }
        item {
            Row(Modifier.horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                QUICK.forEach { q ->
                    val on = submitted.equals(q, true) || query.trim().equals(q, true)
                    LiquidButton(
                        onClick = { query = q; submitted = q; focus.clearFocus() },
                        modifier = Modifier.height(36.dp),
                        tint = if (on) c.brand else Color.Unspecified,
                        contentPadding = PaddingValues(horizontal = 14.dp),
                    ) { Txt(q, AppText.body(13.sp, if (on) Color.White else c.ink, 700)) }
                }
            }
        }
        val home = submitted == "JKT48"
        if (home && tracks != null && tracks.size > 2) {
            item { SectionHead("Paling sering diputar", "Single populer") }
            item { PopularCarousel(tracks.take(6)) { i -> Music.play(context, tracks, i); Music.nowPlayingOpen = true } }
        }
        if (query.isBlank() && Music.history.isNotEmpty()) {
            item { SectionHead("Baru diputar", "Terakhir") }
            item {
                LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    itemsIndexed(Music.history, key = { _, t -> t.id }) { i, t ->
                        Column(Modifier.width(132.dp).pressable({ Music.play(context, Music.history, i); Music.nowPlayingOpen = true })) {
                            MusicCover(t, Modifier.size(132.dp), 18.dp)
                            Spacer(Modifier.height(8.dp))
                            Txt(t.title, AppText.body(13.sp, c.ink, 700), maxLines = 1)
                            Txt(t.artist, AppText.body(12.sp, c.inkSoft), maxLines = 1)
                        }
                    }
                }
            }
        }
        if (home) {
            item { SectionHead("Grup saudari", "Jelajahi") }
            item { ExploreGrid { name -> query = name; submitted = name; focus.clearFocus() } }
        }
        item {
            SectionHead(
                if (home) "Semua pilihan" else "Hasil pencarian",
                if (home) "Lagu JKT48" else "“$submitted”",
                onMore = tracks?.takeIf { it.size > 1 }?.let { list -> { Music.play(context, list.shuffled(), 0); Music.nowPlayingOpen = true } },
            )
        }
        when {
            result.error != null && tracks == null -> item { ErrorRetry(result.error!!, { result.run(true) }) }
            tracks == null -> items(6) { Skeleton(Modifier.padding(16.dp, 0.dp, 16.dp, 10.dp).fillMaxWidth().height(68.dp), 18.dp) }
            tracks.isEmpty() -> item {
                Column(Modifier.padding(16.dp).fillMaxWidth().glass(LocalBackdrop.current, RoundedRectangle(26.dp), glassFill(), lensHeight = 16.dp, lensAmount = 32.dp).padding(28.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Image(Icons.Rounded.MusicNote, null, Modifier.size(30.dp), colorFilter = ColorFilter.tint(c.inkSoft))
                    Spacer(Modifier.height(10.dp))
                    Txt("Lagu tidak ditemukan. Coba judul lain atau potongan lirik.", AppText.body(14.sp, c.inkSoft))
                }
            }
            else -> {
                result.data?.identified?.takeIf { it.isNotEmpty() && submitted != "JKT48" }?.let { idf ->
                    item { Micro("Dikenali: $idf", Modifier.padding(20.dp, 0.dp, 20.dp, 10.dp)) }
                }
                itemsIndexed(tracks, key = { _, t -> t.id }) { i, t ->
                    TrackRow(t, i, Modifier.padding(16.dp, 0.dp, 16.dp, 8.dp).staggerIn(i, 35)) {
                        Music.play(context, tracks, i)
                        Music.nowPlayingOpen = true
                    }
                }
            }
        }
    }
    }
    }
}

/**
 * Latar halaman Musik: cover lagu (sedang diputar / pilihan) diburamkan besar di bagian atas, lalu bulatan warna
 * dominannya. Inilah yang dibiaskan lensa liquid glass, jadi kaca tampak hidup dan ikut berganti warna per lagu.
 */
@Composable
private fun MusicAmbient(feature: MusicTrack?, modifier: Modifier) {
    val c = LocalColors.current
    val colors = rememberCoverColors(feature)
    val a0 = colors?.first ?: c.brand
    val b0 = colors?.second ?: Color(0xFFFF2D55)
    // Warna dominan sengaja gelap (untuk teks putih); di tema terang dicerahkan supaya tidak kusam.
    val a by animateColorAsState(if (c.dark) a0 else lerp(a0, Color.White, 0.2f), tween(900), label = "ambA")
    val b by animateColorAsState(if (c.dark) b0 else lerp(b0, Color.White, 0.25f), tween(900), label = "ambB")
    Box(modifier.background(c.bg)) {
        MusicCover(
            feature,
            Modifier.fillMaxWidth().fillMaxHeight(0.55f).graphicsLayer { alpha = if (c.dark) 0.6f else 0.38f }.blur(56.dp),
            0.dp,
        )
        Canvas(Modifier.fillMaxSize()) {
            val w = size.width
            val h = size.height
            drawRect(Brush.verticalGradient(0f to Color.Transparent, 0.22f to Color.Transparent, 0.56f to c.bg))
            fun blob(x: Float, y: Float, r: Float, color: Color, al: Float) = drawCircle(
                Brush.radialGradient(0f to color.copy(alpha = al), 0.45f to color.copy(alpha = al * 0.8f), 1f to color.copy(alpha = 0f), center = Offset(x, y), radius = r),
                r, Offset(x, y),
            )
            blob(w * 0.05f, h * 0.5f, w * 0.85f, a, if (c.dark) 0.5f else 0.34f)
            blob(w * 0.98f, h * 0.68f, w * 0.8f, b, if (c.dark) 0.45f else 0.3f)
            blob(w * 0.3f, h * 0.98f, w * 0.9f, c.brand, if (c.dark) 0.3f else 0.16f)
        }
    }
}

/**
 * Pencarian. Tanpa kata kunci ("JKT48"): daftar pilihan berisi lagu-lagu JKT48 yang berbeda (hasil teratas tiap judul
 * populer), bukan beberapa versi dari satu lagu. Kata kunci tidak valid (400) tampil sebagai "tidak ditemukan".
 */
private suspend fun searchMusic(q: String, f: Fetch): MusicSearch = try {
    if (q == "JKT48") coroutineScope {
        val picks = QUICK.map { title -> async { runCatching { Api.musicSearch("JKT48 $title", f).tracks.firstOrNull() }.getOrNull() } }.awaitAll().filterNotNull().distinctBy { it.id }
        if (picks.isEmpty()) Api.musicSearch(q, f) else MusicSearch(q, "", picks)
    } else Api.musicSearch(q, f)
} catch (e: ApiException) {
    if (e.status == 400) MusicSearch(q, "", emptyList()) else throw e
}

/** Kelompok saudari untuk dijelajahi (kata kunci pencarian + warna kartu). */
private val EXPLORE = listOf(
    Triple("AKB48", "Asal mula", listOf(Color(0xFFE8457A), Color(0xFF7A1C47))),
    Triple("Nogizaka46", "Elegan", listOf(Color(0xFF8E6BE8), Color(0xFF34216E))),
    Triple("SKE48", "Energik", listOf(Color(0xFFF59E2B), Color(0xFF8A3B0E))),
    Triple("BNK48", "Saudari", listOf(Color(0xFF2BB6C9), Color(0xFF0E4B61))),
)

/**
 * Hero: cover yang sedang/akan diputar dengan latar cover blur + gradasi warna dominannya, dan baris lirik yang
 * sedang dinyanyikan berganti secara live (geser + pudar) seperti widget "Now Playing" di iPhone.
 */
@Composable
private fun MusicHero(current: MusicTrack?, tracks: List<MusicTrack>?, onPlay: (List<MusicTrack>) -> Unit) {
    val c = LocalColors.current
    val feature = current ?: tracks?.firstOrNull()
    val heroFill = when {
        !isRenderEffectSupported() -> glassFill()
        c.dark -> Color(0xFF1C1C1E).copy(alpha = 0.34f)
        else -> Color.White.copy(alpha = 0.4f)
    }
    Box(
        Modifier
            .padding(horizontal = 16.dp)
            .fillMaxWidth()
            .glass(LocalBackdrop.current, RoundedRectangle(32.dp), heroFill, blur = 8.dp, lensHeight = 24.dp, lensAmount = 48.dp, depth = true)
            .pressable({ if (current != null) Music.nowPlayingOpen = true else tracks?.let(onPlay) }),
    ) {
        Column(Modifier.padding(18.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                MusicCover(feature, Modifier.size(112.dp), 22.dp)
                Spacer(Modifier.width(16.dp))
                Column(Modifier.weight(1f)) {
                    Micro(if (current != null) "Sedang diputar" else "Mulai dengar", color = c.brand, dot = current != null)
                    Spacer(Modifier.height(6.dp))
                    Txt(feature?.title ?: "Lagu JKT48", AppText.title(22.sp, c.ink), maxLines = 2)
                    Spacer(Modifier.height(2.dp))
                    Txt(feature?.artist?.ifEmpty { "JKT48" } ?: "Lirik sinkron, putar di latar", AppText.body(13.sp, c.inkSoft), maxLines = 1)
                }
            }
            if (current != null) HeroLyric(Modifier.padding(top = 16.dp))
            else Txt(
                "Lirik bergerak mengikuti lagu, dan tetap jalan di latar lengkap dengan kontrol di notifikasi.",
                AppText.body(13.5.sp, c.inkSoft),
                Modifier.padding(top = 14.dp),
                maxLines = 3,
            )
            Spacer(Modifier.height(14.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                LiquidButton(
                    onClick = { if (current != null) Music.toggle() else tracks?.let(onPlay) },
                    modifier = Modifier.height(44.dp),
                    tint = c.brand,
                    contentPadding = PaddingValues(start = 12.dp, end = 18.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Image(if (current != null && Music.playing) Icons.Rounded.Pause else Icons.Rounded.PlayArrow, null, Modifier.size(24.dp), colorFilter = ColorFilter.tint(Color.White))
                    Txt(if (current == null) "Putar" else if (Music.playing) "Jeda" else "Lanjut", AppText.body(14.sp, Color.White, 800))
                }
                if (current == null && tracks != null && tracks.size > 1) {
                    LiquidButton(
                        onClick = { onPlay(tracks.shuffled()) },
                        modifier = Modifier.height(44.dp),
                        contentPadding = PaddingValues(start = 12.dp, end = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        Image(Icons.Rounded.Shuffle, null, Modifier.size(20.dp), colorFilter = ColorFilter.tint(c.ink))
                        Txt("Acak", AppText.body(14.sp, c.ink, 750))
                    }
                }
                if (current != null) LiquidIconButton(Icons.Rounded.SkipNext, { Music.next() }, size = 44.dp, iconSize = 24.dp, fill = glassFill())
                Spacer(Modifier.weight(1f))
                if (current != null && Music.playing) EqualizerBars(true, c.brand)
                else if (tracks != null) Txt("${tracks.size} lagu", AppText.mono(11.sp, c.inkSoft))
            }
        }
    }
}

/** Baris lirik yang sedang dinyanyikan (dibaca dari posisi pemutar tiap 250 ms), berganti dengan animasi geser + pudar. */
@Composable
private fun HeroLyric(modifier: Modifier = Modifier) {
    val lyr = Music.lyrics
    val lines = lyr?.lines?.takeIf { lyr.synced && it.isNotEmpty() }
    fun lineAt(): String {
        val l = lines ?: return ""
        val t = Music.position() / 1000.0 + 0.18
        val i = l.indexOfLast { it.time <= t }
        return if (i < 0) "♪" else l[i].text.ifBlank { "♪" }
    }
    val live by produceState(lineAt(), lines) {
        if (lines == null) return@produceState
        while (true) {
            value = lineAt()
            delay(250)
        }
    }
    val text = when {
        lines != null -> live
        Music.lyricsLoading -> "Memuat lirik…"
        lyr != null && lyr.lines.isNotEmpty() -> "Lirik tersedia, ketuk untuk membuka"
        else -> "Lirik belum tersedia untuk lagu ini"
    }
    Row(modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.width(3.dp).height(34.dp).background(LocalColors.current.brand, RoundedCornerShape(2.dp)))
        Spacer(Modifier.width(10.dp))
        AnimatedContent(
            text,
            transitionSpec = {
                (slideInVertically(spring(0.8f, 260f)) { it / 2 } + fadeIn(tween(320))) togetherWith
                    (slideOutVertically(tween(240)) { -it / 2 } + fadeOut(tween(200))) using SizeTransform(clip = false)
            },
            label = "heroLyric",
            modifier = Modifier.weight(1f),
        ) { s -> Txt(s, AppText.title(17.sp, LocalColors.current.ink), maxLines = 2) }
    }
}

/** Carousel "Single populer": cover besar; judul & tombol putar di atas pelat liquid glass yang membiaskan cover itu sendiri. */
@Composable
private fun PopularCarousel(tracks: List<MusicTrack>, onPlay: (Int) -> Unit) {
    LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        itemsIndexed(tracks, key = { _, t -> "pop" + t.id }) { i, t ->
            val isCurrent = Music.current?.id == t.id
            val coverBg = rememberLayerBackdrop()
            Box(Modifier.size(176.dp, 220.dp).clip(RoundedCornerShape(26.dp)).pressable({ onPlay(i) })) {
                Box(Modifier.matchParentSize().layerBackdrop(coverBg)) {
                    MusicCover(t, Modifier.matchParentSize(), 0.dp)
                    Box(Modifier.matchParentSize().background(Brush.verticalGradient(0f to Color.Transparent, 0.55f to Color.Transparent, 1f to Color.Black.copy(alpha = 0.35f))))
                }
                Txt(
                    "#${i + 1}", AppText.mono(12.sp, Color.White),
                    Modifier.align(Alignment.TopStart).padding(10.dp)
                        .glass(coverBg, Capsule(), Color.Black.copy(alpha = 0.12f), blur = 6.dp, lensHeight = 8.dp, lensAmount = 16.dp, shadow = false)
                        .padding(horizontal = 9.dp, vertical = 4.dp),
                )
                Row(
                    Modifier.align(Alignment.BottomCenter).padding(8.dp).fillMaxWidth()
                        .glass(coverBg, RoundedRectangle(20.dp), Color.Black.copy(alpha = 0.16f), blur = 10.dp, lensHeight = 14.dp, lensAmount = 28.dp, shadow = false)
                        .padding(start = 12.dp, end = 8.dp, top = 9.dp, bottom = 9.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f)) {
                        Txt(t.title, AppText.body(14.sp, Color.White, 800), maxLines = 1)
                        Txt(t.artist.ifEmpty { "JKT48" }, AppText.body(11.5.sp, Color.White.copy(alpha = 0.78f)), maxLines = 1)
                    }
                    Box(
                        Modifier.size(34.dp).glass(coverBg, CircleShape, Color.White.copy(alpha = 0.22f), blur = 4.dp, lensHeight = 8.dp, lensAmount = 16.dp, shadow = false),
                        contentAlignment = Alignment.Center,
                    ) {
                        if (isCurrent && Music.playing) EqualizerBars(true, Color.White)
                        else Image(Icons.Rounded.PlayArrow, null, Modifier.size(20.dp), colorFilter = ColorFilter.tint(Color.White))
                    }
                }
            }
        }
    }
}

/** Kartu jelajah grup saudari: gradasi warna, ketuk = cari lagu grup tersebut. */
@Composable
private fun ExploreGrid(onPick: (String) -> Unit) {
    Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        EXPLORE.chunked(2).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                row.forEach { (name, tag, grad) ->
                    Box(
                        Modifier.weight(1f).height(78.dp)
                            .glass(LocalBackdrop.current, RoundedRectangle(22.dp), Color.Transparent, tint = grad[0], blur = 4.dp, lensHeight = 14.dp, lensAmount = 28.dp)
                            .pressable({ onPick(name) })
                            .padding(14.dp),
                    ) {
                        Column(Modifier.align(Alignment.BottomStart)) {
                            Micro(tag, color = Color.White.copy(alpha = 0.75f))
                            Txt(name, AppText.title(18.sp, Color.White), maxLines = 1)
                        }
                        Image(
                            Icons.Rounded.GraphicEq, null,
                            Modifier.align(Alignment.TopEnd).size(40.dp).graphicsLayer { rotationZ = -12f; translationX = 10f; translationY = -6f },
                            colorFilter = ColorFilter.tint(Color.White.copy(alpha = 0.22f)),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun SearchField(value: String, onChange: (String) -> Unit, onSubmit: () -> Unit, modifier: Modifier = Modifier) {
    val c = LocalColors.current
    Row(
        modifier.fillMaxWidth().height(50.dp)
            .glass(LocalBackdrop.current, Capsule(), glassFill(), blur = 4.dp, lensHeight = 12.dp, lensAmount = 24.dp)
            .padding(start = 16.dp, end = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Image(Icons.Rounded.Search, null, Modifier.size(20.dp), colorFilter = ColorFilter.tint(c.inkSoft))
        Spacer(Modifier.width(10.dp))
        Box(Modifier.weight(1f), contentAlignment = Alignment.CenterStart) {
            if (value.isEmpty()) Txt("Judul, artis, atau potongan lirik", AppText.body(15.sp, c.inkSoft))
            BasicTextField(
                value,
                onChange,
                singleLine = true,
                textStyle = AppText.body(15.sp, c.ink, 600),
                cursorBrush = SolidColor(c.brand),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                keyboardActions = KeyboardActions(onSearch = { onSubmit() }),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        if (value.isNotEmpty()) {
            Box(Modifier.size(38.dp).pressable({ onChange("") }), contentAlignment = Alignment.Center) {
                Image(Icons.Rounded.Close, null, Modifier.size(18.dp), colorFilter = ColorFilter.tint(c.inkSoft))
            }
        }
    }
}

@Composable
private fun TrackRow(t: MusicTrack, index: Int, modifier: Modifier, onClick: () -> Unit) {
    val c = LocalColors.current
    val isCurrent = Music.current?.id == t.id
    Row(
        modifier.fillMaxWidth()
            .glass(
                LocalBackdrop.current, RoundedRectangle(22.dp),
                if (isCurrent) c.brand.copy(alpha = if (c.dark) 0.24f else 0.14f).compositeOver(glassFill()) else glassFill(),
                blur = 3.dp, lensHeight = 10.dp, lensAmount = 20.dp,
            )
            .pressable(onClick).padding(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box {
            MusicCover(t, Modifier.size(52.dp), 12.dp)
            if (isCurrent) {
                Box(Modifier.size(52.dp).background(Color.Black.copy(alpha = 0.35f), RoundedCornerShape(12.dp)), contentAlignment = Alignment.Center) {
                    EqualizerBars(Music.playing, Color.White)
                }
            }
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Txt(t.title, AppText.body(15.sp, if (isCurrent) c.brand else c.ink, 750), maxLines = 1)
            Spacer(Modifier.height(2.dp))
            Txt(listOfNotNull(t.artist.ifEmpty { null }, t.duration?.let { fmtClock(it * 1000L) }).joinToString(" · "), AppText.body(12.5.sp, c.inkSoft), maxLines = 1)
        }
        Txt(String.format("%02d", index + 1), AppText.mono(11.sp, c.inkSoft.copy(alpha = 0.7f)))
        Spacer(Modifier.width(6.dp))
        Image(if (isCurrent) Icons.Rounded.GraphicEq else Icons.Rounded.PlayArrow, null, Modifier.size(20.dp), colorFilter = ColorFilter.tint(if (isCurrent) c.brand else c.inkSoft))
    }
}
