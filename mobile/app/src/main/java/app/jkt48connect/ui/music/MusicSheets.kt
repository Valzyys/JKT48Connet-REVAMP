package app.jkt48connect.ui.music

import android.content.Context
import android.content.Intent
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.PlaylistAdd
import androidx.compose.material.icons.automirrored.rounded.QueueMusic
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Bedtime
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.FavoriteBorder
import androidx.compose.material.icons.rounded.KeyboardArrowUp
import androidx.compose.material.icons.rounded.MoreVert
import androidx.compose.material.icons.rounded.PlaylistPlay
import androidx.compose.material.icons.rounded.RemoveCircleOutline
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material.icons.rounded.Speed
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.isSpecified
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.jkt48connect.core.Music
import app.jkt48connect.core.MusicSheet
import app.jkt48connect.core.MusicTrack
import app.jkt48connect.ui.components.Micro
import app.jkt48connect.ui.components.Txt
import app.jkt48connect.ui.components.pressable
import app.jkt48connect.ui.glass.LiquidButton
import app.jkt48connect.ui.glass.LocalBackdrop
import app.jkt48connect.ui.glass.glass
import app.jkt48connect.ui.theme.AppText
import app.jkt48connect.ui.theme.LocalColors
import com.kyant.shapes.Capsule
import com.kyant.shapes.RoundedRectangle
import kotlinx.coroutines.delay

/** Bagikan tautan lagu lewat lembar bagikan sistem. */
fun shareMusicTrack(context: Context, t: MusicTrack) {
    val text = "${t.title} – ${t.artist.ifEmpty { "JKT48" }}\nhttps://music.youtube.com/watch?v=${t.id}"
    val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text)
    runCatching { context.startActivity(Intent.createChooser(send, null).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
}

/**
 * Lembar aksi musik (menu lagu, pilih playlist, playlist baru, ganti nama, timer tidur, kecepatan): kaca yang naik
 * dari bawah di atas semua layar (termasuk layar Sedang diputar). Ketuk luar / kembali untuk menutup.
 */
@Composable
fun MusicSheetHost() {
    val sheet = Music.sheet
    val c = LocalColors.current
    val navBar = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
    AnimatedVisibility(sheet != null, enter = fadeIn(tween(160)), exit = fadeOut(tween(160))) {
        Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.35f)).clickable(remember { MutableInteractionSource() }, null) { Music.sheet = null })
    }
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.BottomCenter) {
        AnimatedVisibility(
            sheet != null,
            enter = slideInVertically(spring(dampingRatio = 0.85f, stiffness = 420f)) { it } + fadeIn(tween(120)),
            exit = slideOutVertically(tween(200)) { it } + fadeOut(tween(160)),
        ) {
            var last by remember { mutableStateOf(sheet) }
            if (sheet != null) last = sheet
            BackHandler(sheet != null) { Music.sheet = null }
            Column(
                Modifier
                    .padding(start = 10.dp, end = 10.dp, bottom = navBar + 10.dp)
                    .imePadding()
                    .widthIn(max = 560.dp)
                    .fillMaxWidth()
                    .heightIn(max = 620.dp)
                    .glass(
                        LocalBackdrop.current, RoundedRectangle(32.dp),
                        if (c.dark) Color(0xFF1C1C1E).copy(alpha = 0.86f) else Color.White.copy(alpha = 0.9f),
                        blur = 16.dp, lensHeight = 20.dp, lensAmount = 40.dp,
                    )
                    .clickable(remember { MutableInteractionSource() }, null) {}
                    .padding(vertical = 10.dp),
            ) {
                Box(Modifier.align(Alignment.CenterHorizontally).size(36.dp, 5.dp).background(c.inkSoft.copy(alpha = 0.35f), Capsule()))
                Spacer(Modifier.height(6.dp))
                AnimatedContent(last, transitionSpec = { (fadeIn(tween(200)) + scaleIn(tween(200), 0.97f)) togetherWith fadeOut(tween(120)) }, label = "sheet") { s ->
                    Column(Modifier.verticalScroll(rememberScrollState())) {
                        when (s) {
                            is MusicSheet.Track -> TrackActions(s)
                            is MusicSheet.AddTo -> AddToPlaylist(s.track)
                            is MusicSheet.NewPlaylist -> NameInput("Playlist baru", "Nama playlist", "", "Buat") { name -> Music.createPlaylist(name, s.track); Music.sheet = null }
                            is MusicSheet.Rename -> NameInput("Ganti nama", "Nama playlist", s.playlist.name, "Simpan") { name -> Music.renamePlaylist(s.playlist.id, name); Music.sheet = null }
                            MusicSheet.Sleep -> SleepOptions()
                            MusicSheet.Speed -> SpeedOptions()
                            null -> {}
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SheetHeader(t: MusicTrack) {
    val c = LocalColors.current
    Row(Modifier.fillMaxWidth().padding(18.dp, 6.dp, 18.dp, 10.dp), verticalAlignment = Alignment.CenterVertically) {
        MusicCover(t, Modifier.size(52.dp), 12.dp)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Txt(t.title, AppText.body(16.sp, c.ink, 800), maxLines = 1)
            Txt(t.artist.ifEmpty { "JKT48" }, AppText.body(13.sp, c.inkSoft), maxLines = 1)
        }
    }
}

@Composable
private fun SheetTitle(text: String) {
    Txt(text, AppText.title(19.sp, LocalColors.current.ink), Modifier.padding(20.dp, 6.dp, 20.dp, 10.dp), maxLines = 1)
}

@Composable
private fun ActionRow(icon: ImageVector, label: String, tint: Color = Color.Unspecified, trailing: String? = null, onClick: () -> Unit) {
    val c = LocalColors.current
    val color = if (tint.isSpecified) tint else c.ink
    Row(
        Modifier.fillMaxWidth().pressable(onClick, 0.98f).padding(horizontal = 20.dp, vertical = 13.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Image(icon, null, Modifier.size(22.dp), colorFilter = ColorFilter.tint(color))
        Spacer(Modifier.width(16.dp))
        Txt(label, AppText.body(15.sp, color, 650), Modifier.weight(1f), maxLines = 1)
        if (trailing != null) Txt(trailing, AppText.body(13.sp, c.inkSoft, 600), maxLines = 1)
    }
}

@Composable
private fun TrackActions(s: MusicSheet.Track) {
    val context = LocalContext.current
    val c = LocalColors.current
    val t = s.track
    val close = { Music.sheet = null }
    SheetHeader(t)
    val isCurrent = Music.current?.id == t.id
    if (!isCurrent) {
        ActionRow(Icons.Rounded.PlaylistPlay, "Putar berikutnya") { Music.playNext(context, t); close() }
        ActionRow(Icons.AutoMirrored.Rounded.QueueMusic, "Tambahkan ke antrean") { Music.addToQueue(context, t); close() }
    }
    val liked = Music.isLiked(t.id)
    ActionRow(if (liked) Icons.Rounded.Favorite else Icons.Rounded.FavoriteBorder, if (liked) "Hapus dari Disukai" else "Sukai", tint = if (liked) c.brand else Color.Unspecified) { Music.toggleLike(t); close() }
    ActionRow(Icons.AutoMirrored.Rounded.PlaylistAdd, "Tambahkan ke playlist") { Music.sheet = MusicSheet.AddTo(t) }
    s.queueIndex?.let { qi ->
        if (qi != Music.index) {
            if (qi > Music.index + 1) ActionRow(Icons.Rounded.KeyboardArrowUp, "Jadikan berikutnya") { Music.move(qi, Music.index + 1); close() }
            ActionRow(Icons.Rounded.RemoveCircleOutline, "Hapus dari antrean") { Music.removeAt(qi); close() }
        }
    }
    when (val from = s.from) {
        null, "liked" -> {}
        "history" -> {}
        else -> ActionRow(Icons.Rounded.RemoveCircleOutline, "Hapus dari playlist ini") { Music.removeFromPlaylist(from, t.id); close() }
    }
    if (s.player) {
        val sleep = when {
            Music.sleepEndOfTrack -> "Akhir lagu"
            Music.sleepAt > 0 -> "Aktif"
            else -> "Mati"
        }
        ActionRow(Icons.Rounded.Bedtime, "Timer tidur", trailing = sleep) { Music.sheet = MusicSheet.Sleep }
        ActionRow(Icons.Rounded.Speed, "Kecepatan putar", trailing = speedLabel(Music.speed)) { Music.sheet = MusicSheet.Speed }
    }
    ActionRow(Icons.Rounded.Share, "Bagikan") { shareMusicTrack(context, t); close() }
}

@Composable
private fun AddToPlaylist(t: MusicTrack) {
    val c = LocalColors.current
    SheetTitle("Tambahkan ke playlist")
    ActionRow(Icons.Rounded.Add, "Playlist baru", tint = c.brand) { Music.sheet = MusicSheet.NewPlaylist(t) }
    Music.playlists.forEach { p ->
        val has = p.tracks.any { it.id == t.id }
        ActionRow(if (has) Icons.Rounded.Check else Icons.AutoMirrored.Rounded.QueueMusic, p.name, trailing = "${p.tracks.size} lagu") {
            Music.addToPlaylist(p.id, t)
            Music.sheet = null
        }
    }
    if (Music.playlists.isEmpty()) Txt("Belum ada playlist. Buat yang pertama!", AppText.body(13.sp, c.inkSoft), Modifier.padding(20.dp, 4.dp, 20.dp, 12.dp))
}

@Composable
private fun NameInput(title: String, hint: String, initial: String, action: String, onDone: (String) -> Unit) {
    val c = LocalColors.current
    var name by remember { mutableStateOf(initial) }
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { delay(250); runCatching { focus.requestFocus() } }
    SheetTitle(title)
    Row(
        Modifier.padding(horizontal = 16.dp).fillMaxWidth().height(50.dp)
            .background(c.ink.copy(alpha = 0.06f), RoundedCornerShape(16.dp))
            .padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.weight(1f), contentAlignment = Alignment.CenterStart) {
            if (name.isEmpty()) Txt(hint, AppText.body(15.sp, c.inkSoft))
            BasicTextField(
                name, { name = it.take(60) },
                singleLine = true,
                textStyle = AppText.body(15.sp, c.ink, 600),
                cursorBrush = SolidColor(c.brand),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = { onDone(name) }),
                modifier = Modifier.fillMaxWidth().focusRequester(focus),
            )
        }
    }
    Row(Modifier.fillMaxWidth().padding(16.dp, 14.dp, 16.dp, 6.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        LiquidButton(onClick = { Music.sheet = null }, modifier = Modifier.weight(1f).height(46.dp)) { Txt("Batal", AppText.body(15.sp, c.ink, 700)) }
        LiquidButton(onClick = { onDone(name) }, modifier = Modifier.weight(1f).height(46.dp), tint = c.brand) { Txt(action, AppText.body(15.sp, Color.White, 800)) }
    }
}

@Composable
private fun SleepOptions() {
    val c = LocalColors.current
    SheetTitle("Timer tidur")
    if (Music.sleepAt > 0) {
        var left by remember { mutableStateOf(0L) }
        LaunchedEffect(Music.sleepAt) { while (true) { left = (Music.sleepAt - System.currentTimeMillis()).coerceAtLeast(0); delay(1000) } }
        Micro("Berhenti dalam ${fmtClock(left)}", Modifier.padding(20.dp, 0.dp, 20.dp, 8.dp), color = c.brand, dot = true)
    } else if (Music.sleepEndOfTrack) {
        Micro("Berhenti di akhir lagu ini", Modifier.padding(20.dp, 0.dp, 20.dp, 8.dp), color = c.brand, dot = true)
    }
    listOf(15, 30, 45, 60, 90).forEach { m -> ActionRow(Icons.Rounded.Bedtime, "$m menit") { Music.setSleep(m); Music.sheet = null } }
    ActionRow(Icons.AutoMirrored.Rounded.QueueMusic, "Akhir lagu ini") { Music.setSleep(-1); Music.sheet = null }
    if (Music.sleepAt > 0 || Music.sleepEndOfTrack) ActionRow(Icons.Rounded.RemoveCircleOutline, "Matikan timer", tint = c.brand) { Music.setSleep(null); Music.sheet = null }
}

private fun speedLabel(v: Float) = if (v == 1f) "Normal" else "${"%.2f".format(v).trimEnd('0').trimEnd('.')}×"

@Composable
private fun SpeedOptions() {
    val c = LocalColors.current
    SheetTitle("Kecepatan putar")
    listOf(0.5f, 0.75f, 1f, 1.25f, 1.5f, 2f).forEach { v ->
        val on = Music.speed == v
        ActionRow(if (on) Icons.Rounded.Check else Icons.Rounded.Speed, speedLabel(v), tint = if (on) c.brand else Color.Unspecified) { Music.changeSpeed(v); Music.sheet = null }
    }
}

/** Pesan singkat kaca di atas layar. */
@Composable
fun MusicToast() {
    val c = LocalColors.current
    val status = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()
    var last by remember { mutableStateOf("") }
    Music.toast?.let { last = it }
    Box(Modifier.fillMaxSize().padding(top = status + 10.dp), contentAlignment = Alignment.TopCenter) {
        AnimatedVisibility(
            Music.toast != null,
            enter = slideInVertically(spring(dampingRatio = 0.7f, stiffness = 500f)) { -it * 2 } + fadeIn(tween(120)),
            exit = slideOutVertically(tween(220)) { -it * 2 } + fadeOut(tween(180)),
        ) {
            Txt(
                last, AppText.body(13.5.sp, c.ink, 700),
                Modifier
                    .padding(horizontal = 24.dp)
                    .glass(LocalBackdrop.current, Capsule(), if (c.dark) Color(0xFF2C2C2E).copy(alpha = 0.85f) else Color.White.copy(alpha = 0.9f), blur = 10.dp, lensHeight = 10.dp, lensAmount = 20.dp)
                    .padding(horizontal = 18.dp, vertical = 11.dp),
                maxLines = 2,
            )
        }
    }
}

/** Ikon ⋮ kecil yang membuka menu lagu. */
@Composable
fun TrackMenuButton(t: MusicTrack, from: String? = null, tint: Color = LocalColors.current.inkSoft, modifier: Modifier = Modifier) {
    Box(modifier.size(40.dp).pressable({ Music.sheet = MusicSheet.Track(t, from) }, 0.85f), contentAlignment = Alignment.Center) {
        Image(Icons.Rounded.MoreVert, "Menu lagu", Modifier.size(22.dp), colorFilter = ColorFilter.tint(tint))
    }
}
