import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Palet JKT48Connect. Tema putih bersih dan tema gelap netral (hitam pekat, bukan cokelat).
class AppColors {
  const AppColors({
    required this.bg,
    required this.card,
    required this.surface,
    required this.ink,
    required this.inkSoft,
    required this.line,
    required this.brand,
    required this.brandStrong,
    required this.blush,
    required this.butter,
    required this.butterInk,
    required this.panel,
    required this.dark,
  });

  /// Latar halaman, kartu, isian (chip, skeleton, kotak tanggal).
  final Color bg, card, surface;
  final Color ink, inkSoft, line;
  final Color brand, brandStrong, blush, butter, butterInk;

  /// Panel kontras (hero sekunder, replay, statistik besar): tinta di tema putih, abu terangkat di tema gelap.
  final Color panel;
  final bool dark;

  static const light = AppColors(
    bg: Color(0xFFFFFFFF),
    card: Color(0xFFF4F4F6),
    surface: Color(0xFFE9E9EE),
    ink: Color(0xFF0E0E11),
    inkSoft: Color(0xFF6C6C75),
    line: Color(0x140E0E11),
    brand: Color(0xFFE1243A),
    brandStrong: Color(0xFFB9172B),
    blush: Color(0xFFFFE5E8),
    butter: Color(0xFFFFF0C7),
    butterInk: Color(0xFF8A5A00),
    panel: Color(0xFF0E0E11),
    dark: false,
  );

  static const night = AppColors(
    bg: Color(0xFF050506),
    card: Color(0xFF131316),
    surface: Color(0xFF1F1F24),
    ink: Color(0xFFF4F4F6),
    inkSoft: Color(0xFF8E8E97),
    line: Color(0x1CFFFFFF),
    brand: Color(0xFFFF4259),
    brandStrong: Color(0xFFFF6B7D),
    blush: Color(0xFF3A141B),
    butter: Color(0xFF2E2410),
    butterInk: Color(0xFFFFC95C),
    panel: Color(0xFF1A1A1F),
    dark: true,
  );

  static AppColors of(BuildContext context) => Theme.of(context).brightness == Brightness.dark ? night : light;

  /// Gradasi merah merek; di tema gelap lebih dalam supaya tidak menyilaukan.
  LinearGradient get brandGradient => LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: dark ? const [Color(0xFFD42340), Color(0xFF7A0E1F)] : const [Color(0xFFFF4A5F), Color(0xFFC3142B)],
      );

  /// Dekorasi kartu standar: isian lembut, garis rambut di tema gelap.
  BoxDecoration cardDecoration({double radius = 22, Color? color}) => BoxDecoration(
        color: color ?? card,
        borderRadius: BorderRadius.circular(radius),
        border: dark ? Border.all(color: line, width: 0.8) : null,
      );

  /// Dekorasi panel kontras.
  BoxDecoration panelDecoration({double radius = 26}) => BoxDecoration(
        color: panel,
        borderRadius: BorderRadius.circular(radius),
        border: dark ? Border.all(color: line, width: 0.8) : null,
      );
}

/// Tipografi: Archivo condensed untuk judul, IBM Plex Mono untuk label mikro.
class AppText {
  static TextStyle display(double size, {Color? color, double weight = 900, Paint? foreground}) => TextStyle(
        fontFamily: 'Archivo',
        fontSize: size,
        height: 0.9,
        color: foreground == null ? color : null,
        foreground: foreground,
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

/// Pilihan tema pengguna (Sistem / Terang / Gelap), disimpan di perangkat.
class ThemeController extends ValueNotifier<ThemeMode> {
  ThemeController._() : super(ThemeMode.system);
  static final instance = ThemeController._();
  static const _key = 'theme_mode';

  Future<void> load() async {
    final p = await SharedPreferences.getInstance();
    value = ThemeMode.values.firstWhere((m) => m.name == p.getString(_key), orElse: () => ThemeMode.system);
  }

  Future<void> set(ThemeMode mode) async {
    value = mode;
    final p = await SharedPreferences.getInstance();
    await p.setString(_key, mode.name);
  }
}

ThemeData buildTheme(Brightness brightness) {
  final c = brightness == Brightness.dark ? AppColors.night : AppColors.light;
  final scheme = ColorScheme.fromSeed(seedColor: c.brand, brightness: brightness, primary: c.brand, surface: c.bg, onSurface: c.ink);
  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: c.bg,
    canvasColor: c.bg,
    fontFamily: 'Archivo',
    splashFactory: InkSparkle.splashFactory,
    progressIndicatorTheme: ProgressIndicatorThemeData(color: c.brand, refreshBackgroundColor: c.card),
    bottomSheetTheme: BottomSheetThemeData(backgroundColor: c.bg, surfaceTintColor: Colors.transparent, showDragHandle: true, dragHandleColor: c.inkSoft.withValues(alpha: 0.4)),
    textSelectionTheme: TextSelectionThemeData(cursorColor: c.brand, selectionColor: c.brand.withValues(alpha: 0.25), selectionHandleColor: c.brand),
    appBarTheme: AppBarTheme(
      systemOverlayStyle: overlayStyle(brightness),
    ),
  );
}

/// Ikon status bar & navigasi sistem mengikuti tema; latarnya transparan (edge-to-edge).
SystemUiOverlayStyle overlayStyle(Brightness brightness) {
  final dark = brightness == Brightness.dark;
  return SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: dark ? Brightness.light : Brightness.dark,
    statusBarBrightness: dark ? Brightness.dark : Brightness.light,
    systemNavigationBarColor: Colors.transparent,
    systemNavigationBarIconBrightness: dark ? Brightness.light : Brightness.dark,
    systemNavigationBarContrastEnforced: false,
  );
}
