package app.jkt48connect.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.SystemUpdate
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.jkt48connect.core.AppUpdate
import app.jkt48connect.core.UpdateState
import app.jkt48connect.core.Updater
import app.jkt48connect.ui.components.Micro
import app.jkt48connect.ui.components.Txt
import app.jkt48connect.ui.components.VGap
import app.jkt48connect.ui.components.rememberOpenUrl
import app.jkt48connect.ui.glass.LiquidButton
import app.jkt48connect.ui.glass.LocalBackdrop
import app.jkt48connect.ui.glass.glass
import app.jkt48connect.ui.glass.glassFill
import app.jkt48connect.ui.theme.AppText
import app.jkt48connect.ui.theme.LocalColors
import com.kyant.shapes.RoundedRectangle
import java.util.Locale

/**
 * Pop-up kaca "Update tersedia": versi baru, catatan rilis, progres unduhan, lalu pemasang Android.
 * "Nanti" menunda pop-up versi itu 12 jam; unduhan tetap berjalan di latar bila sudah dimulai.
 */
@Composable
fun UpdateDialog() {
    val c = LocalColors.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val open = rememberOpenUrl()
    val visible = Updater.dialog && Updater.available != null
    // Info terakhir disimpan supaya isi tetap ada selama animasi keluar.
    val last = remember { arrayOfNulls<AppUpdate>(1) }
    Updater.available?.let { last[0] = it }

    AnimatedVisibility(visible, enter = fadeIn(tween(200)), exit = fadeOut(tween(200))) {
        Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = if (c.dark) 0.55f else 0.35f)).clickable(interactionSource = null, indication = null) { Updater.later(context) })
    }
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        AnimatedVisibility(
            visible,
            enter = scaleIn(spring(0.7f, 380f), initialScale = 0.85f) + fadeIn(tween(180)),
            exit = scaleOut(tween(180), targetScale = 0.92f) + fadeOut(tween(180)),
        ) {
            val u = last[0] ?: return@AnimatedVisibility
            val state = Updater.state
            Column(
                Modifier
                    .padding(22.dp)
                    .widthIn(max = 440.dp)
                    .fillMaxWidth()
                    .glass(LocalBackdrop.current, RoundedRectangle(34.dp), glassFill(), blur = 10.dp, lensHeight = 24.dp, lensAmount = 48.dp, depth = true)
                    .clickable(interactionSource = null, indication = null) {}
                    .padding(22.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(52.dp).background(c.brandGradient, RoundedRectangle(17.dp)), contentAlignment = Alignment.Center) {
                        Image(Icons.Rounded.SystemUpdate, null, Modifier.size(26.dp), colorFilter = ColorFilter.tint(Color.White))
                    }
                    Spacer(Modifier.width(14.dp))
                    Column {
                        Micro("Update tersedia", color = c.brand, dot = true)
                        VGap(4.dp)
                        Txt("VERSI ${u.version}", AppText.display(30.sp, c.ink))
                    }
                }
                VGap(12.dp)
                Txt(
                    listOfNotNull("Versi kamu ${Updater.current}", u.size.takeIf { it > 0 }?.let { String.format(Locale("in"), "%.1f MB", it / 1_000_000.0) }).joinToString(" · "),
                    AppText.mono(12.sp, c.inkSoft),
                )
                val notes = u.notes.substringBefore("\n---").trim()
                if (notes.isNotEmpty()) {
                    VGap(14.dp)
                    Column(
                        Modifier.fillMaxWidth().heightIn(max = 190.dp).background(c.ink.copy(alpha = 0.05f), RoundedCornerShape(18.dp))
                            .verticalScroll(rememberScrollState()).padding(14.dp),
                    ) {
                        Txt(notes, AppText.body(13.5.sp, c.ink, 500, 1.5f))
                    }
                }
                VGap(14.dp)
                when (state) {
                    is UpdateState.Downloading -> {
                        val p by animateFloatAsState(state.progress ?: 0f, label = "dl")
                        Box(Modifier.fillMaxWidth().height(8.dp).background(c.ink.copy(alpha = 0.08f), RoundedCornerShape(4.dp))) {
                            Box(Modifier.fillMaxWidth(p).fillMaxHeight().background(c.brandGradient, RoundedCornerShape(4.dp)))
                        }
                        VGap(8.dp)
                        Txt(if (state.progress == null) "Menyiapkan unduhan…" else "Mengunduh ${(state.progress * 100).toInt()}%", AppText.mono(12.sp, c.inkSoft))
                    }
                    UpdateState.Ready -> Txt("Lanjutkan di pemasang Android. Kalau belum muncul (atau baru mengizinkan pemasangan), ketuk Pasang.", AppText.body(13.sp, c.inkSoft))
                    UpdateState.KeyMismatch -> Txt(
                        "Versi ini ditandatangani dengan kunci baru, jadi Android tidak bisa menimpanya langsung. Hapus aplikasi lama dulu, lalu unduh & pasang APK dari halaman rilis.",
                        AppText.body(13.sp, c.ink, 600),
                    )
                    is UpdateState.Failed -> Txt(state.message, AppText.body(13.sp, c.brand, 700))
                    UpdateState.Idle -> Txt("APK diunduh langsung dari GitHub Releases, lalu dipasang lewat pemasang Android.", AppText.body(13.sp, c.inkSoft))
                }
                VGap(18.dp)
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    LiquidButton(onClick = { Updater.later(context) }, modifier = Modifier.weight(1f).height(52.dp)) {
                        Txt(if (state is UpdateState.Downloading) "Sembunyikan" else "Nanti", AppText.body(14.sp, c.ink, 800))
                    }
                    LiquidButton(
                        onClick = {
                            when (state) {
                                UpdateState.Idle, is UpdateState.Failed -> Updater.start(context, scope)
                                UpdateState.Ready -> Updater.install(context)
                                UpdateState.KeyMismatch -> open(u.page.ifEmpty { u.apk })
                                is UpdateState.Downloading -> {}
                            }
                        },
                        modifier = Modifier.weight(1.4f).height(52.dp),
                        tint = c.brand,
                    ) {
                        Txt(
                            when (state) {
                                UpdateState.Idle -> "Update sekarang"
                                is UpdateState.Failed -> "Coba lagi"
                                is UpdateState.Downloading -> "Mengunduh…"
                                UpdateState.Ready -> "Pasang"
                                UpdateState.KeyMismatch -> "Halaman rilis"
                            },
                            AppText.body(14.sp, Color.White, 800),
                        )
                    }
                }
            }
        }
    }
}
