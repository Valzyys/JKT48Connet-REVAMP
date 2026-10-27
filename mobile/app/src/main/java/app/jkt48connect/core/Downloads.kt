package app.jkt48connect.core

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Environment

/**
 * Unduh media posting member (foto/video X, TikTok, Instagram) ke folder publik `Download/JKT48Connect`
 * lewat DownloadManager: ada notifikasi progres & selesai, tetap jalan walau aplikasi ditutup.
 * Android 10+ tidak butuh izin penyimpanan; Android 8–9 butuh WRITE_EXTERNAL_STORAGE (diminta oleh UI).
 */
object Downloads {
    const val FOLDER = "JKT48Connect"

    data class Item(val url: String, val video: Boolean, val name: String)

    /** Nama file aman: huruf/angka/._- saja, dengan ekstensi sesuai jenis media. */
    fun fileName(base: String, url: String, video: Boolean): String {
        val clean = base.replace(Regex("[^A-Za-z0-9._-]+"), "_").trim('_').take(80).ifEmpty { "media" }
        val ext = if (video) "mp4" else Uri.parse(url).lastPathSegment?.substringAfterLast('.', "")?.lowercase()
            ?.takeIf { it in setOf("jpg", "jpeg", "png", "webp", "gif") } ?: "jpg"
        return "$clean.$ext"
    }

    /** Mengantrekan semua item; mengembalikan jumlah yang berhasil diantrekan. */
    fun enqueue(context: Context, items: List<Item>): Int {
        val dm = context.getSystemService(DownloadManager::class.java) ?: return 0
        return items.count { item ->
            runCatching {
                val uri = Uri.parse(item.url)
                if (uri.scheme != "https" && uri.scheme != "http") return@runCatching false
                dm.enqueue(
                    DownloadManager.Request(uri)
                        .setTitle(item.name)
                        .setDescription("JKT48Connect")
                        .setMimeType(if (item.video) "video/mp4" else "image/*")
                        .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                        .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "$FOLDER/${item.name}"),
                )
                true
            }.getOrDefault(false)
        }
    }
}
