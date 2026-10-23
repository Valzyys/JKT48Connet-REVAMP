import 'package:flutter/material.dart';
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

/// Kerangka utama: isi halaman di belakang, kepala dan tab bar kaca mengapung di atasnya.
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

  void go(int i) => setState(() => _tab = i);

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final w = MediaQuery.sizeOf(context).width;
    final barWidth = (w - 28).clamp(260.0, 520.0);
    return LiquidGlassScaffold(
      backgroundColor: c.bg,
      appBar: LiquidGlassAppBar(
        width: barWidth,
        height: 56,
        centerTitle: false,
        style: glass(context, 28),
        foregroundColor: c.ink,
        leading: const Padding(padding: EdgeInsets.only(left: 4), child: PixelLogo(size: 22)),
        title: Row(mainAxisSize: MainAxisSize.min, children: [
          Text('JKT48', style: AppText.display(22, color: c.ink)),
          Text('CONNECT', style: AppText.display(22, color: c.brand)),
        ]),
        actions: [
          _HeadButton(icon: Icons.cake_rounded, label: 'Ulang tahun', onTap: () => _push(context, const BirthdayScreen())),
          _HeadButton(icon: Icons.newspaper_rounded, label: 'Berita', onTap: () => _push(context, const NewsScreen())),
        ],
      ),
      body: IndexedStack(index: _tab, children: [
        HomeScreen(onTab: go),
        const LiveScreen(),
        const ScheduleScreen(),
        const RecentScreen(),
        const MembersScreen(),
      ]),
      bottomNavigationBar: LiquidGlassTabBar(
        items: [for (final (icon, label) in _tabs) LiquidGlassTabBarItem(icon: icon, label: label)],
        selectedIndex: _tab,
        onChanged: go,
        width: barWidth,
        height: 64,
        itemPadding: 4,
        margin: const EdgeInsets.only(bottom: 18),
        style: glass(context, 32),
        itemStyle: LiquidGlassTabItemStyle(
          selectedColor: c.brand,
          unselectedColor: c.ink,
          iconSize: 23,
          labelFontSize: 10,
          iconLabelGap: 2,
          selectedFontWeight: FontWeight.w800,
          unselectedFontWeight: FontWeight.w600,
        ),
        pillStyle: LiquidGlassTabPillStyle(
          rest: LiquidGlassStyle(
            shape: glassShape(28, dark: c.dark),
            appearance: LiquidGlassAppearance(color: c.dark ? const Color(0x33FFFFFF) : const Color(0x2EAEAEB2)),
          ),
        ),
      ),
    );
  }
}

void _push(BuildContext context, Widget page) => Navigator.of(context).push(MaterialPageRoute(builder: (_) => page));

class _HeadButton extends StatelessWidget {
  const _HeadButton({required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => IconButton(
        tooltip: label,
        onPressed: onTap,
        icon: Icon(icon, size: 21, color: AppColors.of(context).ink),
        visualDensity: VisualDensity.compact,
      );
}
