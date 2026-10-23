import 'package:flutter/material.dart';

/// Palet JKT48Connect — sama dengan token web (`src/styles.css`).
class AppColors {
  const AppColors({
    required this.bg,
    required this.surface,
    required this.card,
    required this.ink,
    required this.inkSoft,
    required this.line,
    required this.brand,
    required this.brandStrong,
    required this.blush,
    required this.butter,
    required this.nav,
    required this.dark,
  });

  final Color bg, surface, card, ink, inkSoft, line, brand, brandStrong, blush, butter, nav;
  final bool dark;

  static const light = AppColors(
    bg: Color(0xFFF3EEE6),
    surface: Color(0xFFE9E2D7),
    card: Color(0xFFFBF8F3),
    ink: Color(0xFF1D1517),
    inkSoft: Color(0xFF776B66),
    line: Color(0x1C1D1517),
    brand: Color(0xFFE1243A),
    brandStrong: Color(0xFFB9172B),
    blush: Color(0xFFF6DCDC),
    butter: Color(0xFFFDE6B0),
    nav: Color(0xFF1D1517),
    dark: false,
  );

  static const night = AppColors(
    bg: Color(0xFF141012),
    surface: Color(0xFF211A1D),
    card: Color(0xFF1A1518),
    ink: Color(0xFFF3ECE6),
    inkSoft: Color(0xFF9F918C),
    line: Color(0x17FFEBE6),
    brand: Color(0xFFFF3B52),
    brandStrong: Color(0xFFFF6476),
    blush: Color(0xFF3A1D23),
    butter: Color(0xFFFDE6B0),
    nav: Color(0xFF0B0809),
    dark: true,
  );

  static AppColors of(BuildContext context) => Theme.of(context).brightness == Brightness.dark ? night : light;
}

/// Tipografi: Archivo condensed untuk judul, IBM Plex Mono untuk label mikro.
class AppText {
  static TextStyle display(double size, {Color? color, double weight = 900}) => TextStyle(
        fontFamily: 'Archivo',
        fontSize: size,
        height: 0.9,
        color: color,
        letterSpacing: -0.2,
        fontVariations: [FontVariation('wght', weight), const FontVariation('wdth', 62)],
      );

  static TextStyle body(double size, {Color? color, double weight = 500, double height = 1.35}) => TextStyle(
        fontFamily: 'Archivo',
        fontSize: size,
        height: height,
        color: color,
        fontVariations: [FontVariation('wght', weight), const FontVariation('wdth', 100)],
      );

  static TextStyle micro({Color? color, double size = 10.5}) => TextStyle(
        fontFamily: 'PlexMono',
        fontWeight: FontWeight.w600,
        fontSize: size,
        letterSpacing: 1.6,
        color: color,
      );

  static TextStyle mono(double size, {Color? color, FontWeight weight = FontWeight.w500}) =>
      TextStyle(fontFamily: 'PlexMono', fontWeight: weight, fontSize: size, color: color, fontFeatures: const [FontFeature.tabularFigures()]);
}

ThemeData buildTheme(Brightness brightness) {
  final c = brightness == Brightness.dark ? AppColors.night : AppColors.light;
  final scheme = ColorScheme.fromSeed(seedColor: c.brand, brightness: brightness, primary: c.brand, surface: c.bg);
  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: c.bg,
    fontFamily: 'Archivo',
    splashFactory: InkSparkle.splashFactory,
    progressIndicatorTheme: ProgressIndicatorThemeData(color: c.brand),
    textSelectionTheme: TextSelectionThemeData(cursorColor: c.brand, selectionColor: c.brand.withValues(alpha: 0.25)),
  );
}
