import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:liquid_glass_easy/liquid_glass_easy.dart';

import '../core/theme.dart';
import '../widgets/common.dart';
import '../widgets/glass.dart';
import 'birthday.dart';
import 'home.dart';
import 'live.dart';
import 'members.dart';
import 'news.dart';
import 'recent.dart';
import 'schedule.dart';

/// Jarak isi dari tepi supaya tidak tertutup kaca: kepala atas dan tab bar bawah.
const double kTopInset = 86;
const double kBottomInset = 110;

const double _barHeight = 64, _barBottom = 18;

/// Kerangka utama: latar ambient + isi halaman di belakang, kepala dan tab bar kaca mengapung di atasnya.
class Shell extends StatefulWidget {
  const Shell({super.key});
  @override
  State<Shell> createState() => _ShellState();
}

class _ShellState extends State<Shell> {
  int _tab = 0;

  static const _tabs = [
    (Icons.home_rounded, 'Beranda'),
    (Icons.sensors_rounded, 'Live'),
    (Icons.calendar_month_rounded, 'Jadwal'),
    (Icons.history_rounded, 'Recent'),
    (Icons.groups_rounded, 'Member'),
  ];

  void go(int i) {
    if (i != _tab) HapticFeedback.selectionClick();
    setState(() => _tab = i);
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final w = MediaQuery.sizeOf(context).width;
    final barWidth = (w - 28).clamp(260.0, 520.0);
    final scaffold = LiquidGlassScaffold(
      backgroundColor: c.bg,
      appBar: LiquidGlassAppBar(
        width: barWidth,
        height: 56,
        centerTitle: false,
        style: glass(context, 28),
        foregroundColor: c.ink,
        leading: const Padding(padding: EdgeInsets.only(left: 6), child: PixelLogo(size: 22)),
        title: Row(mainAxisSize: MainAxisSize.min, children: [
          Text('JKT48', style: AppText.display(22, color: c.ink)),
          Text('CONNECT', style: AppText.display(22, color: c.brand)),
        ]),
        actions: [
          GlassIconButton(
            tooltip: 'Tampilan',
            onTap: () => showThemeSheet(context),
            icon: AnimatedSwitcher(
              duration: const Duration(milliseconds: 420),
              transitionBuilder: (child, a) => RotationTransition(turns: Tween(begin: 0.6, end: 1.0).animate(a), child: FadeTransition(opacity: a, child: child)),
              child: Icon(c.dark ? Icons.dark_mode_rounded : Icons.light_mode_rounded, key: ValueKey(c.dark)),
            ),
          ),
          GlassIconButton(tooltip: 'Ulang tahun', icon: const Icon(Icons.cake_rounded), onTap: () => _push(context, const BirthdayScreen())),
          GlassIconButton(tooltip: 'Berita', icon: const Icon(Icons.newspaper_rounded), onTap: () => _push(context, const NewsScreen())),
          const SizedBox(width: 4),
        ],
      ),
      body: Stack(children: [
        const Positioned.fill(child: Ambient()),
        IndexedStack(index: _tab, children: [
          HomeScreen(onTab: go),
          const LiveScreen(),
          const ScheduleScreen(),
          const RecentScreen(),
          const MembersScreen(),
        ]),
      ]),
      bottomNavigationBar: LiquidGlassTabBar(
        items: [for (final (icon, label) in _tabs) LiquidGlassTabBarItem(icon: icon, label: label)],
        selectedIndex: _tab,
        onChanged: go,
        width: barWidth,
        height: _barHeight,
        itemPadding: 4,
        margin: const EdgeInsets.only(bottom: _barBottom),
        style: glass(context, 32),
        itemStyle: LiquidGlassTabItemStyle(
          selectedColor: c.brand,
          unselectedColor: c.ink.withValues(alpha: 0.82),
          iconSize: 23,
          labelFontSize: 10,
          iconLabelGap: 2,
          selectedFontWeight: FontWeight.w800,
          unselectedFontWeight: FontWeight.w600,
        ),
        pillStyle: LiquidGlassTabPillStyle(
          rest: LiquidGlassStyle(
            shape: glassShape(28, dark: c.dark),
            appearance: LiquidGlassAppearance(color: c.dark ? const Color(0x2EFFFFFF) : const Color(0x1A0E0E11)),
          ),
        ),
      ),
    );
    // Cahaya sentuh tab bar dilukis di lapisan atas tanpa menahan sentuhan, supaya tab bar paket tetap utuh.
    return Stack(children: [
      scaffold,
      Positioned(
        left: 0,
        right: 0,
        bottom: MediaQuery.paddingOf(context).bottom + _barBottom,
        child: Center(
          child: SizedBox(width: barWidth, height: _barHeight, child: PressGlow(radius: _barHeight / 2, foreground: true, strength: c.dark ? 0.75 : 0.45, child: const SizedBox.expand())),
        ),
      ),
    ]);
  }
}

void _push(BuildContext context, Widget page) => Navigator.of(context).push(MaterialPageRoute(builder: (_) => page));

/// Lembar pilihan tema: ikuti sistem, putih, atau gelap.
void showThemeSheet(BuildContext context) {
  showModalBottomSheet<void>(
    context: context,
    builder: (context) => ValueListenableBuilder(
      valueListenable: ThemeController.instance,
      builder: (context, mode, _) {
        final c = AppColors.of(context);
        Widget option(ThemeMode m, IconData icon, String label, String hint) {
          final on = mode == m;
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Pressable(
              onTap: () {
                HapticFeedback.selectionClick();
                ThemeController.instance.set(m);
              },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                padding: const EdgeInsets.all(14),
                decoration: c.cardDecoration(radius: 20).copyWith(border: Border.all(color: on ? c.brand : c.line, width: on ? 1.6 : 0.8)),
                child: Row(children: [
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(gradient: on ? c.brandGradient : null, color: on ? null : c.surface, borderRadius: BorderRadius.circular(14)),
                    child: Icon(icon, color: on ? Colors.white : c.ink, size: 21),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(label, style: AppText.body(15, color: c.ink, weight: 800)),
                      Text(hint, style: AppText.body(12.5, color: c.inkSoft)),
                    ]),
                  ),
                  AnimatedScale(
                    scale: on ? 1 : 0,
                    duration: const Duration(milliseconds: 300),
                    curve: Curves.easeOutBack,
                    child: Icon(Icons.check_circle_rounded, color: c.brand),
                  ),
                ]),
              ),
            ),
          );
        }

        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
              Micro('Tampilan', color: c.brand, dot: true),
              const SizedBox(height: 6),
              Text('TEMA APLIKASI', style: AppText.display(30, color: c.ink)),
              const SizedBox(height: 16),
              option(ThemeMode.system, Icons.brightness_auto_rounded, 'Ikuti sistem', 'Berganti otomatis sesuai pengaturan ponsel'),
              option(ThemeMode.light, Icons.light_mode_rounded, 'Putih', 'Latar putih bersih dengan kaca susu'),
              option(ThemeMode.dark, Icons.dark_mode_rounded, 'Gelap', 'Hitam pekat dengan kaca asap'),
            ]),
          ),
        );
      },
    ),
  );
}
