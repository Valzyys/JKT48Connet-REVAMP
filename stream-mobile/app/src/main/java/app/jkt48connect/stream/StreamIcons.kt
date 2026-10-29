package app.jkt48connect.stream

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.dp

/**
 * Ikon Stream (24×24), digambar sendiri supaya APK tidak membawa pustaka ikon.
 * Navigasi & bilah atas memakai set garis (outline 2px, ujung membulat) yang khas Stream;
 * kontrol pemutar dan isi kecil memakai glifo isi.
 */
object StreamIcons {
    /** Glifo isi. `hole` = even-odd untuk ikon berlubang. */
    private fun icon(name: String, path: String, hole: Boolean = false) = ImageVector.Builder(name, 24.dp, 24.dp, 24f, 24f)
        .addPath(
            PathParser().parsePathString(path).toNodes(),
            pathFillType = if (hole) PathFillType.EvenOdd else PathFillType.NonZero,
            fill = SolidColor(Color.Black),
        )
        .build()

    /** Glifo garis 2px dengan ujung & sambungan membulat. */
    private fun line(name: String, vararg paths: String) = ImageVector.Builder(name, 24.dp, 24.dp, 24f, 24f).apply {
        paths.forEach {
            addPath(
                PathParser().parsePathString(it).toNodes(),
                fill = null,
                stroke = SolidColor(Color.Black),
                strokeLineWidth = 2f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round,
            )
        }
    }.build()

    // Dock navigasi (garis)
    /** Beranda = lengkung panggung. */
    val Home = line("Beranda", "M3,20H21", "M5,20V10A7,7 0 0,1 19,10V20", "M9,20V14A3,3 0 0,1 15,14V20")
    /** Live = gelombang siaran. */
    val Live = line("Live", "M12,11.5A1.5,1.5 0 1,1 12,14.5A1.5,1.5 0 1,1 12,11.5Z", "M9,10A4.2,4.2 0 0,0 9,16", "M15,10A4.2,4.2 0 0,1 15,16", "M6,7A8.5,8.5 0 0,0 6,19", "M18,7A8.5,8.5 0 0,1 18,19")
    /** Theater = tiket berlubang. */
    val Theater = line(
        "Theater",
        "M3,8A1,1 0 0,1 4,7H20A1,1 0 0,1 21,8V10.5A1.5,1.5 0 0,0 21,13.5V16A1,1 0 0,1 20,17H4A1,1 0 0,1 3,16V13.5A1.5,1.5 0 0,0 3,10.5Z",
        "M15,7.5V9M15,11.25V12.75M15,15V16.5",
    )
    /** Replay = putar ulang dengan segitiga play. */
    val Replay = line("Replay", "M4.5,12A7.5,7.5 0 1,0 7,6.4", "M4,4.5V8.5H8", "M10.5,9.5L14.5,12L10.5,14.5Z")
    /** Akun = orang dalam lingkaran. */
    val Person = line("Akun", "M12,3A9,9 0 1,1 12,21A9,9 0 1,1 12,3Z", "M12,7.5A2.75,2.75 0 1,1 12,13A2.75,2.75 0 1,1 12,7.5Z", "M7,18.2A6,6 0 0,1 17,18.2")

    // Bilah atas
    val Back = line("Kembali", "M15,5L8,12L15,19")
    val Chevron = line("Lanjut", "M9,6L15,12L9,18")
    val ArrowOut = line("Buka", "M7,17L17,7", "M9,7H17V15")
    /** Menu = kisi 2×2 piksel (motif logo). */
    val Grid = icon("Menu", "M4,5.5A1.5,1.5 0 0,1 5.5,4H8.5A1.5,1.5 0 0,1 10,5.5V8.5A1.5,1.5 0 0,1 8.5,10H5.5A1.5,1.5 0 0,1 4,8.5ZM14,5.5A1.5,1.5 0 0,1 15.5,4H18.5A1.5,1.5 0 0,1 20,5.5V8.5A1.5,1.5 0 0,1 18.5,10H15.5A1.5,1.5 0 0,1 14,8.5ZM4,15.5A1.5,1.5 0 0,1 5.5,14H8.5A1.5,1.5 0 0,1 10,15.5V18.5A1.5,1.5 0 0,1 8.5,20H5.5A1.5,1.5 0 0,1 4,18.5ZM14,15.5A1.5,1.5 0 0,1 15.5,14H18.5A1.5,1.5 0 0,1 20,15.5V18.5A1.5,1.5 0 0,1 18.5,20H15.5A1.5,1.5 0 0,1 14,18.5Z")
    val Close = line("Tutup", "M6,6L18,18", "M18,6L6,18")
    val External = line("Buka di luar", "M14,4H20V10", "M20,4L11,13", "M18,14V19A1,1 0 0,1 17,20H5A1,1 0 0,1 4,19V7A1,1 0 0,1 5,6H10")

    // Pemutar (isi)
    val Play = icon("Putar", "M8,5L19,12L8,19Z")
    val Pause = icon("Jeda", "M6,5L10,5L10,19L6,19ZM14,5L18,5L18,19L14,19Z")
    val Rewind = icon("Mundur 10 detik", "M12,5L12,1L7,6L12,11L12,7A6,6 0 1,1 6,13L4,13A8,8 0 1,0 12,5Z")
    val Forward = icon("Maju 10 detik", "M12,5L12,1L17,6L12,11L12,7A6,6 0 1,0 18,13L20,13A8,8 0 1,1 12,5Z")
    val Fullscreen = line("Layar penuh", "M4,9V4H9", "M15,4H20V9", "M20,15V20H15", "M9,20H4V15")
    val FullscreenExit = line("Keluar layar penuh", "M9,4V9H4", "M20,9H15V4", "M15,20V15H20", "M4,15H9V20")

    // Isi
    val Ticket = icon("Tiket", "M2,6L22,6L22,10A2,2 0 0,0 22,14L22,18L2,18L2,14A2,2 0 0,0 2,10ZM14,8L14,10L16,10L16,8ZM14,11L14,13L16,13L16,11ZM14,14L14,16L16,16L16,14Z", hole = true)
    val Pass = icon("Pass", "M12,2L14.4,9.6L22,12L14.4,14.4L12,22L9.6,14.4L2,12L9.6,9.6Z")
    val Check = line("Berhasil", "M5,12.5L10,17.5L19.5,7")
    val Eye = icon("Penonton", "M12,5C7,5 3,8.5 1.5,12C3,15.5 7,19 12,19C17,19 21,15.5 22.5,12C21,8.5 17,5 12,5ZM12,8.5A3.5,3.5 0 1,1 12,15.5A3.5,3.5 0 1,1 12,8.5Z", hole = true)
    val Timer = line("Waktu", "M9,2H15", "M12,5A8,8 0 1,1 12,21A8,8 0 1,1 12,5Z", "M12,9V13.5L14.5,15")
    val Receipt = icon("Pembayaran", "M5,2L19,2L19,22L16.5,20.5L14,22L12,20.5L10,22L7.5,20.5L5,22ZM8,6L16,6L16,8L8,8ZM8,10L16,10L16,12L8,12ZM8,14L13,14L13,16L8,16Z", hole = true)
    val Download = line("Simpan", "M12,4V15", "M7,10.5L12,15.5L17,10.5", "M5,20H19")
    val Chat = line("Obrolan", "M4,5H20V16H9L5,20V16H4Z")
    val Send = icon("Kirim", "M3,20L22,12L3,4L3,10L16,12L3,14Z")
    val Logout = line("Keluar", "M10,4H5V20H10", "M15,8L19,12L15,16", "M19,12H9")
    val Moon = icon("Tampilan", "M14,2A10,10 0 1,0 22,14A8,8 0 1,1 14,2Z")
    val Gift = line("Gift", "M4,10H20V20H4Z", "M3,7H21V10H3Z", "M12,7V20", "M12,7C10,3 6,4 7.5,6.5C8.3,7.5 12,7 12,7", "M12,7C14,3 18,4 16.5,6.5C15.7,7.5 12,7 12,7")
    val Expand = line("Perbesar", "M14,4H20V10", "M20,4L13,11", "M10,20H4V14", "M4,20L11,13")
}
