package app.jkt48connect.core

import java.text.NumberFormat
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

// Waktu ditampilkan dalam WIB (UTC+7), sama seperti web.

val ID: Locale = Locale.forLanguageTag("id-ID")
private val WIB: ZoneOffset = ZoneOffset.ofHours(7)

fun parseInstant(iso: String): Instant? =
    runCatching { OffsetDateTime.parse(iso).toInstant() }.getOrNull()
        ?: runCatching { Instant.parse(iso) }.getOrNull()

fun parseWib(iso: String): ZonedDateTime? = parseInstant(iso)?.atZone(WIB)

fun nowWib(): ZonedDateTime = ZonedDateTime.now(WIB)

fun fmtDate(iso: String, pattern: String = "EEEE, d MMM yyyy"): String =
    parseWib(iso)?.format(DateTimeFormatter.ofPattern(pattern, ID)) ?: ""

fun fmtWib(t: ZonedDateTime, pattern: String): String = t.format(DateTimeFormatter.ofPattern(pattern, ID))

/** "19.00" (WIB), sama dengan `Fmt.time` di aplikasi iPhone. */
fun fmtTime(iso: String): String = parseWib(iso)?.format(DateTimeFormatter.ofPattern("HH.mm", ID)) ?: ""

fun fmtDuration(ms: Long): String {
    val m = ms / 60_000
    return if (m < 60) "${m}m" else "${m / 60}j ${m % 60}m"
}

fun fmtNum(n: Int?): String = n?.let { NumberFormat.getIntegerInstance(ID).format(it) } ?: "–"

/** Sama dengan `Fmt.compact` iOS: 5.836 · 14,7 rb · 1,2 jt. */
fun fmtCompact(n: Int?): String = when {
    n == null -> "–"
    n >= 1_000_000 -> "%.1f jt".format(ID, n / 1_000_000.0).replace(",0 ", " ")
    n >= 10_000 -> "%.1f rb".format(ID, n / 1_000.0).replace(",0 ", " ")
    else -> fmtNum(n)
}

fun fmtCompact(n: Long?): String = fmtCompact(n?.coerceAtMost(Int.MAX_VALUE.toLong())?.toInt())

fun timeAgo(iso: String): String {
    val t = parseInstant(iso) ?: return ""
    val d = Duration.between(t, Instant.now())
    return when {
        d.toMinutes() < 1 -> "baru saja"
        d.toMinutes() < 60 -> "${d.toMinutes()} menit lalu"
        d.toHours() < 24 -> "${d.toHours()} jam lalu"
        else -> "${d.toDays()} hari lalu"
    }
}

/** "2 hari 05:41:58" atau "05:41:58". */
fun fmtCountdown(ms: Long): String {
    if (ms < 0) return "Sedang berlangsung"
    val s = ms / 1000
    val hms = "%02d:%02d:%02d".format(s / 3600 % 24, s / 60 % 60, s % 60)
    val days = s / 86_400
    return if (days > 0) "$days hari $hms" else hms
}

/** Hari menuju ulang tahun berikutnya (WIB). */
fun daysUntil(birthdate: String): Int {
    val b = parseWib(birthdate)?.toLocalDate() ?: return 999
    val today = nowWib().toLocalDate()
    var next = runCatching { LocalDate.of(today.year, b.month, b.dayOfMonth) }.getOrElse { LocalDate.of(today.year, 3, 1) }
    if (next.isBefore(today)) next = next.plusYears(1)
    return (next.toEpochDay() - today.toEpochDay()).toInt()
}

/** HTML berita jkt48.com → paragraf teks biasa. */
fun htmlToText(html: String): String = html
    .replace(Regex("<(br|/p|/div|/li|/h\\d)[^>]*>", RegexOption.IGNORE_CASE), "\n")
    .replace(Regex("<[^>]+>"), "")
    .replace("&nbsp;", " ").replace("&amp;", "&").replace("&quot;", "\"").replace("&#39;", "'")
    .replace("&lt;", "<").replace("&gt;", ">")
    .replace(Regex("\n{3,}"), "\n\n")
    .trim()

/** Potongan isi berita: paragraf teks atau gambar. */
sealed interface NewsBlock {
    data class Text(val text: String) : NewsBlock
    data class Image(val url: String) : NewsBlock
}

/** HTML berita jkt48.com → urutan paragraf dan gambar (gambar tidak lagi hilang). */
fun htmlBlocks(html: String): List<NewsBlock> {
    val out = mutableListOf<NewsBlock>()
    val img = Regex("<img\\b[^>]*>", RegexOption.IGNORE_CASE)
    val src = Regex("\\b(?:data-src|src)\\s*=\\s*[\"']([^\"']+)[\"']", RegexOption.IGNORE_CASE)
    var last = 0
    for (m in img.findAll(html)) {
        htmlToText(html.substring(last, m.range.first)).takeIf { it.isNotBlank() }?.let { out += NewsBlock.Text(it) }
        src.find(m.value)?.groupValues?.get(1)?.trim()?.takeIf { it.isNotEmpty() && !it.startsWith("data:") }?.let { out += NewsBlock.Image(it.replace("&amp;", "&")) }
        last = m.range.last + 1
    }
    htmlToText(html.substring(last)).takeIf { it.isNotBlank() }?.let { out += NewsBlock.Text(it) }
    return out
}
