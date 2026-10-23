import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:liquid_glass_easy/liquid_glass_easy.dart';

import '../core/theme.dart';

/// Bentuk kaca: kapsul/kotak membulat kontinu dengan tepi optik yang memantulkan cahaya.
LiquidGlassShape glassShape(double radius, {bool dark = false}) => LiquidGlassShape.continuousRoundedRectangle(
      cornerRadius: radius,
      clipQuality: LiquidGlassClipQuality.exact,
      borderWidth: dark ? 1.0 : 0.9,
      lightIntensity: dark ? 0.9 : 1.0,
      lightDirection: 62,
      borderType: OpticalBorder(borderSaturation: 1.2, ambientIntensity: dark ? 0.6 : 0.9, borderSolidity: dark ? 0.85 : 1.0),
    );

/// Kaca "susu" putih untuk tema putih, kaca "asap" netral untuk tema gelap.
LiquidGlassStyle glass(BuildContext context, double radius, {bool? dark, double distortion = 0.08, Color? tint}) {
  final d = dark ?? AppColors.of(context).dark;
  return LiquidGlassStyle(
    shape: glassShape(radius, dark: d),
    appearance: LiquidGlassAppearance(
      color: tint ?? (d ? const Color(0x5C24242A) : const Color(0x94FFFFFF)),
      blur: LiquidGlassBlur(sigmaX: d ? 10 : 8, sigmaY: d ? 10 : 8),
      saturation: d ? 1.25 : 1.45,
      shadow: LiquidGlassShadow(blur: d ? 18 : 14, opacity: d ? 0.55 : 0.10),
    ),
    refraction: LiquidGlassRefraction(distortion: distortion, distortionWidth: 26),
  );
}

/// Kaca merah tipis untuk pil "LIVE" di atas foto.
LiquidGlassStyle glassRed(double radius) => LiquidGlassStyle(
      shape: glassShape(radius, dark: true),
      appearance: const LiquidGlassAppearance(
        color: Color(0xA6E1243A),
        blur: LiquidGlassBlur(sigmaX: 4, sigmaY: 4),
        saturation: 1.3,
      ),
      refraction: const LiquidGlassRefraction(distortion: 0.1, distortionWidth: 18),
    );

/// Efek sentuh kaca: cahaya putih yang menyebar dari titik jari, mengikuti jari,
/// tepi kaca ikut menyala, lalu memudar pelan saat dilepas.
class PressGlow extends StatefulWidget {
  const PressGlow({
    super.key,
    required this.child,
    this.onTap,
    this.onLongPress,
    this.radius = 999,
    this.haptic = true,
    this.foreground = false,
    this.strength = 1,
  });
  final Widget child;
  final VoidCallback? onTap, onLongPress;
  final double radius;
  final bool haptic;

  /// Lukis cahaya di atas isi (untuk lapisan tanpa isi, mis. tab bar) — bawaannya di belakang isi supaya ikon & teks tetap tajam.
  final bool foreground;
  final double strength;

  @override
  State<PressGlow> createState() => _PressGlowState();
}

class _PressGlowState extends State<PressGlow> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 170),
    reverseDuration: const Duration(milliseconds: 650),
  )..addStatusListener((s) {
      // Ketukan singkat tetap menyala penuh dulu, baru memudar.
      if (s == AnimationStatus.completed && !_down) _c.reverse();
    });
  Offset _pos = Offset.zero;
  bool _down = false;

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  void _press(PointerDownEvent e) {
    _down = true;
    setState(() => _pos = e.localPosition);
    _c.forward();
    if (widget.haptic && widget.onTap != null) HapticFeedback.selectionClick();
  }

  void _release([PointerEvent? _]) {
    _down = false;
    if (_c.status != AnimationStatus.forward) _c.reverse();
  }

  @override
  Widget build(BuildContext context) {
    final dark = AppColors.of(context).dark;
    Widget content = Listener(
      behavior: HitTestBehavior.translucent,
      onPointerDown: _press,
      onPointerMove: (e) => setState(() => _pos = e.localPosition),
      onPointerUp: _release,
      onPointerCancel: _release,
      child: AnimatedBuilder(
        animation: _c,
        builder: (_, child) {
          final painter = _GlowPainter(_pos, Curves.easeOutCubic.transform(_c.value), widget.radius, (dark ? 1.0 : 1.6) * widget.strength, wash: !widget.foreground);
          return CustomPaint(painter: widget.foreground ? null : painter, foregroundPainter: widget.foreground ? painter : null, child: child);
        },
        child: widget.child,
      ),
    );
    if (widget.onTap != null || widget.onLongPress != null) {
      content = GestureDetector(behavior: HitTestBehavior.opaque, onTap: widget.onTap, onLongPress: widget.onLongPress, child: content);
    }
    return content;
  }
}

class _GlowPainter extends CustomPainter {
  _GlowPainter(this.pos, this.v, this.radius, this.k, {this.wash = true});
  final Offset pos;
  final double v, radius, k;
  final bool wash;

  Color _white(double a) => Colors.white.withValues(alpha: (a * v * k).clamp(0.0, 1.0));

  @override
  void paint(Canvas canvas, Size size) {
    if (v <= 0.001 || size.isEmpty) return;
    final rr = RRect.fromRectAndRadius(Offset.zero & size, Radius.circular(math.min(radius, size.shortestSide / 2)));
    canvas.save();
    canvas.clipRRect(rr);
    if (wash) canvas.drawRect(Offset.zero & size, Paint()..color = _white(0.10));
    final r = size.longestSide * (0.4 + 0.6 * v);
    canvas.drawCircle(
      pos,
      r,
      Paint()
        ..shader = RadialGradient(colors: [_white(0.62), _white(0.24), _white(0)], stops: const [0, 0.42, 1])
            .createShader(Rect.fromCircle(center: pos, radius: r)),
    );
    canvas.restore();
    canvas.drawRRect(
      rr.deflate(0.6),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.3
        ..color = _white(0.6),
    );
  }

  @override
  bool shouldRepaint(_GlowPainter o) => o.v != v || o.pos != pos || o.radius != radius || o.k != k || o.wash != wash;
}

/// Tombol kaca: lensa yang membiaskan isi di belakangnya, membengkak saat ditekan, dan bercahaya putih di titik sentuh.
class GlassChip extends StatelessWidget {
  const GlassChip({
    super.key,
    required this.child,
    this.radius = 999,
    this.dark,
    this.style,
    this.onTap,
    this.padding = const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
  });
  final Widget child;
  final double radius;
  final bool? dark;
  final LiquidGlassStyle? style;
  final VoidCallback? onTap;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) => LiquidGlassLens(
        style: style ?? glass(context, radius > 100 ? 20 : radius, dark: dark),
        touch: const LiquidGlassTouch(flex: LiquidGlassFlex()),
        child: PressGlow(radius: radius, onTap: onTap, child: Padding(padding: padding, child: child)),
      );
}

/// Tombol ikon bulat di dalam bar kaca (kepala atas): cahaya putih saat disentuh.
class GlassIconButton extends StatelessWidget {
  const GlassIconButton({super.key, required this.icon, required this.onTap, this.tooltip, this.color, this.size = 42});
  final Widget icon;
  final VoidCallback onTap;
  final String? tooltip;
  final Color? color;
  final double size;

  @override
  Widget build(BuildContext context) {
    final btn = PressGlow(
      onTap: onTap,
      child: SizedBox.square(
        dimension: size,
        child: Center(child: IconTheme(data: IconThemeData(color: color ?? AppColors.of(context).ink, size: 21), child: icon)),
      ),
    );
    return Semantics(button: true, label: tooltip, child: tooltip == null ? btn : Tooltip(message: tooltip!, child: btn));
  }
}

/// Pilihan segmen di wadah kaca; pil merah meluncur (dengan pantulan) ke segmen terpilih, wadah bercahaya saat disentuh.
class GlassSegmented extends StatelessWidget {
  const GlassSegmented({super.key, required this.segments, required this.selected, required this.onChanged, this.width = 300, this.height = 46});
  final List<String> segments;
  final int selected;
  final ValueChanged<int> onChanged;
  final double width, height;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final n = segments.length;
    return LiquidGlassLens(
      style: glass(context, height / 2),
      child: PressGlow(
        radius: height / 2,
        child: SizedBox(
          width: width,
          height: height,
          child: Stack(children: [
            AnimatedAlign(
              alignment: Alignment(n == 1 ? 0 : -1 + 2 * selected / (n - 1), 0),
              duration: const Duration(milliseconds: 520),
              curve: Curves.easeOutBack,
              child: Container(
                width: width / n - 8,
                height: height - 8,
                margin: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  gradient: c.brandGradient,
                  borderRadius: BorderRadius.circular(height),
                  boxShadow: [BoxShadow(color: c.brand.withValues(alpha: c.dark ? 0.45 : 0.32), blurRadius: 16, offset: const Offset(0, 6))],
                ),
              ),
            ),
            Row(children: [
              for (var i = 0; i < n; i++)
                Expanded(
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () {
                      if (i != selected) HapticFeedback.selectionClick();
                      onChanged(i);
                    },
                    child: Center(
                      child: AnimatedDefaultTextStyle(
                        duration: const Duration(milliseconds: 250),
                        style: AppText.body(14, color: i == selected ? Colors.white : c.ink, weight: 800),
                        child: Text(segments[i]),
                      ),
                    ),
                  ),
                ),
            ]),
          ]),
        ),
      ),
    );
  }
}

/// Kartu yang bisa ditekan (bukan kaca): mengecil sedikit dan meredup saat disentuh.
class Pressable extends StatefulWidget {
  const Pressable({super.key, required this.child, this.onTap, this.scale = 0.97});
  final Widget child;
  final VoidCallback? onTap;
  final double scale;
  @override
  State<Pressable> createState() => _PressableState();
}

class _PressableState extends State<Pressable> {
  bool _down = false;
  void _set(bool v) {
    if (widget.onTap != null && v != _down) setState(() => _down = v);
  }

  @override
  Widget build(BuildContext context) => Listener(
        onPointerDown: (_) => _set(true),
        onPointerUp: (_) => _set(false),
        onPointerCancel: (_) => _set(false),
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: widget.onTap,
          child: AnimatedScale(
            scale: _down ? widget.scale : 1,
            duration: Duration(milliseconds: _down ? 120 : 380),
            curve: _down ? Curves.easeOut : Curves.easeOutBack,
            child: AnimatedOpacity(opacity: _down ? 0.88 : 1, duration: const Duration(milliseconds: 150), child: widget.child),
          ),
        ),
      );
}

/// Latar ambient: cahaya merah/merah muda yang melayang pelan di belakang isi, supaya kaca punya warna untuk dibiaskan.
class Ambient extends StatefulWidget {
  const Ambient({super.key});
  @override
  State<Ambient> createState() => _AmbientState();
}

class _AmbientState extends State<Ambient> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(seconds: 22))..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return RepaintBoundary(
      child: AnimatedBuilder(
        animation: _c,
        builder: (_, _) => CustomPaint(painter: _AmbientPainter(_c.value * 2 * math.pi, c), size: Size.infinite),
      ),
    );
  }
}

class _AmbientPainter extends CustomPainter {
  _AmbientPainter(this.t, this.c);
  final double t;
  final AppColors c;

  void _blob(Canvas canvas, Offset center, double r, Color color) => canvas.drawCircle(
        center,
        r,
        Paint()..shader = RadialGradient(colors: [color, color.withValues(alpha: 0)]).createShader(Rect.fromCircle(center: center, radius: r)),
      );

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width, h = size.height;
    canvas.drawRect(Offset.zero & size, Paint()..color = c.bg);
    final d = c.dark;
    _blob(canvas, Offset(w * (0.12 + 0.06 * math.sin(t)), h * (0.02 + 0.03 * math.cos(t))), w * 0.8,
        (d ? const Color(0xFFE1243A) : const Color(0xFFFF4A5F)).withValues(alpha: d ? 0.26 : 0.16));
    _blob(canvas, Offset(w * (0.95 + 0.05 * math.cos(t * 1.3)), h * (0.14 + 0.04 * math.sin(t))), w * 0.62,
        (d ? const Color(0xFF8A1B4A) : const Color(0xFFFF9AAE)).withValues(alpha: d ? 0.24 : 0.20));
    _blob(canvas, Offset(w * (0.3 + 0.1 * math.sin(t * 0.7)), h * (0.62 + 0.04 * math.cos(t))), w * 0.7,
        (d ? const Color(0xFF4A1638) : const Color(0xFFFFC2A8)).withValues(alpha: d ? 0.18 : 0.14));
  }

  @override
  bool shouldRepaint(_AmbientPainter o) => o.t != t || o.c != c;
}
