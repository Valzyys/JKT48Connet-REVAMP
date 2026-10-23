import 'package:flutter/material.dart';
import 'package:liquid_glass_easy/liquid_glass_easy.dart';

import '../core/theme.dart';

/// Bentuk kaca: kapsul/kotak membulat kontinu dengan tepi optik yang memantulkan cahaya.
LiquidGlassShape glassShape(double radius, {bool dark = false}) => LiquidGlassShape.continuousRoundedRectangle(
      cornerRadius: radius,
      clipQuality: LiquidGlassClipQuality.exact,
      borderWidth: 0.8,
      lightIntensity: dark ? 0.7 : 0.95,
      lightDirection: 62,
      borderType: const OpticalBorder(borderSaturation: 1.15, ambientIntensity: 0.85, borderSolidity: 0.95),
    );

/// Kaca "susu" untuk latar terang dan kaca "asap" untuk latar gelap.
LiquidGlassStyle glass(BuildContext context, double radius, {bool? dark, double distortion = 0.07, Color? tint}) {
  final d = dark ?? AppColors.of(context).dark;
  return LiquidGlassStyle(
    shape: glassShape(radius, dark: d),
    appearance: LiquidGlassAppearance(
      color: tint ?? (d ? const Color(0x5C141012) : const Color(0x8FFFFFFF)),
      blur: const LiquidGlassBlur(sigmaX: 6, sigmaY: 6),
      saturation: 1.25,
      shadow: LiquidGlassShadow(blur: 10, opacity: d ? 0.28 : 0.14),
    ),
    refraction: LiquidGlassRefraction(distortion: distortion, distortionWidth: 26),
  );
}

/// Kaca merah tipis untuk pil "LIVE" di atas foto.
LiquidGlassStyle glassRed(double radius) => LiquidGlassStyle(
      shape: glassShape(radius, dark: true),
      appearance: const LiquidGlassAppearance(
        color: Color(0x99E1243A),
        blur: LiquidGlassBlur(sigmaX: 4, sigmaY: 4),
        saturation: 1.3,
      ),
      refraction: const LiquidGlassRefraction(distortion: 0.1, distortionWidth: 18),
    );

/// Lensa kaca kecil yang bisa ditekan (membengkak saat disentuh).
class GlassChip extends StatelessWidget {
  const GlassChip({super.key, required this.child, this.radius = 999, this.dark, this.style, this.padding = const EdgeInsets.symmetric(horizontal: 12, vertical: 7)});
  final Widget child;
  final double radius;
  final bool? dark;
  final LiquidGlassStyle? style;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) => LiquidGlassLens(
        style: style ?? glass(context, radius > 100 ? 18 : radius, dark: dark),
        touch: const LiquidGlassTouch(flex: LiquidGlassFlex()),
        child: Padding(padding: padding, child: child),
      );
}

/// Pilihan segmen di wadah kaca; pil merah meluncur (dengan pantulan) ke segmen terpilih.
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
                color: c.brand,
                borderRadius: BorderRadius.circular(height),
                boxShadow: [BoxShadow(color: c.brand.withValues(alpha: 0.35), blurRadius: 14, offset: const Offset(0, 6))],
              ),
            ),
          ),
          Row(children: [
            for (var i = 0; i < n; i++)
              Expanded(
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => onChanged(i),
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
    );
  }
}
