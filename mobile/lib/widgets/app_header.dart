import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:liquid_glass_easy/liquid_glass_easy.dart';

import '../core/theme.dart';
import 'common.dart';
import 'glass.dart';

/// Kepala atas ala iOS 26: beberapa lensa kaca terpisah yang mengapung.
/// Kapsul merek (logo + wordmark + subjudul per tab), pil status live, dan tombol menu.
/// Saat isi digulir, kapsul mengecil dan subjudulnya disembunyikan.
class AppHeader extends StatelessWidget {
  const AppHeader({
    super.key,
    required this.width,
    required this.subtitle,
    required this.compact,
    required this.liveCount,
    required this.onLive,
    required this.onMenu,
    required this.onLogo,
  });
  final double width;
  final String subtitle;
  final bool compact;
  final int? liveCount;
  final VoidCallback onLive, onMenu, onLogo;

  static const _dur = Duration(milliseconds: 380);

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final h = compact ? 46.0 : 56.0;
    final live = (liveCount ?? 0) > 0;
    return SizedBox(
      width: width,
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // Kapsul merek.
        Expanded(
          child: LiquidGlassLens(
            style: glass(context, h / 2),
            touch: const LiquidGlassTouch(flex: LiquidGlassFlex()),
            child: PressGlow(
              radius: h / 2,
              onTap: onLogo,
              child: AnimatedContainer(
                duration: _dur,
                curve: Curves.easeOutCubic,
                height: h,
                padding: EdgeInsets.only(left: compact ? 12 : 14, right: 14),
                child: Row(children: [
                  AnimatedContainer(
                    duration: _dur,
                    curve: Curves.easeOutCubic,
                    width: compact ? 26 : 34,
                    height: compact ? 26 : 34,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(gradient: c.brandGradient, borderRadius: BorderRadius.circular(compact ? 9 : 12)),
                    child: PixelLogo(size: compact ? 15 : 19, color: Colors.white),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
                      FittedBox(
                        fit: BoxFit.scaleDown,
                        alignment: Alignment.centerLeft,
                        child: Row(mainAxisSize: MainAxisSize.min, children: [
                          Text('JKT48', style: AppText.display(compact ? 19 : 21, color: c.ink)),
                          Text('CONNECT', style: AppText.display(compact ? 19 : 21, color: c.brand)),
                        ]),
                      ),
                      // Subjudul berganti per tab (geser + pudar), hilang saat ringkas.
                      AnimatedSize(
                        duration: _dur,
                        curve: Curves.easeOutCubic,
                        child: compact
                            ? const SizedBox(width: double.infinity)
                            : Padding(
                                padding: const EdgeInsets.only(top: 3),
                                child: AnimatedSwitcher(
                                  duration: const Duration(milliseconds: 320),
                                  transitionBuilder: (child, a) => FadeTransition(
                                    opacity: a,
                                    child: SlideTransition(position: Tween(begin: const Offset(0, 0.6), end: Offset.zero).animate(a), child: child),
                                  ),
                                  layoutBuilder: (cur, prev) => Stack(alignment: Alignment.centerLeft, children: [...prev, ?cur]),
                                  child: Text(
                                    subtitle.toUpperCase(),
                                    key: ValueKey(subtitle),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: AppText.micro(color: c.inkSoft, size: 9),
                                  ),
                                ),
                              ),
                      ),
                    ]),
                  ),
                ]),
              ),
            ),
          ),
        ),
        const SizedBox(width: 8),
        // Pil status live: kaca merah dengan sinyal bergerak saat ada yang live.
        LiquidGlassLens(
          style: live ? glassRed(h / 2) : glass(context, h / 2),
          touch: const LiquidGlassTouch(flex: LiquidGlassFlex()),
          child: PressGlow(
            radius: h / 2,
            onTap: onLive,
            child: AnimatedContainer(
              duration: _dur,
              curve: Curves.easeOutCubic,
              height: h,
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                SignalBars(active: live, height: 13, color: live ? Colors.white : c.inkSoft),
                const SizedBox(width: 7),
                Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
                  CountUp(liveCount, style: AppText.display(compact ? 18 : 20, color: live ? Colors.white : c.ink)),
                  if (!compact) Text('LIVE', style: AppText.micro(color: live ? Colors.white70 : c.inkSoft, size: 8.5)),
                ]),
              ]),
            ),
          ),
        ),
        const SizedBox(width: 8),
        // Tombol menu bulat.
        LiquidGlassLens(
          style: glass(context, h / 2),
          touch: const LiquidGlassTouch(flex: LiquidGlassFlex()),
          child: PressGlow(
            onTap: onMenu,
            child: AnimatedContainer(
              duration: _dur,
              curve: Curves.easeOutCubic,
              width: h,
              height: h,
              alignment: Alignment.center,
              child: Icon(Icons.grid_view_rounded, color: c.ink, size: compact ? 19 : 21),
            ),
          ),
        ),
      ]),
    );
  }
}

/// Subjudul kapsul merek untuk tiap tab.
String headerSubtitle(int tab, int? liveCount) {
  final now = DateTime.now().toUtc().add(const Duration(hours: 7));
  return switch (tab) {
    0 => 'Beranda · ${DateFormat('EEE, d MMM', 'id_ID').format(now)}',
    1 => (liveCount ?? 0) > 0 ? '$liveCount member sedang live' : 'Belum ada yang live',
    2 => 'Jadwal theater & event',
    3 => 'Rekap live terbaru',
    _ => 'Direktori member',
  };
}

/// Lembar menu: pintasan Ulang tahun & Berita, plus pilihan tema.
void showMenuSheet(BuildContext context, {required VoidCallback onBirthday, required VoidCallback onNews}) {
  showModalBottomSheet<void>(
    context: context,
    builder: (context) => ValueListenableBuilder(
      valueListenable: ThemeController.instance,
      builder: (context, mode, _) {
        final c = AppColors.of(context);
        Widget tile(IconData icon, String label, String hint, VoidCallback onTap) => Expanded(
              child: Pressable(
                onTap: () {
                  Navigator.of(context).pop();
                  onTap();
                },
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: c.cardDecoration(radius: 22),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Container(
                      width: 42,
                      height: 42,
                      decoration: BoxDecoration(gradient: c.brandGradient, borderRadius: BorderRadius.circular(14)),
                      child: Icon(icon, color: Colors.white, size: 21),
                    ),
                    const SizedBox(height: 14),
                    Text(label, style: AppText.body(15, color: c.ink, weight: 800)),
                    Text(hint, style: AppText.body(12, color: c.inkSoft)),
                  ]),
                ),
              ),
            );
        Widget themeOption(ThemeMode m, IconData icon, String label) {
          final on = mode == m;
          return Expanded(
            child: Pressable(
              onTap: () {
                HapticFeedback.selectionClick();
                ThemeController.instance.set(m);
              },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                padding: const EdgeInsets.symmetric(vertical: 14),
                decoration: on ? BoxDecoration(gradient: c.brandGradient, borderRadius: BorderRadius.circular(18)) : c.cardDecoration(radius: 18),
                child: Column(children: [
                  Icon(icon, color: on ? Colors.white : c.ink, size: 21),
                  const SizedBox(height: 6),
                  Text(label, style: AppText.body(12.5, color: on ? Colors.white : c.ink, weight: 800)),
                ]),
              ),
            ),
          );
        }

        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 14),
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
              Micro('Menu', color: c.brand, dot: true),
              const SizedBox(height: 6),
              Text('JELAJAHI', style: AppText.display(30, color: c.ink)),
              const SizedBox(height: 14),
              Row(children: [
                tile(Icons.cake_rounded, 'Ulang tahun', 'Member yang segera berulang tahun', onBirthday),
                const SizedBox(width: 10),
                tile(Icons.newspaper_rounded, 'Berita', 'Kabar terbaru dari jkt48.com', onNews),
              ]),
              const SizedBox(height: 22),
              Micro('Tema', color: c.brand, dot: true),
              const SizedBox(height: 10),
              Row(children: [
                themeOption(ThemeMode.system, Icons.brightness_auto_rounded, 'Sistem'),
                const SizedBox(width: 8),
                themeOption(ThemeMode.light, Icons.light_mode_rounded, 'Putih'),
                const SizedBox(width: 8),
                themeOption(ThemeMode.dark, Icons.dark_mode_rounded, 'Gelap'),
              ]),
            ]),
          ),
        );
      },
    ),
  );
}
