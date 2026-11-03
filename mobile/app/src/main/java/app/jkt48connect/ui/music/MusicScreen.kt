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
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
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
import androidx.compose.material.icons.automirrored.rounded.ArrowForward
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.GraphicEq
import androidx.compose.material.icons.rounded.MusicNote
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Shuffle
import androidx.compose.material.icons.rounded.SkipNext
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
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
import androidx.compose.ui.geometry.Offset
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
import app.jkt48connect.ui.components.Skeleton
import app.jkt48connect.ui.components.Txt
import app.jkt48connect.ui.components.pressable
import app.jkt48connect.ui.components.staggerIn
import app.jkt48connect.ui.glass.LiquidButton
import app.jkt48connect.ui.glass.LiquidIconButton
import app.jkt48connect.ui.glass.LocalBackdrop
import app.jkt48connect.ui.glass.glass
import app.jkt48connect.ui.rememberLoad
import app.jkt48connect.ui.theme.AppText
import app.jkt48connect.ui.theme.AppTheme
import app.jkt48connect.ui.theme.LocalColors
import com.kyant.backdrop.backdrops.layerBackdrop
import com.kyant.backdrop.backdrops.rememberLayerBackdrop
import com.kyant.shapes.Capsule
import com.kyant.shapes.RoundedRectangle
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay

/** Pilihan cepat: lagu-lagu JKT48 yang sering dicari. */
private val QUICK = listOf("Heavy Rotation", "River", "Fortune Cookie", "Aitakatta", "Flying Get", "Rapsodi", "Pajama Drive", "Sakura no Hanabiratachi")

/** Kelompok saudari untuk dijelajahi (kata kunci pencarian + warna aksen kartu). */
private val EXPLORE = listOf(
    "AKB48" to Color(0xFFE8457A),
    "Nogizaka46" to Color(0xFF8E6BE8),
    "SKE48" to Color(0xFFF59E2B),
    "BNK48" to Color(0xFF2BB6C9),
    "MNL48" to Color(0xFF3E7BFA),
    "Hinatazaka46" to Color(0xFF5BC0F8),
)

/** Isian kaca terang di atas latar gelap gambar lagu. */
private val Frost = Color.White.copy(alpha = 0.1f)

/**
 * Halaman Musik bergaya pemutar musik imersif: selalu gelap, latar = gambar lagu yang sedang/akan diputar,
 * wordmark di atas, grid pilihan cepat, kartu besar, riwayat, jelajah, dan daftar lagu polos. Semua permukaan
 * memakai liquid glass yang membiaskan gambar lagu itu.
 */
@Composable
fun MusicScreen() = AppTheme(dark = true) {
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
    val home = submitted == "JKT48"
    val play = { list: List<MusicTrack>, i: Int -> Music.play(context, list, i); Music.nowPlayingOpen = true }
    val musicBg = rememberLayerBackdrop()

    Box(Modifier.fillMaxSize()) {
        MusicAmbient(feature, Modifier.fillMaxSize().layerBackdrop(musicBg))
        CompositionLocalProvider(LocalBackdrop provides musicBg) {
            LazyColumn(state = rememberLazyListState(), contentPadding = LocalInsets.current) {
                item { Wordmark(tracks, onShuffle = { list -> play(list.shuffled(), 0) }) }
                item {
                    SearchField(
                        query,
                        onChange = { query = it },
                        onSubmit = { if (query.trim().length >= 2) submitted = query.trim(); focus.clearFocus() },
                        modifier = Modifier.padding(16.dp, 4.dp, 16.dp, 0.dp),
                    )
                }
                item {
                    Row(Modifier.horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        QUICK.forEach { q ->
                            val on = submitted.equals(q, true) || query.trim().equals(q, true)
                            LiquidButton(
                                onClick = { query = q; submitted = q; focus.clearFocus() },
                                modifier = Modifier.height(36.dp),
                                tint = if (on) LocalColors.current.brand else Color.Unspecified,
                                fill = if (on) Color.Transparent else Frost,
                                contentPadding = PaddingValues(horizontal = 14.dp),
                            ) { Txt(q, AppText.body(13.sp, Color.White, 700)) }
                        }
                    }
                }
                if (current != null) item { NowCard(current, Modifier.padding(16.dp, 4.dp, 16.dp, 0.dp)) }

                if (home && tracks != null && tracks.size >= 3) {
                    item { Heading("Pilihan cepat") }
                    item { QuickGrid(tracks.take(6)) { i -> play(tracks, i) } }
                    item { Heading("Sorotan harian", action = "Putar semua") { play(tracks, 0) } }
                    item { DailyCards(tracks) { i -> play(tracks, i) } }
                }
                if (query.isBlank() && Music.history.isNotEmpty()) {
                    item { Heading("Baru diputar") }
                    item {
                        LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            itemsIndexed(Music.history, key = { _, t -> "h" + t.id }) { i, t ->
                                Column(Modifier.width(128.dp).pressable({ play(Music.history, i) })) {
                                    MusicCover(t, Modifier.size(128.dp), 14.dp)
                                    Spacer(Modifier.height(8.dp))
                                    Txt(t.title, AppText.body(13.sp, Color.White, 700), maxLines = 1)
                                    Txt(t.artist.ifEmpty { "JKT48" }, AppText.body(12.sp, Color.White.copy(alpha = 0.6f)), maxLines = 1)
                                }
                            }
                        }
                    }
                }
                if (home) {
                    item { Heading("Jelajahi grup saudari") }
                    item { ExploreGrid { name -> query = name; submitted = name; focus.clearFocus() } }
                }
                item {
                    Heading(
                        if (home) "Semua lagu" else "Hasil untuk “$submitted”",
                        action = tracks?.takeIf { it.size > 1 }?.let { "Acak" },
                    ) { tracks?.let { play(it.shuffled(), 0) } }
                }
                when {
                    result.error != null && tracks == null -> item { ErrorRetry(result.error!!, { result.run(true) }) }
                    tracks == null -> items(6) { Skeleton(Modifier.padding(16.dp, 0.dp, 16.dp, 10.dp).fillMaxWidth().height(60.dp), 12.dp) }
                    tracks.isEmpty() -> item {
                        Column(
                            Modifier.padding(16.dp).fillMaxWidth().glass(LocalBackdrop.current, RoundedRectangle(24.dp), Frost, lensHeight = 16.dp, lensAmount = 32.dp).padding(28.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Image(Icons.Rounded.MusicNote, null, Modifier.size(30.dp), colorFilter = ColorFilter.tint(Color.White.copy(alpha = 0.6f)))
                            Spacer(Modifier.height(10.dp))
                            Txt("Lagu tidak ditemukan. Coba judul lain atau potongan lirik.", AppText.body(14.sp, Color.White.copy(alpha = 0.7f)))
                        }
                    }
                    else -> {
                        result.data?.identified?.takeIf { it.isNotEmpty() && !home }?.let { idf ->
                            item { Micro("Dikenali: $idf", Modifier.padding(20.dp, 0.dp, 20.dp, 6.dp), color = Color.White.copy(alpha = 0.55f)) }
                        }
                        itemsIndexed(tracks, key = { _, t -> t.id }) { i, t ->
                            TrackRow(t, Modifier.padding(horizontal = 8.dp).staggerIn(i, 30)) { play(tracks, i) }
                        }
                    }
                }
            }
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

/**
 * Latar: gambar lagu (sedang diputar / pilihan) memenuhi layar dan diburamkan, digelapkan bertahap ke bawah, plus
 * pendar warna dominannya. Inilah yang dibiaskan semua liquid glass di halaman ini.
 */
@Composable
private fun MusicAmbient(feature: MusicTrack?, modifier: Modifier) {
    val colors = rememberCoverColors(feature)
    val a by animateColorAsState(colors?.first ?: Color(0xFF6E1020), tween(900), label = "ambA")
    val b by animateColorAsState(colors?.second ?: Color(0xFF1A0A0E), tween(900), label = "ambB")
    Box(modifier.background(Brush.verticalGradient(listOf(a, Color(0xFF0B0A0C))))) {
        MusicCover(
            feature,
            Modifier.fillMaxSize().graphicsLayer { scaleX = 1.2f; scaleY = 1.2f; alpha = 0.85f }.blur(30.dp),
            0.dp,
        )
        Canvas(Modifier.fillMaxSize()) {
            val w = size.width
            val h = size.height
            drawRect(Brush.verticalGradient(0f to Color.Black.copy(alpha = 0.35f), 0.4f to Color.Black.copy(alpha = 0.5f), 1f to Color.Black.copy(alpha = 0.78f)))
            drawCircle(
                Brush.radialGradient(0f to b.copy(alpha = 0.55f), 1f to Color.Transparent, center = Offset(w * 0.9f, h * 0.7f), radius = w),
                w, Offset(w * 0.9f, h * 0.7f),
            )
        }
    }
}

/** Kepala halaman: wordmark huruf renggang + tombol kaca bulat (acak semua, buka pemutar). */
@Composable
private fun Wordmark(tracks: List<MusicTrack>?, onShuffle: (List<MusicTrack>) -> Unit) {
    Row(Modifier.fillMaxWidth().padding(20.dp, 6.dp, 16.dp, 12.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Txt("MUSIK", AppText.display(30.sp, Color.White).copy(letterSpacing = 4.sp), maxLines = 1)
            Txt("JKT48Connect · lirik sinkron", AppText.body(12.sp, Color.White.copy(alpha = 0.6f), 600), maxLines = 1)
        }
        if (tracks != null && tracks.size > 1) {
            LiquidIconButton(Icons.Rounded.Shuffle, { onShuffle(tracks) }, size = 42.dp, iconSize = 20.dp, iconColor = Color.White, fill = Frost, contentDescription = "Acak semua")
            Spacer(Modifier.width(8.dp))
        }
        if (Music.current != null) {
            LiquidIconButton(Icons.Rounded.GraphicEq, { Music.nowPlayingOpen = true }, size = 42.dp, iconSize = 20.dp, iconColor = Color.White, fill = Frost, contentDescription = "Sedang diputar")
        }
    }
}

/** Judul bagian kalimat biasa + aksi opsional berupa pil kaca. */
@Composable
private fun Heading(title: String, action: String? = null, onAction: () -> Unit = {}) {
    Row(Modifier.fillMaxWidth().padding(20.dp, 24.dp, 16.dp, 12.dp), verticalAlignment = Alignment.CenterVertically) {
        Txt(title, AppText.title(20.sp, Color.White), Modifier.weight(1f), maxLines = 1)
        if (action != null) {
            LiquidButton(onClick = onAction, modifier = Modifier.height(30.dp), fill = Frost, contentPadding = PaddingValues(horizontal = 12.dp)) {
                Txt(action, AppText.body(12.sp, Color.White, 700))
            }
        }
    }
}

/** Kartu "sedang diputar": cover, judul, baris lirik live, putar/jeda & berikutnya. */
@Composable
private fun NowCard(t: MusicTrack, modifier: Modifier) {
    Column(
        modifier.fillMaxWidth()
            .glass(LocalBackdrop.current, RoundedRectangle(26.dp), Frost, blur = 8.dp, lensHeight = 20.dp, lensAmount = 40.dp, depth = true)
            .pressable({ Music.nowPlayingOpen = true })
            .padding(14.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            MusicCover(t, Modifier.size(56.dp), 12.dp)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Micro("Sedang diputar", color = LocalColors.current.brand, dot = true)
                Txt(t.title, AppText.body(16.sp, Color.White, 800), maxLines = 1)
                Txt(t.artist.ifEmpty { "JKT48" }, AppText.body(12.5.sp, Color.White.copy(alpha = 0.6f)), maxLines = 1)
            }
            LiquidIconButton(if (Music.playing) Icons.Rounded.Pause else Icons.Rounded.PlayArrow, { Music.toggle() }, size = 44.dp, iconSize = 24.dp, iconColor = Color.White, fill = Color.White.copy(alpha = 0.16f))
            Spacer(Modifier.width(6.dp))
            LiquidIconButton(Icons.Rounded.SkipNext, { Music.next() }, size = 44.dp, iconSize = 24.dp, iconColor = Color.White, fill = Frost)
        }
        HeroLyric(Modifier.padding(top = 12.dp))
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
    AnimatedContent(
        text,
        transitionSpec = {
            (slideInVertically(spring(0.8f, 260f)) { it / 2 } + fadeIn(tween(320))) togetherWith
                (slideOutVertically(tween(240)) { -it / 2 } + fadeOut(tween(200))) using SizeTransform(clip = false)
        },
        label = "heroLyric",
        modifier = modifier.fillMaxWidth(),
    ) { s -> Txt(s, AppText.title(19.sp, Color.White), maxLines = 2) }
}

/** Grid 3 × 2 tile persegi kecil: gambar lagu dengan judul di pojok kiri bawah. */
@Composable
private fun QuickGrid(tracks: List<MusicTrack>, onPlay: (Int) -> Unit) {
    Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        tracks.chunked(3).forEachIndexed { r, row ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                row.forEachIndexed { k, t ->
                    val i = r * 3 + k
                    Box(Modifier.weight(1f).aspectRatio(1f).clip(RoundedCornerShape(14.dp)).pressable({ onPlay(i) })) {
                        MusicCover(t, Modifier.fillMaxSize(), 0.dp)
                        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color.Transparent, 0.5f to Color.Transparent, 1f to Color.Black.copy(alpha = 0.75f))))
                        Txt(t.title, AppText.body(12.sp, Color.White, 800), Modifier.align(Alignment.BottomStart).padding(8.dp), maxLines = 1)
                        if (Music.current?.id == t.id) EqualizerBars(Music.playing, Color.White, Modifier.align(Alignment.TopEnd).padding(8.dp))
                    }
                }
                repeat(3 - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

/** Kartu besar bergeser: gambar penuh, judul & artis di kiri atas, keterangan + tombol putar kaca di bawah. */
@Composable
private fun DailyCards(tracks: List<MusicTrack>, onPlay: (Int) -> Unit) {
    LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        itemsIndexed(tracks, key = { _, t -> "d" + t.id }) { i, t ->
            val coverBg = rememberLayerBackdrop()
            val next = tracks.getOrNull((i + 1) % tracks.size)
            Box(Modifier.size(276.dp, 300.dp).clip(RoundedCornerShape(28.dp)).pressable({ onPlay(i) })) {
                Box(Modifier.fillMaxSize().layerBackdrop(coverBg)) {
                    MusicCover(t, Modifier.fillMaxSize(), 0.dp)
                    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color.Black.copy(alpha = 0.45f), 0.3f to Color.Transparent, 0.7f to Color.Transparent, 1f to Color.Black.copy(alpha = 0.5f))))
                }
                Column(Modifier.align(Alignment.TopStart).padding(18.dp)) {
                    Txt(t.title, AppText.title(20.sp, Color.White), maxLines = 2)
                    Txt(t.artist.ifEmpty { "JKT48" }, AppText.body(13.sp, Color.White.copy(alpha = 0.8f), 600), maxLines = 1)
                }
                Row(
                    Modifier.align(Alignment.BottomCenter).padding(10.dp).fillMaxWidth()
                        .glass(coverBg, RoundedRectangle(20.dp), Color.Black.copy(alpha = 0.18f), blur = 10.dp, lensHeight = 14.dp, lensAmount = 28.dp, shadow = false)
                        .padding(start = 14.dp, end = 6.dp, top = 6.dp, bottom = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Txt(next?.let { "Lanjut ke ${it.title}" } ?: "Lirik sinkron", AppText.body(12.sp, Color.White.copy(alpha = 0.85f), 600), Modifier.weight(1f), maxLines = 1)
                    Box(
                        Modifier.size(38.dp).glass(coverBg, CircleShape, Color.White.copy(alpha = 0.9f), blur = 2.dp, lensHeight = 8.dp, lensAmount = 14.dp, shadow = false),
                        contentAlignment = Alignment.Center,
                    ) {
                        if (Music.current?.id == t.id && Music.playing) EqualizerBars(true, Color.Black)
                        else Image(Icons.Rounded.PlayArrow, null, Modifier.size(22.dp), colorFilter = ColorFilter.tint(Color.Black))
                    }
                }
            }
        }
    }
}

/** Kartu jelajah: kaca gelap dengan pendar warna di pojok, label di kiri atas. */
@Composable
private fun ExploreGrid(onPick: (String) -> Unit) {
    Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        EXPLORE.chunked(2).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                row.forEach { (name, accent) ->
                    Box(
                        Modifier.weight(1f).height(64.dp)
                            .glass(LocalBackdrop.current, RoundedRectangle(16.dp), Color.Black.copy(alpha = 0.22f), blur = 6.dp, lensHeight = 12.dp, lensAmount = 24.dp)
                            .pressable({ onPick(name) }),
                    ) {
                        Canvas(Modifier.matchParentSize()) {
                            drawCircle(Brush.radialGradient(listOf(accent.copy(alpha = 0.55f), Color.Transparent), center = Offset(size.width, size.height), radius = size.width * 0.7f), size.width * 0.7f, Offset(size.width, size.height))
                        }
                        Txt(name, AppText.body(14.sp, Color.White, 750), Modifier.align(Alignment.TopStart).padding(12.dp), maxLines = 1)
                        Image(
                            Icons.AutoMirrored.Rounded.ArrowForward, null,
                            Modifier.align(Alignment.BottomEnd).padding(10.dp).size(16.dp),
                            colorFilter = ColorFilter.tint(Color.White.copy(alpha = 0.6f)),
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
            .glass(LocalBackdrop.current, Capsule(), Frost, blur = 6.dp, lensHeight = 12.dp, lensAmount = 24.dp)
            .padding(start = 16.dp, end = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Image(Icons.Rounded.Search, null, Modifier.size(20.dp), colorFilter = ColorFilter.tint(Color.White.copy(alpha = 0.7f)))
        Spacer(Modifier.width(10.dp))
        Box(Modifier.weight(1f), contentAlignment = Alignment.CenterStart) {
            if (value.isEmpty()) Txt("Cari judul, artis, atau potongan lirik", AppText.body(15.sp, Color.White.copy(alpha = 0.55f)))
            BasicTextField(
                value,
                onChange,
                singleLine = true,
                textStyle = AppText.body(15.sp, Color.White, 600),
                cursorBrush = SolidColor(c.brand),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                keyboardActions = KeyboardActions(onSearch = { onSubmit() }),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        if (value.isNotEmpty()) {
            Box(Modifier.size(38.dp).pressable({ onChange("") }), contentAlignment = Alignment.Center) {
                Image(Icons.Rounded.Close, null, Modifier.size(18.dp), colorFilter = ColorFilter.tint(Color.White.copy(alpha = 0.7f)))
            }
        }
    }
}

/** Baris lagu polos di atas latar: thumbnail, judul, artis · durasi; lagu yang diputar diberi ekualiser & warna aksen. */
@Composable
private fun TrackRow(t: MusicTrack, modifier: Modifier, onClick: () -> Unit) {
    val c = LocalColors.current
    val isCurrent = Music.current?.id == t.id
    Row(
        modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp))
            .background(if (isCurrent) Color.White.copy(alpha = 0.08f) else Color.Transparent)
            .pressable(onClick).padding(horizontal = 8.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box {
            MusicCover(t, Modifier.size(52.dp), 10.dp)
            if (isCurrent) {
                Box(Modifier.size(52.dp).background(Color.Black.copy(alpha = 0.4f), RoundedCornerShape(10.dp)), contentAlignment = Alignment.Center) {
                    EqualizerBars(Music.playing, Color.White)
                }
            }
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Txt(t.title, AppText.body(15.sp, if (isCurrent) c.brand else Color.White, 750), maxLines = 1)
            Spacer(Modifier.height(2.dp))
            Txt(listOfNotNull(t.artist.ifEmpty { "JKT48" }, t.duration?.let { fmtClock(it * 1000L) }).joinToString(" · "), AppText.body(12.5.sp, Color.White.copy(alpha = 0.55f)), maxLines = 1)
        }
        Image(Icons.Rounded.PlayArrow, null, Modifier.size(22.dp), colorFilter = ColorFilter.tint(Color.White.copy(alpha = if (isCurrent) 0.9f else 0.45f)))
    }
}
