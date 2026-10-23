package app.jkt48connect.ui.screens

import android.Manifest
import android.content.Intent
import android.os.Build
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.NotificationsActive
import androidx.compose.material.icons.rounded.OpenInNew
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import app.jkt48connect.BuildConfig
import app.jkt48connect.core.Api
import app.jkt48connect.core.Notify
import app.jkt48connect.core.NotifyKind
import app.jkt48connect.core.Updater
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import kotlinx.coroutines.launch
import app.jkt48connect.ui.LocalInsets
import app.jkt48connect.ui.components.Micro
import app.jkt48connect.ui.components.PixelLogo
import app.jkt48connect.ui.components.SignalBars
import app.jkt48connect.ui.components.Txt
import app.jkt48connect.ui.components.VGap
import app.jkt48connect.ui.components.appCard
import app.jkt48connect.ui.components.pressable
import app.jkt48connect.ui.components.rememberOpenUrl
import app.jkt48connect.ui.components.staggerIn
import app.jkt48connect.ui.glass.LiquidButton
import app.jkt48connect.ui.glass.LiquidTabs
import app.jkt48connect.ui.glass.LiquidToggle
import app.jkt48connect.ui.glass.TabItem
import app.jkt48connect.ui.theme.AppText
import app.jkt48connect.ui.theme.LocalColors
import app.jkt48connect.ui.theme.ThemeController
import app.jkt48connect.ui.theme.ThemeMode

/** Halaman Tentang: versi, pengaturan notifikasi & tema, tautan, kredit, dan penafian. */
@Composable
fun AboutScreen() {
    val c = LocalColors.current
    val context = LocalContext.current
    val open = rememberOpenUrl()

    // Status izin dibaca ulang setiap kembali ke aplikasi (mis. setelah mengubahnya di Pengaturan).
    var tick by remember { mutableIntStateOf(0) }
    val lifecycle = (context as? ComponentActivity)?.lifecycle
    DisposableEffect(lifecycle) {
        val observer = LifecycleEventObserver { _, e -> if (e == Lifecycle.Event.ON_RESUME) tick++ }
        lifecycle?.addObserver(observer)
        onDispose { lifecycle?.removeObserver(observer) }
    }
    val permitted = remember(tick) { Notify.permitted(context) }
    val ask = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { tick++ }
    val scope = rememberCoroutineScope()
    var checking by remember { mutableStateOf(false) }
    var checked by remember { mutableStateOf(false) }
    var checkError by remember { mutableStateOf(false) }
    val toggles = remember { mutableStateMapOf<NotifyKind, Boolean>().apply { NotifyKind.entries.forEach { put(it, Notify.enabled(context, it)) } } }

    LazyColumn(contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = LocalInsets.current.calculateTopPadding(), bottom = 48.dp)) {
        item {
            Column(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(30.dp)).background(c.brandGradient).padding(22.dp).staggerIn(0),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(54.dp).background(Color.White.copy(alpha = 0.16f), RoundedCornerShape(16.dp)), contentAlignment = Alignment.Center) {
                        PixelLogo(30.dp, color = Color.White)
                    }
                    Spacer(Modifier.weight(1f))
                    SignalBars(color = Color.White, height = 16.dp)
                }
                VGap(22.dp)
                Row {
                    Txt("JKT48", AppText.display(38.sp, Color.White))
                    Txt("CONNECT", AppText.display(38.sp, Color(0xFF1A0508)))
                }
                VGap(6.dp)
                Txt("Live, jadwal theater, rekap, dan replay member JKT48 dalam satu aplikasi.", AppText.body(14.sp, Color.White.copy(alpha = 0.85f)))
                VGap(16.dp)
                Txt("VERSI ${BuildConfig.VERSION_NAME} · BUILD ${BuildConfig.VERSION_CODE}", AppText.micro(Color.White.copy(alpha = 0.75f), 10.sp))
            }
        }

        item {
            VGap(12.dp)
            Row(Modifier.fillMaxWidth().appCard(22.dp).padding(16.dp).staggerIn(1), verticalAlignment = Alignment.CenterVertically) {
                val newer = Updater.available
                Column(Modifier.weight(1f)) {
                    Txt(if (newer != null) "Versi ${newer.version} tersedia" else "Versi ${Updater.current}", AppText.body(15.sp, c.ink, 800))
                    Txt(
                        when {
                            checking -> "Memeriksa update…"
                            newer != null -> "Versi kamu ${Updater.current}. Ketuk Update."
                            checkError -> "Tidak bisa memeriksa update. Coba lagi nanti."
                            checked -> "Sudah versi terbaru."
                            else -> "Update dicek otomatis dari GitHub Releases."
                        },
                        AppText.body(12.5.sp, c.inkSoft),
                    )
                }
                Spacer(Modifier.width(10.dp))
                LiquidButton(
                    onClick = {
                        if (newer != null) {
                            Updater.dialog = true
                        } else if (!checking) {
                            scope.launch {
                                checking = true
                                checkError = runCatching { Updater.check(context, force = true) }.isFailure
                                checked = true
                                checking = false
                            }
                        }
                    },
                    modifier = Modifier.height(40.dp),
                    tint = if (newer != null) c.brand else Color.Unspecified,
                    contentPadding = PaddingValues(horizontal = 14.dp),
                ) { Txt(if (newer != null) "Update" else "Periksa", AppText.body(13.sp, if (newer != null) Color.White else c.ink, 800)) }
            }
        }

        item { Section("Notifikasi", 2) }
        if (!permitted) item {
            Row(Modifier.fillMaxWidth().appCard(22.dp).padding(16.dp).staggerIn(2), verticalAlignment = Alignment.CenterVertically) {
                Image(Icons.Rounded.NotificationsActive, null, Modifier.size(24.dp), colorFilter = ColorFilter.tint(c.brand))
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Txt("Notifikasi belum diizinkan", AppText.body(14.sp, c.ink, 800))
                    Txt("Izinkan agar aplikasi bisa memberi tahu saat member live.", AppText.body(12.sp, c.inkSoft))
                }
                Spacer(Modifier.width(10.dp))
                LiquidButton(
                    onClick = {
                        if (Build.VERSION.SDK_INT >= 33 && !Notify.askedOnce(context)) {
                            Notify.markAsked(context)
                            ask.launch(Manifest.permission.POST_NOTIFICATIONS)
                        } else {
                            // Sudah pernah ditolak → hanya bisa diubah dari pengaturan Android.
                            context.startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName))
                        }
                    },
                    modifier = Modifier.height(40.dp),
                    tint = c.brand,
                    contentPadding = PaddingValues(horizontal = 14.dp),
                ) { Txt("Izinkan", AppText.body(13.sp, Color.White, 800)) }
            }
            VGap(10.dp)
        }
        item {
            Column(Modifier.fillMaxWidth().appCard(24.dp).staggerIn(3)) {
                NotifyKind.entries.forEachIndexed { i, kind ->
                    if (i > 0) Box(Modifier.padding(horizontal = 16.dp).fillMaxWidth().height(1.dp).background(c.line))
                    Row(Modifier.padding(16.dp, 14.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Txt(kind.label, AppText.body(15.sp, c.ink, 800))
                            Txt(kind.hint, AppText.body(12.5.sp, c.inkSoft))
                        }
                        Spacer(Modifier.width(12.dp))
                        LiquidToggle(
                            checked = toggles[kind] == true,
                            onCheckedChange = {
                                toggles[kind] = it
                                Notify.setEnabled(context, kind, it)
                            },
                        )
                    }
                }
            }
            VGap(8.dp)
            Txt(
                "Diperiksa otomatis tiap ±15 menit saat ada internet. Penghemat baterai bisa membuat pemberitahuan sedikit terlambat.",
                AppText.body(12.sp, c.inkSoft),
                Modifier.padding(horizontal = 6.dp),
            )
        }

        item { Section("Tema · tarik pilnya", 4) }
        item {
            LiquidTabs(
                items = listOf(TabItem("Sistem"), TabItem("Putih"), TabItem("Gelap")),
                selectedIndex = ThemeController.mode.ordinal,
                onSelected = { ThemeController.set(ThemeMode.entries[it]) },
                height = 54.dp,
                modifier = Modifier.fillMaxWidth().staggerIn(5),
            )
        }

        item { Section("Tautan", 6) }
        item {
            Column(Modifier.fillMaxWidth().appCard(24.dp).staggerIn(7)) {
                listOf(
                    "Situs JKT48Connect" to Api.base,
                    "Situs resmi JKT48" to "https://jkt48.com",
                    "Showroom" to "https://www.showroom-live.com",
                    "IDN Live" to "https://www.idn.app",
                ).forEachIndexed { i, (label, url) ->
                    if (i > 0) Box(Modifier.padding(horizontal = 16.dp).fillMaxWidth().height(1.dp).background(c.line))
                    Row(Modifier.fillMaxWidth().pressable({ open(url) }).padding(16.dp, 15.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Txt(label, AppText.body(15.sp, c.ink, 700))
                            Txt(url.removePrefix("https://").removePrefix("www."), AppText.mono(11.5.sp, c.inkSoft))
                        }
                        Image(Icons.Rounded.OpenInNew, null, Modifier.size(16.dp), colorFilter = ColorFilter.tint(c.brand))
                    }
                }
            }
        }

        item { Section("Kredit", 8) }
        item {
            Column(Modifier.fillMaxWidth().appCard(24.dp).padding(16.dp).staggerIn(9), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                listOf(
                    "Data" to "jkt48.com, Showroom, dan IDN Live melalui API JKT48Connect",
                    "Liquid glass" to "Backdrop oleh Kyant · Apache License 2.0",
                    "Pemutar video" to "AndroidX Media3 ExoPlayer · Apache License 2.0",
                    "Huruf" to "Archivo & IBM Plex Mono · SIL Open Font License",
                ).forEach { (k, v) ->
                    Column {
                        Txt(k.uppercase(), AppText.micro(c.brand, 9.5.sp))
                        VGap(3.dp)
                        Txt(v, AppText.body(13.5.sp, c.ink, 600))
                    }
                }
            }
        }

        item {
            VGap(18.dp)
            Txt(
                "JKT48Connect adalah proyek penggemar dan tidak berafiliasi dengan JKT48, IDN, maupun Showroom. Semua nama, foto, dan merek milik pemiliknya masing-masing.",
                AppText.body(12.sp, c.inkSoft, 500, 1.5f),
                Modifier.padding(horizontal = 6.dp),
            )
            VGap(18.dp)
            Micro("Dibuat untuk fans JKT48 · © 2026", Modifier.padding(horizontal = 6.dp))
        }
    }
}

@Composable
private fun Section(label: String, index: Int) {
    Micro(label, Modifier.padding(6.dp, 26.dp, 6.dp, 10.dp).staggerIn(index), color = LocalColors.current.brand, dot = true)
}
