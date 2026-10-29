package app.jkt48connect.stream
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.dp
object StreamIcons {
    private fun vector(name: String, path: String) = ImageVector.Builder(name, 24.dp, 24.dp, 24f, 24f).addPath(PathParser().parsePathString(path).toNodes(), fill = SolidColor(Color.Black)).build()
    val PlayArrow = vector("Play", "M8,5L19,12L8,19Z")
    val Home = vector("Beranda", "M12,3L2,12L5,12L5,21L10,21L10,15L14,15L14,21L19,21L19,12L22,12Z")
    val Back = vector("Kembali", "M15,4L7,12L15,20L16.4,18.6L9.8,12L16.4,5.4Z")
    val TheaterComedy = vector("Panggung", "M3,4L21,4L21,20L3,20ZM5,6L5,17L8,14L8,6ZM10,6L10,18L14,18L14,6ZM16,6L16,14L19,17L19,6Z")
    val Sensors = vector("Live", "M12,9A3,3 0,1 0,12 15A3,3 0,1 0,12 9ZM5,5L6.4,6.4A8,8 0,0 0,6.4 17.6L5,19A10,10 0,0 1,5 5ZM19,5A10,10 0,0 1,19 19L17.6,17.6A8,8 0,0 0,17.6 6.4Z")
    val History = vector("Replay", "M12,3A9,9 0,1 1,3 12L1,12L4,8L7,12L5,12A7,7 0,1 0,12 5ZM11,7L13,7L13,12L16,14L15,16L11,13Z")
    val Person = vector("Akun", "M12,3A4,4 0,1 0,12 11A4,4 0,1 0,12 3ZM4,21L4,18A8,6 0,0 1,20 18L20,21Z")
}
