package app.jkt48connect.core

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.LruCache
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/**
 * Pemuat gambar ringan tanpa library: cache memori (LRU), cache disk, dan decode yang diperkecil
 * sesuai ukuran tampil (inSampleSize) supaya hemat RAM.
 */
object Images {
    private lateinit var dir: File
    private val net = Semaphore(6)
    private val memory = object : LruCache<String, Bitmap>((Runtime.getRuntime().maxMemory() / 8).toInt()) {
        override fun sizeOf(key: String, value: Bitmap) = value.byteCount
    }

    fun init(context: Context) {
        dir = File(context.cacheDir, "img").apply { mkdirs() }
    }

    fun cached(url: String, widthPx: Int): Bitmap? = memory.get(key(url, widthPx))

    private fun key(url: String, widthPx: Int) = "$url@${bucket(widthPx)}"

    // Lebar dibulatkan ke kelipatan 128 px supaya satu gambar tidak di-decode berkali-kali.
    private fun bucket(widthPx: Int) = ((widthPx.coerceAtLeast(64) + 127) / 128) * 128

    suspend fun load(url: String, widthPx: Int): Bitmap? {
        if (url.isEmpty()) return null
        val k = key(url, widthPx)
        memory.get(k)?.let { return it }
        return withContext(Dispatchers.IO) {
            val file = File(dir, sha1(url))
            if (!file.exists()) {
                net.withPermit {
                    if (!file.exists()) download(url, file)
                }
            }
            decode(file, bucket(widthPx))?.also { memory.put(k, it) }
        }
    }

    private fun download(url: String, file: File) {
        val conn = runCatching { URL(url).openConnection() as HttpURLConnection }.getOrNull() ?: return
        try {
            conn.connectTimeout = 15_000
            conn.readTimeout = 20_000
            if (conn.responseCode !in 200..299) return
            val tmp = File(file.path + ".part")
            conn.inputStream.use { input -> tmp.outputStream().use { input.copyTo(it) } }
            tmp.renameTo(file)
        } catch (_: Exception) {
        } finally {
            conn.disconnect()
        }
        trim()
    }

    private fun decode(file: File, reqWidth: Int): Bitmap? = runCatching {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(file.path, bounds)
        if (bounds.outWidth <= 0) return null
        var sample = 1
        while (bounds.outWidth / (sample * 2) >= reqWidth) sample *= 2
        BitmapFactory.decodeFile(file.path, BitmapFactory.Options().apply { inSampleSize = sample })
    }.getOrNull()

    // Cache disk dibatasi ~80 MB; file paling lama dihapus duluan.
    private fun trim() {
        val files = dir.listFiles() ?: return
        var total = files.sumOf { it.length() }
        if (total < 80L * 1024 * 1024) return
        for (f in files.sortedBy { it.lastModified() }) {
            total -= f.length()
            f.delete()
            if (total < 60L * 1024 * 1024) break
        }
    }

    private fun sha1(s: String) = MessageDigest.getInstance("SHA-1").digest(s.toByteArray()).joinToString("") { "%02x".format(it) }
}
