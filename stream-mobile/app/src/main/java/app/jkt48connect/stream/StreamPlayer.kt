package app.jkt48connect.stream

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.*
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.ui.PlayerView
import app.jkt48connect.stream.ui.glass.*
import app.jkt48connect.stream.ui.theme.*
import android.net.Uri
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONObject

/**
 * Pemutar satu halaman: video (bila ada), judul, pilihan bagian, lalu obrolan penonton untuk theater.
 * Data [data] berisi `items` (URL bagian) dan `kind`. [selected] dipakai untuk membuka obrolan.
 */
@Composable fun PlayerPage(data: JSONObject, selected: JSONObject?) {
    val parts = data.optJSONArray("items")?.rows().orEmpty()
    var index by remember { mutableIntStateOf(0) }
    val kind = data.optString("kind")
    Column(Modifier.fillMaxSize()) {
        if (parts.isNotEmpty()) {
            parts.getOrNull(index)?.let { part -> NativePlayer(part.getString("url"), part.optBoolean("hls")) }
        }
        Column(Modifier.padding(horizontal = 16.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Micro(if (kind == "chat") "Obrolan penonton" else "Sedang diputar", LocalColors.current.brand)
            Label(data.optString("title"), 24, true)
            if (parts.size > 1) {
                LiquidTabs(parts.map { TabItem(it.optString("label")) }, index, { index = it }, Modifier.fillMaxWidth(), segmented = true)
            }
        }
        if ((kind == "theater" || kind == "chat") && selected != null) {
            Chat(selected.getString("id"), Modifier.weight(1f))
        }
    }
}

@Composable fun NativePlayer(url: String, hls: Boolean) {
    val context = LocalContext.current
    val player = remember(url) {
        val factory = DefaultHttpDataSource.Factory().setDefaultRequestProperties(mapOf("Authorization" to "Bearer ${StreamApi.token}"))
            .setConnectTimeoutMs(15_000).setReadTimeoutMs(20_000).setAllowCrossProtocolRedirects(false)
        ExoPlayer.Builder(context).setMediaSourceFactory(DefaultMediaSourceFactory(factory)).build().apply {
            val item = MediaItem.Builder().setUri(url)
            if (hls) item.setMimeType(MimeTypes.APPLICATION_M3U8)
            setMediaItem(item.build())
            prepare()
            playWhenReady = true
        }
    }
    val lifecycle = (context as? androidx.activity.ComponentActivity)?.lifecycle
    DisposableEffect(player, lifecycle) {
        val observer = androidx.lifecycle.LifecycleEventObserver { _, event ->
            if (event == androidx.lifecycle.Lifecycle.Event.ON_PAUSE) player.pause()
        }
        lifecycle?.addObserver(observer)
        onDispose {
            lifecycle?.removeObserver(observer)
            player.release()
        }
    }
    AndroidView(
        factory = {
            PlayerView(it).apply {
                this.player = player
                setShowBuffering(PlayerView.SHOW_BUFFERING_WHEN_PLAYING)
                keepScreenOn = true
            }
        },
        modifier = Modifier.fillMaxWidth().aspectRatio(16f / 9f).background(Color.Black),
        update = { it.player = player },
    )
}

/** Obrolan penonton: long-poll ke server, pesan terbaru di bawah, kolom kirim di bawah. */
@Composable fun Chat(room: String, modifier: Modifier = Modifier) {
    var rows by remember(room) { mutableStateOf<List<JSONObject>>(emptyList()) }
    var text by remember { mutableStateOf("") }
    var error by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()
    LaunchedEffect(room) {
        var after = 0L
        while (true) {
            runCatching { StreamApi.request("/chat/${Uri.encode(room)}?after=$after&wait=20") }
                .onSuccess {
                    val batch = it.optJSONArray("items")?.rows().orEmpty()
                    rows = (rows + batch).distinctBy { r -> r.optLong("id") }.takeLast(150)
                    batch.lastOrNull()?.let { row -> after = row.optLong("id") }
                    error = ""
                }
                .onFailure {
                    error = it.message.orEmpty()
                    delay(3_000)
                }
        }
    }
    Column(modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Micro("Obrolan penonton")
        LazyColumn(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp), reverseLayout = true) {
            items(rows.reversed(), key = { it.optLong("id") }) { m ->
                GlassCard(padding = 12.dp, spacing = 2.dp) {
                    Label(m.optString("name"), 12, true, LocalColors.current.brand)
                    Label(m.optString("message"), 14)
                }
            }
        }
        if (error.isNotEmpty()) Label(error, 12, color = LocalColors.current.brand)
        Row(Modifier.imePadding().padding(bottom = 14.dp), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Field("Pesan", text) { text = it.take(500) }
            LiquidButton(
                onClick = {
                    if (text.isNotBlank()) {
                        scope.launch {
                            runCatching { StreamApi.request("/chat/${Uri.encode(room)}", "POST", JSONObject().put("message", text)) }
                                .onSuccess { text = "" }
                                .onFailure { error = it.message.orEmpty() }
                        }
                    }
                },
                modifier = Modifier.height(52.dp),
                tint = LocalColors.current.brand,
            ) {
                Label("Kirim", 14, true, Color.White)
            }
        }
    }
}
