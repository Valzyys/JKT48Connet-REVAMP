package app.jkt48connect.core

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.LruCache
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap

/**
 * Pemuat gambar ringan tanpa library: cache memori (LRU), cache disk, dan decode yang diperkecil
 * sesuai ukuran tampil (inSampleSize) supaya hemat RAM.
 */
object Images {
    private lateinit var dir: File
    private val net = Semaphore(6)

    // Satu unduhan per URL: gambar yang sama (mis. avatar member di banyak kartu show) tidak diunduh
    // bersamaan ke file yang sama — dulu ini bisa merusak file cache sehingga gambar tak pernah muncul.
    private val inflight = ConcurrentHashMap<String, CompletableDeferred<Boolean>>()
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

    suspend fun load(rawUrl: String, widthPx: Int): Bitmap? {
        if (rawUrl.isEmpty()) return null
        val url = Api.imageUrl(rawUrl)
        val k = key(url, widthPx)
        memory.get(k)?.let { return it }
        return withContext(Dispatchers.IO) {
            val file = File(dir, sha1(url))
            if (!file.exists() && !fetch(url, file)) return@withContext null
            val bitmap = decode(file, bucket(widthPx))
            if (bitmap == null) {
                // File rusak/terpotong: hapus supaya dicoba lagi lain kali.
                file.delete()
                return@withContext null
            }
            memory.put(k, bitmap)
            bitmap
        }
    }

    private suspend fun fetch(url: String, file: File): Boolean {
        val mine = CompletableDeferred<Boolean>()
        val running = inflight.putIfAbsent(url, mine)
        if (running != null) return running.await()
        return try {
            val ok = net.withPermit { file.exists() || download(url, file) }
            mine.complete(ok)
            ok
        } catch (e: Throwable) {
            mine.complete(false)
            throw e
        } finally {
            inflight.remove(url)
        }
    }

    private suspend fun download(url: String, file: File): Boolean {
        val headers = if (url.startsWith(Api.base)) runCatching { Api.authHeaders() }.getOrDefault(emptyMap()) else emptyMap()
        val conn = runCatching { URL(url).openConnection() as HttpURLConnection }.getOrNull() ?: return false
        val tmp = File(file.path + ".${System.nanoTime()}.part")
        return try {
            conn.connectTimeout = 15_000
            conn.readTimeout = 25_000
            headers.forEach { (k, v) -> conn.setRequestProperty(k, v) }
            if (conn.responseCode !in 200..299) return false
            conn.inputStream.use { input -> tmp.outputStream().use { input.copyTo(it) } }
            tmp.renameTo(file)
        } catch (_: Exception) {
            false
        } finally {
            tmp.delete()
            conn.disconnect()
            trim()
        }
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
