package app.jkt48connect.core

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import app.jkt48connect.BuildConfig
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

/** Tahap pembaruan di pop-up. */
sealed interface UpdateState {
    data object Idle : UpdateState
    data class Downloading(val progress: Float?) : UpdateState
    data object Ready : UpdateState
    /** APK baru ditandatangani kunci lain: Android menolak menimpa, aplikasi lama harus dihapus dulu. */
    data object KeyMismatch : UpdateState
    data class Failed(val message: String) : UpdateState
}

/**
 * Pemberitahuan & pemasangan update dari GitHub Releases: cek versi lewat `/api/app/update`,
 * unduh APK dengan DownloadManager (ada progres & notifikasi unduhan), lalu buka pemasang Android.
 */
object Updater {
    private const val APK_MIME = "application/vnd.android.package-archive"
    private const val SNOOZE_MS = 12 * 60 * 60_000L

    val current: String = BuildConfig.VERSION_NAME

    /** Rilis yang lebih baru dari versi terpasang (null = sudah terbaru / belum dicek). */
    var available by mutableStateOf<AppUpdate?>(null)
        private set
    var dialog by mutableStateOf(false)
    var state by mutableStateOf<UpdateState>(UpdateState.Idle)
        private set
    private var downloadId = -1L
    private var job: Job? = null

    /** "2.10.0" > "2.9.3"; bagian yang hilang dianggap 0. */
    fun isNewer(candidate: String, than: String): Boolean {
        val a = candidate.split('.').map { it.toIntOrNull() ?: 0 }
        val b = than.split('.').map { it.toIntOrNull() ?: 0 }
        for (i in 0 until maxOf(a.size, b.size)) {
            val d = a.getOrElse(i) { 0 } - b.getOrElse(i) { 0 }
            if (d != 0) return d > 0
        }
        return false
    }

    /** Cek rilis terbaru. `prompt` = tampilkan pop-up bila ada versi baru dan tidak sedang ditunda ("Nanti"). */
    suspend fun check(context: Context, force: Boolean = false, prompt: Boolean = true): AppUpdate? {
        val info = Api.update(if (force) Fetch.Force else Fetch.Normal)
        val newer = info.takeIf { it.version.isNotEmpty() && it.apk.isNotEmpty() && isNewer(it.version, current) }
        available = newer
        if (newer != null && prompt && (force || !snoozed(context, newer.version))) dialog = true
        return newer
    }

    private fun prefs(context: Context) = context.getSharedPreferences("update", Context.MODE_PRIVATE)

    private fun snoozed(context: Context, version: String) =
        System.currentTimeMillis() - prefs(context).getLong("later_$version", 0) < SNOOZE_MS

    /** "Nanti": pop-up versi ini tidak muncul lagi selama 12 jam (notifikasi & halaman Tentang tetap memberi tahu). */
    fun later(context: Context) {
        available?.let { prefs(context).edit().putLong("later_${it.version}", System.currentTimeMillis()).apply() }
        if (state !is UpdateState.Downloading) dialog = false
    }

    private fun apkFile(context: Context, version: String) =
        File(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "jkt48connect-$version.apk")

    fun start(context: Context, scope: CoroutineScope) {
        val info = available ?: return
        if (state is UpdateState.Downloading) return
        val file = apkFile(context, info.version)
        // Sudah diunduh sebelumnya dan utuh → langsung pasang.
        if (file.exists() && (info.size <= 0 || file.length() == info.size)) {
            downloadId = prefs(context).getLong("dl_${info.version}", -1)
            verifyAndInstall(context, file)
            return
        }
        file.parentFile?.listFiles()?.filter { it.name.endsWith(".apk") }?.forEach { it.delete() }
        val dm = context.getSystemService(DownloadManager::class.java)
        downloadId = dm.enqueue(
            DownloadManager.Request(Uri.parse(info.apk))
                .setTitle("JKT48Connect ${info.version}")
                .setDescription("Mengunduh update aplikasi")
                .setMimeType(APK_MIME)
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
                .setDestinationInExternalFilesDir(context, Environment.DIRECTORY_DOWNLOADS, file.name),
        )
        prefs(context).edit().putLong("dl_${info.version}", downloadId).apply()
        state = UpdateState.Downloading(null)
        job?.cancel()
        job = scope.launch {
            while (true) {
                val row = withContext(Dispatchers.IO) { query(dm, downloadId) }
                when (row?.first) {
                    DownloadManager.STATUS_SUCCESSFUL -> {
                        verifyAndInstall(context, file)
                        return@launch
                    }
                    DownloadManager.STATUS_FAILED, null -> {
                        state = UpdateState.Failed("Unduhan gagal. Periksa koneksi lalu coba lagi.")
                        return@launch
                    }
                    else -> state = UpdateState.Downloading(row.second)
                }
                delay(300)
            }
        }
    }

    private fun query(dm: DownloadManager, id: Long): Pair<Int, Float?>? =
        dm.query(DownloadManager.Query().setFilterById(id))?.use { c ->
            if (!c.moveToFirst()) return null
            val status = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
            val done = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR))
            val total = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
            status to (if (total > 0) (done.toFloat() / total).coerceIn(0f, 1f) else null)
        }

    private fun verifyAndInstall(context: Context, file: File) {
        state = when {
            !sameSigner(context, file) -> UpdateState.KeyMismatch
            else -> {
                install(context, file)
                UpdateState.Ready
            }
        }
    }

    /** Pasang APK yang sudah diunduh; bila izin "pasang aplikasi tak dikenal" belum ada, buka pengaturannya dulu. */
    fun install(context: Context, file: File? = available?.let { apkFile(context, it.version) }) {
        if (file == null || !file.exists()) return
        if (!context.packageManager.canRequestPackageInstalls()) {
            context.startActivity(
                Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}"))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            )
            return
        }
        val dm = context.getSystemService(DownloadManager::class.java)
        // URI content:// dari DownloadManager bisa dibaca pemasang (tanpa FileProvider).
        val uri = (if (downloadId >= 0) dm.getUriForDownloadedFile(downloadId) else null) ?: run {
            state = UpdateState.Failed("File update tidak ditemukan. Unduh ulang.")
            file.delete()
            return
        }
        context.startActivity(
            Intent(Intent.ACTION_VIEW)
                .setDataAndType(uri, APK_MIME)
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK),
        )
    }

    @Suppress("DEPRECATION")
    private fun sameSigner(context: Context, file: File): Boolean = runCatching {
        val pm = context.packageManager
        if (Build.VERSION.SDK_INT >= 28) {
            val flags = PackageManager.GET_SIGNING_CERTIFICATES
            val mine = pm.getPackageInfo(context.packageName, flags).signingInfo?.apkContentsSigners.orEmpty().map { it.toCharsString() }.toSet()
            val apk = pm.getPackageArchiveInfo(file.path, flags)?.signingInfo?.apkContentsSigners.orEmpty().map { it.toCharsString() }.toSet()
            apk.isNotEmpty() && apk == mine
        } else {
            val flags = PackageManager.GET_SIGNATURES
            val mine = pm.getPackageInfo(context.packageName, flags).signatures.orEmpty().map { it.toCharsString() }.toSet()
            val apk = pm.getPackageArchiveInfo(file.path, flags)?.signatures.orEmpty().map { it.toCharsString() }.toSet()
            apk.isNotEmpty() && apk == mine
        }
    }.getOrDefault(true)

    fun reset() {
        if (state !is UpdateState.Downloading) state = UpdateState.Idle
    }
}
