package app.jkt48connect.ui.components

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.OpenInNew
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Visibility
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.jkt48connect.core.BirthdayEntry
import app.jkt48connect.core.LiveSession
import app.jkt48connect.core.NewsItem
import app.jkt48connect.core.RecentLive
import app.jkt48connect.core.TheaterShow
import app.jkt48connect.core.daysUntil
import app.jkt48connect.ui.LocalNav
import app.jkt48connect.ui.Route
import app.jkt48connect.core.fmtCompact
import app.jkt48connect.core.fmtDate
import app.jkt48connect.core.fmtDuration
import app.jkt48connect.core.fmtTime
import app.jkt48connect.core.parseInstant
import app.jkt48connect.core.parseWib
import app.jkt48connect.core.timeAgo
import app.jkt48connect.ui.glass.glass
import app.jkt48connect.ui.theme.AppText
import app.jkt48connect.ui.theme.LocalColors
import com.kyant.backdrop.backdrops.layerBackdrop
import com.kyant.backdrop.backdrops.rememberLayerBackdrop
import com.kyant.shapes.Capsule

@Composable
fun rememberOpenUrl(): (String) -> Unit {
    val context = LocalContext.current
    return { url ->
        if (url.isNotEmpty()) runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
    }
}

/**
 * Kartu besar member yang sedang live: foto penuh, pil kaca merah "LIVE" yang membiaskan foto di belakangnya.
 * Live Showroom ditonton langsung di aplikasi; live IDN tidak bisa, jadi dibuka di idn.app.
 */
@Composable
fun LiveCard(live: LiveSession, modifier: Modifier = Modifier, height: Dp = 260.dp) {
    val open = rememberOpenUrl()
    val nav = LocalNav.current
    val photoBackdrop = rememberLayerBackdrop()
    Box(modifier.height(height).fillMaxWidth().pressable({ if (live.watchable) nav.push(Route.Watch(live)) else open(live.link) }).clip(RoundedCornerShape(28.dp))) {
        Box(Modifier.fillMaxSize().layerBackdrop(photoBackdrop)) {
            NetImage(live.photo, Modifier.fillMaxSize(), alignment = if (live.banner.isNotEmpty()) Alignment.Center else Alignment.TopCenter, fallback = live.name)
            Box(Modifier.fillMaxSize().background(PhotoScrim))
        }
        Row(
            Modifier
                .padding(14.dp)
                .glass(photoBackdrop, Capsule(), Color.Transparent, tint = Color(0xFFE1243A), lensHeight = 8.dp, lensAmount = 16.dp, shadow = false)
                .padding(horizontal = 12.dp, vertical = 7.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            SignalBars(color = Color.White, height = 11.dp)
            Spacer(Modifier.width(7.dp))
            Txt("LIVE · ${live.platformLabel.uppercase()}", AppText.micro(Color.White))
        }
        // Tonton di aplikasi (Showroom) atau buka di platform asli (IDN).
        Row(
            Modifier.align(Alignment.TopEnd).padding(14.dp).clip(Capsule()).background(Color.Black.copy(alpha = 0.45f)).padding(horizontal = 11.dp, vertical = 7.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Image(if (live.watchable) Icons.Rounded.PlayArrow else Icons.Rounded.OpenInNew, null, Modifier.size(14.dp), colorFilter = ColorFilter.tint(Color.White))
            Spacer(Modifier.width(5.dp))
            Txt(if (live.watchable) "TONTON" else "BUKA IDN", AppText.micro(Color.White))
        }
        Column(Modifier.align(Alignment.BottomStart).padding(18.dp, 0.dp, 18.dp, 16.dp)) {
            Txt(live.name.uppercase(), AppText.display(32.sp, Color.White), maxLines = 1)
            Spacer(Modifier.height(4.dp))
            Txt(listOf(live.title, timeAgo(live.startedAt)).filter { it.isNotEmpty() }.joinToString(" · "), AppText.body(13.sp, Color.White.copy(alpha = 0.75f)), maxLines = 1)
        }
    }
}

/** Kartu jadwal: tanggal besar di kiri (merah bila < 24 jam lagi), judul, jam, deret avatar member. */
@Composable
fun ShowTile(show: TheaterShow, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val c = LocalColors.current
    val t = parseWib(show.date)
    val ms = parseInstant(show.date)?.toEpochMilli()?.minus(System.currentTimeMillis())
    val soon = ms != null && ms in 0..86_400_000
    Row(modifier.fillMaxWidth().pressable(onClick).appCard(24.dp).padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(
            Modifier
                .width(60.dp)
                .clip(RoundedCornerShape(18.dp))
                .then(if (soon) Modifier.background(c.brandGradient) else Modifier.background(c.bg.copy(alpha = if (c.dark) 0.6f else 1f)))
                .padding(vertical = 10.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Txt(t?.dayOfMonth?.toString() ?: "–", AppText.display(28.sp, if (soon) Color.White else c.ink))
            Spacer(Modifier.height(2.dp))
            Txt(fmtDate(show.date, "MMM").uppercase(), AppText.micro(if (soon) Color.White.copy(alpha = 0.7f) else c.inkSoft, 9.5.sp))
        }
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                CategoryPill(show.category)
                Spacer(Modifier.width(8.dp))
                Txt(fmtTime(show.date), AppText.mono(11.sp, c.inkSoft))
            }
            Spacer(Modifier.height(6.dp))
            Txt(show.title, AppText.body(15.sp, c.ink, 700), maxLines = 2)
            if (show.members.isNotEmpty()) {
                Spacer(Modifier.height(8.dp))
                AvatarStack(show.members.map { it.img })
            }
        }
    }
}

/** Deret foto bulat yang saling menumpuk. */
@Composable
fun AvatarStack(images: List<String>, size: Dp = 26.dp, max: Int = 6, ring: Color = LocalColors.current.card, extraColor: Color = LocalColors.current.inkSoft) {
    val shown = images.take(max)
    val extra = images.size - shown.size
    Box(Modifier.height(size)) {
        shown.forEachIndexed { i, url ->
            NetImage(url, Modifier.offset(x = size * 0.68f * i).size(size).clip(CircleShape).border(2.dp, ring, CircleShape))
        }
        if (extra > 0) {
            Txt("+$extra", AppText.mono(11.sp, extraColor), Modifier.offset(x = size * 0.68f * shown.size + 4.dp, y = size * 0.2f))
        }
    }
}

/** Baris rekap live: foto, nama, platform, durasi, penonton. */
@Composable
fun RecentTile(r: RecentLive, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val c = LocalColors.current
    Row(modifier.fillMaxWidth().pressable(onClick).appCard(24.dp).padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
        NetImage(r.img, Modifier.size(62.dp, 74.dp).clip(RoundedCornerShape(18.dp)), fallback = r.name)
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Micro(r.platformLabel, color = if (r.platform == "idn") c.brand else c.inkSoft)
            Spacer(Modifier.height(4.dp))
            Txt(r.name, AppText.body(16.sp, c.ink, 800), maxLines = 1)
            Spacer(Modifier.height(2.dp))
            Txt("${fmtDate(r.start, "d MMM")} · ${fmtTime(r.start)}", AppText.mono(11.sp, c.inkSoft))
        }
        Column(horizontalAlignment = Alignment.End) {
            Txt(fmtDuration(r.durationMs), AppText.display(22.sp, c.ink))
            Spacer(Modifier.height(4.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Image(Icons.Rounded.Visibility, null, Modifier.size(13.dp), colorFilter = ColorFilter.tint(c.inkSoft))
                Spacer(Modifier.width(3.dp))
                Txt(fmtCompact(r.viewers), AppText.mono(11.sp, c.inkSoft))
            }
        }
        Spacer(Modifier.width(6.dp))
    }
}

/** Baris berita: nomor, kategori, judul, tanggal. */
@Composable
fun NewsTile(n: NewsItem, index: Int?, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val c = LocalColors.current
    Row(modifier.fillMaxWidth().pressable(onClick).appCard(22.dp).padding(14.dp), verticalAlignment = Alignment.Top) {
        if (index != null) Txt((index + 1).toString().padStart(2, '0'), AppText.mono(12.sp, c.brand, androidx.compose.ui.text.font.FontWeight.SemiBold), Modifier.width(30.dp))
        Column(Modifier.weight(1f)) {
            Micro(n.category)
            Spacer(Modifier.height(4.dp))
            Txt(n.title, AppText.body(15.sp, c.ink, 700), maxLines = 2)
            Spacer(Modifier.height(4.dp))
            Txt(fmtDate(n.date, "d MMMM yyyy"), AppText.mono(11.sp, c.inkSoft))
        }
        ArrowCircle(bg = c.bg.copy(alpha = if (c.dark) 0.6f else 1f), fg = c.brand)
    }
}

/** Foto bulat + nama + "Hari ini / N hari"; yang berulang tahun hari ini diberi cincin merah. */
@Composable
fun BirthdayBubble(b: BirthdayEntry, onClick: () -> Unit) {
    val c = LocalColors.current
    val d = daysUntil(b.birthdate)
    Column(Modifier.width(82.dp).pressable(onClick), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            Modifier
                .size(74.dp)
                .clip(CircleShape)
                .then(if (d == 0) Modifier.background(c.brandGradient) else Modifier.border(2.dp, c.line, CircleShape))
                .padding(3.dp)
        ) {
            NetImage(b.img, Modifier.fillMaxSize().clip(CircleShape), fallback = b.name)
        }
        Spacer(Modifier.height(6.dp))
        Txt(b.name.substringBefore(' '), AppText.body(12.5.sp, c.ink, 700), maxLines = 1)
        Txt(if (d == 0) "HARI INI" else "$d HARI", AppText.micro(if (d == 0) c.brand else c.inkSoft, 9.5.sp))
    }
}

/** Kartu statistik kecil (label mikro + nilai). */
@Composable
fun StatBox(label: String, modifier: Modifier = Modifier, accent: Boolean = false, value: @Composable () -> Unit) {
    val c = LocalColors.current
    Column(
        modifier
            .then(if (accent) Modifier.clip(RoundedCornerShape(22.dp)).background(c.brandGradient) else Modifier.appCard(22.dp))
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        Txt(label.uppercase(), AppText.micro(if (accent) Color.White.copy(alpha = 0.7f) else c.inkSoft, 9.5.sp))
        Spacer(Modifier.height(4.dp))
        value()
    }
}
