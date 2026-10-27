package app.jkt48connect.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.height

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.OpenInNew
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.jkt48connect.core.Api
import app.jkt48connect.core.Fetch
import app.jkt48connect.core.LiveSession
import app.jkt48connect.core.fmtTime
import app.jkt48connect.core.timeAgo
import app.jkt48connect.ui.LocalInsets
import app.jkt48connect.ui.LocalNav
import app.jkt48connect.ui.Route
import app.jkt48connect.ui.components.NetImage
import app.jkt48connect.ui.components.Txt
import app.jkt48connect.ui.components.VGap
import app.jkt48connect.ui.components.appCard
import app.jkt48connect.ui.components.pressable
import app.jkt48connect.ui.components.rememberOpenUrl
import app.jkt48connect.ui.player.MediaPlayer
import app.jkt48connect.ui.player.MediaSource
import app.jkt48connect.ui.theme.AppText
import app.jkt48connect.ui.theme.LocalColors
import kotlinx.coroutines.delay

/**
 * Menonton live Showroom di aplikasi (HLS langsung dari CDN Showroom). Live IDN tidak dibuka di sini —
 * kartunya mengarah ke idn.app. Daftar live diperiksa tiap 30 detik: bila sesi hilang, siaran dianggap selesai;
 * bila pemutar gagal, URL stream terbaru diambil lalu pemutar dibuat ulang (sekali per kegagalan).
 */
@Composable
fun WatchScreen(start: LiveSession) {
    val c = LocalColors.current
    val nav = LocalNav.current
    val open = rememberOpenUrl()
    var live by remember(start.id) { mutableStateOf(start) }
    var others by remember { mutableStateOf<List<LiveSession>>(emptyList()) }
    var gone by remember { mutableStateOf(false) }
    var attempt by remember { mutableIntStateOf(0) }
    var refreshNow by remember { mutableIntStateOf(0) }

    LaunchedEffect(start.id, refreshNow) {
        while (true) {
            runCatching { Api.live(if (refreshNow > 0) Fetch.Force else Fetch.Normal) }.onSuccess { list ->
                val now = list.find { it.id == start.id }
                if (now != null && now.watchable) live = now
                gone = now == null
                others = list.filter { it.id != start.id }
            }
            delay(30_000)
        }
    }

    LazyColumn(contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = LocalInsets.current.calculateTopPadding(), bottom = 40.dp)) {
        item {
            val streams = live.streams
            if (streams.isEmpty()) {
                Box(Modifier.fillMaxWidth().appCard(22.dp).padding(20.dp)) {
                    Txt("Live ini tidak bisa diputar di aplikasi.", AppText.body(15.sp, c.ink, 700))
                }
            } else {
                // URL stream berganti (diperbarui dari server) atau percobaan ulang → pemutar baru.
                key(streams.first().url, attempt) {
                    MediaPlayer(
                        MediaSource(
                            streams.first().url,
                            hls = true,
                            live = true,
                            liveSince = live.startedAt,
                            variants = streams.mapIndexed { i, s -> qualityLabel(s.label, i) to s.url },
                        ),
                        title = live.name,
                        label = "LIVE · ${live.platformLabel.uppercase()}",
                        poster = live.banner.ifEmpty { live.img },
                        ratio = 9f / 16f,
                        autoplay = true,
                        onFatal = {
                            if (attempt < 3) {
                                attempt++
                                refreshNow++
                            }
                        },
                    )
                }
            }
            if (gone) {
                VGap(10.dp)
                Txt("Siaran ini sudah tidak ada di daftar live. Rekamannya akan muncul di Recent.", AppText.body(13.sp, c.inkSoft))
            }
            VGap(16.dp)
            Column(Modifier.fillMaxWidth().appCard(24.dp).padding(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    NetImage(live.img.ifEmpty { live.avatar }, Modifier.size(58.dp).clip(RoundedCornerShape(18.dp)), fallback = live.name)
                    Spacer(Modifier.width(14.dp))
                    Column(Modifier.weight(1f)) {
                        Txt("${live.platformLabel.uppercase()}${if (gone) "" else " · LIVE"}", AppText.micro(c.brand))
                        Txt(live.name.uppercase(), AppText.display(26.sp, c.ink), maxLines = 1)
                        Txt("Mulai ${fmtTime(live.startedAt)} · ${timeAgo(live.startedAt)}", AppText.mono(11.sp, c.inkSoft))
                    }
                }
                if (live.title.isNotEmpty()) {
                    VGap(12.dp)
                    Txt("“${live.title}”", AppText.body(15.sp, c.ink))
                }
                VGap(12.dp)
                app.jkt48connect.ui.glass.LiquidButton(onClick = { open(live.link) }, modifier = Modifier.height(40.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Txt("Buka di Showroom", AppText.body(13.sp, c.ink, 700))
                    Image(Icons.Rounded.OpenInNew, null, Modifier.size(14.dp), colorFilter = ColorFilter.tint(c.brand))
                }
            }
            if (others.isNotEmpty()) {
                VGap(22.dp)
                Txt("LIVE LAINNYA", AppText.micro(c.inkSoft), Modifier.padding(start = 4.dp, bottom = 8.dp))
            }
        }
        items(others, key = { it.id }) { o ->
            Row(
                Modifier.padding(bottom = 10.dp).fillMaxWidth().pressable({ if (o.watchable) nav.push(Route.Watch(o)) else open(o.link) }).appCard(22.dp).padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                NetImage(o.img.ifEmpty { o.avatar }, Modifier.size(44.dp).clip(CircleShape), fallback = o.name)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Txt(o.name, AppText.body(15.sp, c.ink, 800), maxLines = 1)
                    Txt(if (o.watchable) "Showroom · tonton di aplikasi" else "${o.platformLabel} · dibuka di ${o.platformLabel}", AppText.body(12.sp, c.inkSoft), maxLines = 1)
                }
                Box(
                    Modifier.size(34.dp).clip(CircleShape).background(if (o.watchable) c.brand else c.inkSoft.copy(alpha = 0.15f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Image(if (o.watchable) Icons.Rounded.PlayArrow else Icons.Rounded.OpenInNew, null, Modifier.size(18.dp), colorFilter = ColorFilter.tint(if (o.watchable) Color.White else c.ink))
                }
            }
        }
    }
}

/** "original quality" → "Asli", "Medium quality" → "Sedang", "low quality" → "Rendah". */
private fun qualityLabel(label: String, i: Int): String {
    val l = label.lowercase()
    return when {
        "original" in l || "high" in l -> "Asli"
        "medium" in l -> "Sedang"
        "low" in l -> "Rendah"
        label.isNotEmpty() -> label
        else -> "Pilihan ${i + 1}"
    }
}
