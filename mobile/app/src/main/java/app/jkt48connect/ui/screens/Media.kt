package app.jkt48connect.ui.screens

import app.jkt48connect.ui.components.glassCard
import app.jkt48connect.ui.components.GlassSegmented
import app.jkt48connect.ui.components.EmptyState
import androidx.compose.material.icons.rounded.SmartDisplay
import androidx.compose.material.icons.rounded.Forum
import androidx.compose.foundation.border

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.OpenInNew
import androidx.compose.material.icons.rounded.ChatBubbleOutline
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.FavoriteBorder
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Repeat
import androidx.compose.material.icons.rounded.ThumbUp
import androidx.compose.material.icons.rounded.Visibility
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material.icons.rounded.DownloadForOffline
import androidx.compose.ui.platform.LocalContext
import app.jkt48connect.core.Api
import app.jkt48connect.core.Downloads
import app.jkt48connect.core.ApiException
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import app.jkt48connect.core.Fetch
import app.jkt48connect.core.SocialPost
import app.jkt48connect.core.Video
import app.jkt48connect.core.fmtCompact
import app.jkt48connect.core.fmtDate
import app.jkt48connect.core.fmtTime
import app.jkt48connect.core.timeAgo
import app.jkt48connect.ui.Cursor
import app.jkt48connect.ui.LocalInsets
import app.jkt48connect.ui.LocalNav
import app.jkt48connect.ui.Route
import app.jkt48connect.ui.components.ErrorRetry
import app.jkt48connect.ui.components.Micro
import app.jkt48connect.ui.components.NetImage
import app.jkt48connect.ui.components.PhotoScrim
import app.jkt48connect.ui.components.Pill
import app.jkt48connect.ui.components.PullRefresh
import app.jkt48connect.ui.components.Skeleton
import app.jkt48connect.ui.components.Txt
import app.jkt48connect.ui.components.VGap
import app.jkt48connect.ui.components.appCard
import app.jkt48connect.ui.components.pressable
import app.jkt48connect.ui.components.rememberOpenUrl
import app.jkt48connect.ui.components.staggerIn
import app.jkt48connect.ui.glass.LiquidButton
import app.jkt48connect.ui.glass.LiquidTabs
import app.jkt48connect.ui.glass.TabItem
import app.jkt48connect.ui.player.MediaPlayer
import app.jkt48connect.ui.player.MediaSource
import app.jkt48connect.ui.player.time
import app.jkt48connect.ui.rememberCursor
import app.jkt48connect.ui.rememberLoad
import app.jkt48connect.ui.theme.AppText
import app.jkt48connect.ui.theme.LocalColors

@Composable
private fun pagePadding() = PaddingValues(start = 16.dp, end = 16.dp, top = LocalInsets.current.calculateTopPadding(), bottom = 40.dp)

/* ───────────────────────────── YouTube ───────────────────────────── */

/** Video terbaru kanal resmi JKT48 & JKT48 TV; dipilih per kanal lewat pil kaca. */
@Composable
fun VideosScreen() {
    val c = LocalColors.current
    val nav = LocalNav.current
    val data = rememberLoad { Api.videos(it) }
    var seg by rememberSaveable { mutableIntStateOf(0) }
    val all = data.data
    val list = all?.filter {
        when (seg) {
            1 -> !it.channel.contains("TV", ignoreCase = true)
            2 -> it.channel.contains("TV", ignoreCase = true)
            else -> true
        }
    }
    PullRefresh(onRefresh = { data.refresh() }) {
        LazyColumn(contentPadding = pagePadding()) {
            item {
                GlassSegmented(listOf("Semua", "JKT48", "JKT48 TV"), seg, { seg = it }, Modifier.padding(top = 4.dp, bottom = 16.dp), inset = 0.dp)
            }
            when {
                data.error != null && list == null -> item { ErrorRetry(data.error!!, { data.run(true) }) }
                list == null -> items(3) { Skeleton(Modifier.padding(bottom = 18.dp).fillMaxWidth().aspectRatio(16f / 11f), 24.dp) }
                list.isEmpty() -> item { EmptyState(Icons.Rounded.SmartDisplay, "Belum ada video.", inset = 0.dp) }
                else -> itemsIndexed(list, key = { _, v -> v.id }) { i, v ->
                    VideoCard(v, Modifier.padding(bottom = 16.dp).staggerIn(i % 8)) { nav.push(Route.VideoDetail(v)) }
                }
            }
        }
    }
}

/** Kartu video: sampul 16:9 dengan tombol putar kaca, judul, kanal, penonton, dan waktu unggah. */
@Composable
fun VideoCard(v: Video, modifier: Modifier = Modifier, compact: Boolean = false, onClick: () -> Unit) {
    val c = LocalColors.current
    // Sama dengan VideoCard iOS: kartu kaca berisi sampul (tombol putar kaca merah), judul, kanal · penonton · waktu.
    Column(modifier.pressable(onClick).glassCard(26.dp).padding(if (compact) 8.dp else 10.dp)) {
        Box(Modifier.fillMaxWidth().aspectRatio(16f / 9f).clip(RoundedCornerShape(20.dp))) {
            NetImage(v.thumbnail, Modifier.fillMaxSize(), alignment = Alignment.Center)
            PlayBadge(Modifier.align(Alignment.Center), if (compact) 42.dp else 54.dp)
        }
        VGap(10.dp)
        Txt(v.title, AppText.body(if (compact) 14.sp else 16.sp, c.ink, 700), Modifier.padding(horizontal = 4.dp), maxLines = 2)
        VGap(4.dp)
        Txt(
            listOfNotNull(v.channel.ifEmpty { null }, v.views?.let { "${fmtCompact(it)} x ditonton" }, timeAgo(v.date).ifEmpty { null }).joinToString(" · "),
            AppText.body(12.sp, c.inkSoft),
            Modifier.padding(horizontal = 4.dp, vertical = 0.dp).padding(bottom = 4.dp),
            maxLines = 1,
        )
    }
}

@Composable
private fun PlayBadge(modifier: Modifier, size: Dp) {
    // Lingkaran kaca bertint merah seperti `glass(in: Circle(), tint: brand)` di iOS.
    Box(
        modifier.size(size).background(Color(0xFFE1243A).copy(alpha = 0.72f), CircleShape).border(0.7.dp, Color.White.copy(alpha = 0.45f), CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Image(Icons.Rounded.PlayArrow, "Putar", Modifier.size(size * 0.5f), colorFilter = ColorFilter.tint(Color.White))
    }
}

/**
 * Detail video: pemutar HLS (audio + video, kualitas bisa dipilih), judul, info, deskripsi, dan komentar.
 * Tiket playlist berlaku ± 3 jam: bila pemutar gagal, detail diambil ulang sekali untuk URL baru.
 */
@Composable
fun VideoDetailScreen(v: Video) {
    val c = LocalColors.current
    val open = rememberOpenUrl()
    var retried by remember(v.id) { mutableStateOf(false) }
    val detail = rememberLoad(v.id) { Api.video(v.id, it) }
    val d = detail.data
    val comments = rememberCursor(v.id) { cursor, f ->
        Api.videoComments(v.id, cursor, f).let { Cursor(it.items, it.cursor, it.hasMore) }
    }
    var expanded by remember { mutableStateOf(false) }
    LazyColumn(contentPadding = pagePadding()) {
        item {
            // Detail dari cache disk bisa membawa tiket yang sudah kedaluwarsa: jangan diputar, tunggu data baru.
            val pb = d?.playback?.takeIf { (it.expiresAt ?: Long.MAX_VALUE / 1000) * 1000 > System.currentTimeMillis() + 60_000 }
            when {
                pb != null -> androidx.compose.runtime.key(pb.url) {
                    MediaPlayer(
                        MediaSource(pb.url, hls = true, durationMs = (d.durationS ?: 0) * 1000, qualities = pb.qualities),
                        title = v.title,
                        label = d.channel.ifEmpty { "YouTube" }.uppercase(),
                        poster = v.thumbnail,
                        autoplay = true,
                        onFatal = {
                            // Tiket kedaluwarsa (410) atau sumber berubah → ambil URL baru sekali saja.
                            if (!retried) {
                                retried = true
                                detail.run(true)
                            }
                        },
                    )
                }
                d == null && detail.error == null -> Box(Modifier.fillMaxWidth().aspectRatio(16f / 9f).clip(RoundedCornerShape(22.dp)).background(Color.Black)) {
                    NetImage(v.thumbnail, Modifier.fillMaxSize(), alignment = Alignment.Center)
                    Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.35f)), contentAlignment = Alignment.Center) { Spinner() }
                }
                else -> Box(Modifier.fillMaxWidth().aspectRatio(16f / 9f).clip(RoundedCornerShape(22.dp)).pressable({ open(v.url) })) {
                    NetImage(v.thumbnail, Modifier.fillMaxSize(), alignment = Alignment.Center)
                    Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.5f)), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            PlayBadge(Modifier, 54.dp)
                            VGap(10.dp)
                            Txt("Tidak bisa diputar di aplikasi · buka di YouTube", AppText.body(13.sp, Color.White, 700))
                        }
                    }
                }
            }
            VGap(16.dp)
        }
        item {
            Column(Modifier.padding(horizontal = 4.dp)) {
                Txt(v.title, AppText.body(20.sp, c.ink, 800, 1.25f))
                VGap(8.dp)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Pill(d?.channel?.ifEmpty { null } ?: v.channel.ifEmpty { "JKT48" }, c.blush, c.brand)
                    Spacer(Modifier.width(8.dp))
                    Txt(
                        listOfNotNull(
                            (d?.views ?: v.views)?.let { "${fmtCompact(it)} x ditonton" },
                            d?.durationS?.let { time(it * 1000) },
                            fmtDate(v.date, "d MMM yyyy").ifEmpty { null },
                        ).joinToString(" · "),
                        AppText.body(12.5.sp, c.inkSoft),
                        maxLines = 1,
                    )
                }
                VGap(14.dp)
                LiquidButton(onClick = { open(v.url) }, modifier = Modifier.height(44.dp), contentPadding = PaddingValues(horizontal = 16.dp)) {
                    Txt("Buka di YouTube", AppText.body(14.sp, c.ink, 800))
                    Image(Icons.AutoMirrored.Rounded.OpenInNew, null, Modifier.size(16.dp), colorFilter = ColorFilter.tint(c.brand))
                }
            }
        }
        val desc = d?.description.orEmpty()
        if (desc.isNotEmpty()) item {
            VGap(16.dp)
            Column(Modifier.fillMaxWidth().appCard(20.dp).pressable({ expanded = !expanded }, 0.99f).padding(16.dp).animateContentSize()) {
                Txt(desc, AppText.body(14.sp, c.ink, 500, 1.5f), maxLines = if (expanded) Int.MAX_VALUE else 4)
                VGap(6.dp)
                Txt(if (expanded) "Lebih sedikit" else "Selengkapnya", AppText.body(13.sp, c.brand, 800))
            }
        }
        item {
            VGap(24.dp)
            Row(verticalAlignment = Alignment.Bottom) {
                Txt("Komentar", AppText.body(21.sp, c.ink, 800), Modifier.weight(1f))
                d?.comments?.let { Txt(fmtCompact(it), AppText.body(14.sp, c.inkSoft, 700)) }
            }
            VGap(10.dp)
        }
        when {
            comments.error != null && comments.items.isEmpty() -> item { ErrorRetry(comments.error!!, { comments.more() }) }
            !comments.loaded && comments.items.isEmpty() -> items(3) { Skeleton(Modifier.padding(bottom = 10.dp).fillMaxWidth().height(72.dp), 18.dp) }
            comments.items.isEmpty() -> item { Txt("Belum ada komentar (atau komentar dinonaktifkan).", AppText.body(14.sp, c.inkSoft)) }
            else -> itemsIndexed(comments.items, key = { i, cm -> "${cm.id}$i" }) { i, cm ->
                // Grup ala iOS: kartu menyambung, sudut membulat hanya di baris pertama & terakhir, garis rambut menjorok.
                val first = i == 0
                val last = i == comments.items.lastIndex
                val shape = RoundedCornerShape(if (first) 20.dp else 0.dp, if (first) 20.dp else 0.dp, if (last) 20.dp else 0.dp, if (last) 20.dp else 0.dp)
                Column(Modifier.fillMaxWidth().clip(shape).background(c.card)) {
                        if (!first) Box(Modifier.padding(start = 62.dp).fillMaxWidth().height(0.6.dp).background(c.line))
                        Row(Modifier.padding(14.dp)) {
                            NetImage(cm.avatar, Modifier.size(36.dp).clip(CircleShape), fallback = cm.author.removePrefix("@"))
                            Spacer(Modifier.width(12.dp))
                            Column(Modifier.weight(1f)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Txt(cm.author, AppText.body(13.sp, if (cm.uploader) c.brand else c.ink, 800), Modifier.weight(1f, fill = false), maxLines = 1)
                                    Txt(" · ${cm.time}", AppText.body(12.sp, c.inkSoft), maxLines = 1)
                                }
                                VGap(3.dp)
                                Txt(cm.text, AppText.body(14.sp, c.ink, 500, 1.45f))
                                if ((cm.likes ?: 0) > 0 || (cm.replies ?: 0) > 0) {
                                    VGap(6.dp)
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Metric(Icons.Rounded.ThumbUp, cm.likes)
                                        if ((cm.replies ?: 0) > 0) {
                                            Spacer(Modifier.width(14.dp))
                                            Metric(Icons.Rounded.ChatBubbleOutline, cm.replies)
                                        }
                                    }
                                }
                            }
                        }
                }
            }
        }
        when {
            comments.loading && comments.items.isNotEmpty() -> item { Loading() }
            comments.hasMore && comments.items.isNotEmpty() -> item {
                VGap(12.dp)
                LiquidButton(onClick = { comments.more() }, modifier = Modifier.fillMaxWidth().height(46.dp)) {
                    Txt("Muat komentar lainnya", AppText.body(14.sp, c.brand, 800))
                }
            }
        }
    }
}

/* ───────────────────────────── Sosial media member ───────────────────────────── */

private val PLATFORMS = listOf("x" to "X", "tiktok" to "TikTok", "instagram" to "Instagram")

/** Posting terbaru member di X, TikTok, dan Instagram (arsip publik), bisa disaring per member. */
@Composable
fun SocialScreen(platform: String, member: String, memberName: String) {
    val c = LocalColors.current
    val nav = LocalNav.current
    var seg by rememberSaveable { mutableIntStateOf(PLATFORMS.indexOfFirst { it.first == platform }.coerceAtLeast(0)) }
    val current = PLATFORMS[seg].first
    val feed = rememberCursor(current, member) { cursor, f ->
        Api.social(current, member, cursor, f = f).let { Cursor(it.items, it.cursor, it.hasMore) }
    }
    // Foto member dari direktori (TikTok & Instagram tidak membawa foto profil).
    val photos = rememberLoad { Api.members(it) }.data?.associate { it.id to it.img }.orEmpty()
    val download = rememberDownloader()
    val state = rememberLazyListState()
    LoadMoreOnEnd(state, feed) { if (feed.loaded) feed.more() }
    PullRefresh(onRefresh = { feed.refresh() }) {
        LazyColumn(state = state, contentPadding = pagePadding()) {
            item {
                GlassSegmented(PLATFORMS.map { it.second }, seg, { seg = it }, Modifier.padding(top = 4.dp, bottom = 10.dp), inset = 0.dp)
                VGap(2.dp)
            }
            when {
                feed.error != null && feed.items.isEmpty() -> item { ErrorRetry(feed.error!!, { feed.more() }) }
                !feed.loaded && feed.items.isEmpty() -> items(3) { Skeleton(Modifier.padding(bottom = 14.dp).fillMaxWidth().height(260.dp), 24.dp) }
                feed.items.isEmpty() -> item { EmptyState(Icons.Rounded.Forum, "Belum ada posting.", inset = 0.dp) }
                else -> itemsIndexed(feed.items, key = { i, p -> "${p.platform}${p.id}$i" }) { i, p ->
                    PostCard(p, photos[p.memberId].orEmpty(), Modifier.padding(bottom = 14.dp).staggerIn(i % 8), onDownload = { download(downloadItems(p)) }) { nav.push(Route.Post(p)) }
                }
            }
            feed.error?.let { e -> if (feed.items.isNotEmpty()) item { ErrorRetry(e, { feed.more() }) } }
            if (feed.loading && feed.items.isNotEmpty()) item { Loading() }
        }
    }
}

/** Lencana platform kecil (tanpa logo merek): huruf di bulatan berwarna. */
@Composable
fun PlatformBadge(platform: String, size: Dp = 18.dp) {
    val (bg, text) = when (platform) {
        "x" -> Brush.linearGradient(listOf(Color(0xFF111111), Color(0xFF333333))) to "X"
        "tiktok" -> Brush.linearGradient(listOf(Color(0xFF25F4EE), Color(0xFFFE2C55))) to "♪"
        else -> Brush.linearGradient(listOf(Color(0xFFFEDA75), Color(0xFFD62976), Color(0xFF4F5BD5))) to "IG"
    }
    Box(Modifier.size(size).background(bg, CircleShape), contentAlignment = Alignment.Center) {
        Txt(text, AppText.body((size.value * 0.48f).sp, Color.White, 800))
    }
}

@Composable
private fun Metric(icon: ImageVector, value: Long?) {
    val c = LocalColors.current
    Row(verticalAlignment = Alignment.CenterVertically) {
        Image(icon, null, Modifier.size(15.dp), colorFilter = ColorFilter.tint(c.inkSoft))
        Spacer(Modifier.width(4.dp))
        Txt(fmtCompact(value), AppText.body(12.5.sp, c.inkSoft, 700))
    }
}

/** Kartu posting: kepala (foto, nama, @username, waktu), teks, pratinjau media, dan angka interaksi. */
@Composable
fun PostCard(p: SocialPost, photo: String, modifier: Modifier = Modifier, onDownload: (() -> Unit)? = null, onClick: () -> Unit) {
    val c = LocalColors.current
    Column(modifier.fillMaxWidth().pressable(onClick, 0.985f).glassCard(24.dp).padding(14.dp)) {
        PostHeader(p, photo)
        if (p.text.isNotEmpty()) {
            VGap(10.dp)
            Txt(p.text, AppText.body(14.5.sp, c.ink, 500, 1.45f), maxLines = 6)
        }
        if (p.media.isNotEmpty()) {
            VGap(10.dp)
            MediaPreview(p)
        }
        VGap(12.dp)
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.weight(1f)) { PostMetrics(p) }
            if (p.media.isNotEmpty() && onDownload != null) {
                Box(
                    Modifier.size(34.dp).background(c.brand.copy(alpha = 0.1f), CircleShape).pressable(onDownload),
                    contentAlignment = Alignment.Center,
                ) { Image(Icons.Rounded.Download, "Unduh media", Modifier.size(18.dp), colorFilter = ColorFilter.tint(c.brand)) }
            }
        }
    }
}

/** Semua media posting sebagai daftar unduhan (nama file: platform_username_id[_n]). */
fun downloadItems(p: SocialPost): List<Downloads.Item> = p.media.mapIndexed { i, m ->
    Downloads.Item(m.url, m.isVideo, Downloads.fileName("${p.platform}_${p.username.ifEmpty { p.memberName }}_${p.id}" + (if (p.media.size > 1) "_${i + 1}" else ""), m.url, m.isVideo))
}

@Composable
private fun PostHeader(p: SocialPost, photo: String) {
    val c = LocalColors.current
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box {
            NetImage(p.memberImg.ifEmpty { photo.ifEmpty { p.avatar } }, Modifier.size(42.dp).clip(CircleShape), fallback = p.memberName)
            Box(Modifier.align(Alignment.BottomEnd).background(c.card, CircleShape).padding(1.5.dp)) { PlatformBadge(p.platform, 17.dp) }
        }
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Txt(p.memberName.ifEmpty { p.authorName }, AppText.body(15.sp, c.ink, 800), maxLines = 1)
            Txt(
                listOfNotNull(p.username.takeIf { it.isNotEmpty() }?.let { "@$it" }, timeAgo(p.date).ifEmpty { null }?.let { if (p.dateApprox) "± $it" else it }).joinToString(" · "),
                AppText.body(12.5.sp, c.inkSoft),
                maxLines = 1,
            )
        }
    }
}

@Composable
private fun PostMetrics(p: SocialPost) {
    Row(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.CenterVertically) {
        if (p.likes != null) Metric(Icons.Rounded.FavoriteBorder, p.likes)
        if (p.comments != null) Metric(Icons.Rounded.ChatBubbleOutline, p.comments)
        if (p.reposts != null) Metric(Icons.Rounded.Repeat, p.reposts)
        if (p.views != null) Metric(Icons.Rounded.Visibility, p.views)
    }
}

/** 1 media: lebar penuh (video tegak dibatasi tingginya); 2+ media: kisi 2 kolom maks. 4 dengan "+N". */
@Composable
private fun MediaPreview(p: SocialPost) {
    val shown = p.media.take(4)
    if (shown.size == 1) {
        val m = shown[0]
        val ratio = if ((m.width ?: 0) > 0 && (m.height ?: 0) > 0) m.width!!.toFloat() / m.height!! else if (p.platform == "tiktok") 9f / 16f else 4f / 5f
        Box(Modifier.fillMaxWidth().heightIn(max = 420.dp).aspectRatio(ratio.coerceIn(0.56f, 1.9f), matchHeightConstraintsFirst = ratio < 1f).clip(RoundedCornerShape(18.dp))) {
            NetImage(m.thumb.ifEmpty { m.url }, Modifier.fillMaxSize(), alignment = Alignment.Center)
            if (m.isVideo) PlayBadge(Modifier.align(Alignment.Center), 52.dp)
        }
        return
    }
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        shown.chunked(2).forEachIndexed { row, pair ->
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                pair.forEachIndexed { col, m ->
                    val i = row * 2 + col
                    Box(Modifier.weight(1f).aspectRatio(1f).clip(RoundedCornerShape(14.dp))) {
                        NetImage(m.thumb.ifEmpty { m.url }, Modifier.fillMaxSize(), alignment = Alignment.Center)
                        if (m.isVideo) PlayBadge(Modifier.align(Alignment.Center), 38.dp)
                        val more = p.media.size - shown.size
                        if (i == shown.lastIndex && more > 0) {
                            Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.5f)), contentAlignment = Alignment.Center) {
                                Txt("+$more", AppText.display(28.sp, Color.White))
                            }
                        }
                    }
                }
                if (pair.size == 1) Spacer(Modifier.weight(1f))
            }
        }
    }
}

/** Detail posting: media bisa digeser (video diputar di aplikasi, foto dibuka layar penuh), teks lengkap, dan tautan asli. */
@Composable
fun PostDetailScreen(p: SocialPost) {
    val c = LocalColors.current
    val nav = LocalNav.current
    val open = rememberOpenUrl()
    val photos = rememberLoad { Api.members(it) }.data?.associate { it.id to it.img }.orEmpty()
    LazyColumn(contentPadding = pagePadding()) {
        item {
            Column(Modifier.fillMaxWidth().appCard(24.dp).padding(14.dp)) {
                Row(Modifier.pressable({ if (p.memberId.isNotEmpty()) nav.push(Route.Member(p.memberId, p.memberName, photos[p.memberId].orEmpty())) })) { PostHeader(p, photos[p.memberId].orEmpty()) }
                if (p.text.isNotEmpty()) {
                    VGap(12.dp)
                    Txt(p.text, AppText.body(16.sp, c.ink, 500, 1.5f))
                }
                VGap(10.dp)
                Txt(
                    (if (p.dateApprox) "Pertama terlihat " else "") + "${fmtDate(p.date, "EEEE, d MMM yyyy")} · ${fmtTime(p.date)}",
                    AppText.body(12.5.sp, c.inkSoft),
                )
            }
            VGap(14.dp)
        }
        if (p.media.isNotEmpty()) item {
            val pager = rememberPagerState { p.media.size }
            HorizontalPager(pager, pageSpacing = 10.dp) { i ->
                val m = p.media[i]
                if (m.isVideo) {
                    MediaPlayer(
                        MediaSource(m.url),
                        title = p.memberName.ifEmpty { p.authorName },
                        label = p.platformLabel.uppercase(),
                        ratio = if ((m.width ?: 0) > 0 && (m.height ?: 0) > 0) m.width!!.toFloat() / m.height!! else if (p.platform == "tiktok") 9f / 16f else 16f / 9f,
                        poster = m.thumb,
                        autoplay = i == 0,
                        active = pager.currentPage == i,
                    )
                } else {
                    val images = p.media.filter { !it.isVideo }.map { it.url }
                    NetImage(
                        m.url,
                        Modifier.fillMaxWidth().aspectRatio(
                            if ((m.width ?: 0) > 0 && (m.height ?: 0) > 0) (m.width!!.toFloat() / m.height!!).coerceIn(0.6f, 1.8f) else 4f / 5f,
                        ).clip(RoundedCornerShape(22.dp)).pressable({ nav.push(Route.Shots(images, images.indexOf(m.url).coerceAtLeast(0), p.memberName)) }, 0.99f),
                        alignment = Alignment.Center,
                    )
                }
            }
            if (p.media.size > 1) {
                VGap(10.dp)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                    repeat(p.media.size) { i ->
                        Box(Modifier.padding(horizontal = 3.dp).size(if (pager.currentPage == i) 18.dp else 7.dp, 7.dp).background(if (pager.currentPage == i) c.brand else c.inkSoft.copy(alpha = 0.35f), CircleShape))
                    }
                }
            }
            VGap(12.dp)
            // Unduh media ke Download/JKT48Connect: yang sedang tampil, atau semuanya sekaligus.
            val download = rememberDownloader()
            val items = downloadItems(p)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                LiquidButton(onClick = { download(listOf(items[pager.currentPage.coerceIn(0, items.lastIndex)])) }, modifier = Modifier.weight(1f).height(48.dp)) {
                    Image(Icons.Rounded.Download, null, Modifier.size(18.dp), colorFilter = ColorFilter.tint(c.brand))
                    Txt(if (p.media[pager.currentPage.coerceIn(0, p.media.lastIndex)].isVideo) "Unduh video" else "Unduh foto", AppText.body(14.sp, c.ink, 800), maxLines = 1)
                }
                if (items.size > 1) LiquidButton(onClick = { download(items) }, modifier = Modifier.weight(1f).height(48.dp)) {
                    Image(Icons.Rounded.DownloadForOffline, null, Modifier.size(18.dp), colorFilter = ColorFilter.tint(c.brand))
                    Txt("Unduh semua (${items.size})", AppText.body(14.sp, c.ink, 800), maxLines = 1)
                }
            }
            VGap(14.dp)
        }
        item {
            Row(Modifier.fillMaxWidth().appCard(20.dp).padding(16.dp), horizontalArrangement = Arrangement.SpaceAround) {
                listOf(Icons.Rounded.Favorite to p.likes, Icons.Rounded.ChatBubbleOutline to p.comments, Icons.Rounded.Repeat to p.reposts, Icons.Rounded.Visibility to p.views)
                    .filter { it.second != null }
                    .forEach { (icon, v) ->
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Image(icon, null, Modifier.size(20.dp), colorFilter = ColorFilter.tint(c.brand))
                            VGap(4.dp)
                            Txt(fmtCompact(v), AppText.body(15.sp, c.ink, 800))
                        }
                    }
            }
            VGap(14.dp)
            LiquidButton(onClick = { open(p.url) }, modifier = Modifier.height(48.dp), contentPadding = PaddingValues(horizontal = 18.dp)) {
                Txt("Buka di ${p.platformLabel}", AppText.body(14.sp, c.ink, 800))
                Image(Icons.AutoMirrored.Rounded.OpenInNew, null, Modifier.size(16.dp), colorFilter = ColorFilter.tint(c.brand))
            }
            VGap(10.dp)
            Micro("Arsip publik · angka terakhir terlihat, bisa berbeda dari aslinya", color = c.inkSoft, size = 9f)
        }
    }
}

/**
 * Pengunduh media: di Android 8–9 meminta izin penyimpanan dulu, lalu mengantrekan unduhan dan memberi tahu
 * lewat toast. File tersimpan di folder Download/JKT48Connect (tampil di galeri & file manager).
 */
@Composable
fun rememberDownloader(): (List<Downloads.Item>) -> Unit {
    val context = LocalContext.current
    var pending by remember { mutableStateOf<List<Downloads.Item>>(emptyList()) }
    fun start(items: List<Downloads.Item>) {
        val n = Downloads.enqueue(context, items)
        val msg = if (n > 0) "Mengunduh $n file ke Download/${Downloads.FOLDER}" else "Gagal memulai unduhan"
        android.widget.Toast.makeText(context, msg, android.widget.Toast.LENGTH_SHORT).show()
    }
    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) start(pending) else android.widget.Toast.makeText(context, "Izin penyimpanan dibutuhkan untuk mengunduh", android.widget.Toast.LENGTH_SHORT).show()
        pending = emptyList()
    }
    return { items ->
        val needs = Build.VERSION.SDK_INT < 29 &&
            ContextCompatCheck.denied(context, Manifest.permission.WRITE_EXTERNAL_STORAGE)
        if (needs) {
            pending = items
            permission.launch(Manifest.permission.WRITE_EXTERNAL_STORAGE)
        } else start(items)
    }
}

private object ContextCompatCheck {
    fun denied(context: android.content.Context, perm: String) =
        context.checkSelfPermission(perm) != android.content.pm.PackageManager.PERMISSION_GRANTED
}
