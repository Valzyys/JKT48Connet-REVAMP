package app.jkt48connect.stream.ui.components
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import app.jkt48connect.stream.ui.theme.LocalColors
@Composable fun Ambient(modifier: Modifier = Modifier) {
    val c = LocalColors.current
    Canvas(modifier.fillMaxSize()) {
        drawRect(c.bg)
        val w = size.width; val h = size.height
        fun blob(x: Float, y: Float, r: Float, color: Color, a: Float) = drawCircle(Brush.radialGradient(0f to color.copy(alpha = a), .42f to color.copy(alpha = a * .9f), .75f to color.copy(alpha = a * .35f), 1f to Color.Transparent, center = Offset(x, y), radius = r), r, Offset(x, y))
        blob(w * .15f, h * .134f, w * 1.15f, c.brand, if (c.dark) .22f else .13f)
        blob(w * .92f, h * .36f, w * 1.05f, Color(0xFFFF2D55), if (c.dark) .13f else .10f)
        blob(w * .35f, h * .935f, w, Color(0xFFFF9500), .07f)
    }
}
