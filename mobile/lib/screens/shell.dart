import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:liquid_glass_easy/liquid_glass_easy.dart';

import '../core/api.dart';
import '../core/theme.dart';
import '../widgets/app_header.dart';
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
  int? _live;
  Timer? _poll;
  // Posisi gulir tiap tab, supaya kepala atas tahu kapan harus ringkas.
  final _offsets = List<double>.filled(5, 0);

  static const _tabs = [
    (Icons.home_rounded, 'Beranda'),
    (Icons.sensors_rounded, 'Live'),
    (Icons.calendar_month_rounded, 'Jadwal'),
    (Icons.history_rounded, 'Recent'),
    (Icons.groups_rounded, 'Member'),
  ];

  @override
  void initState() {
    super.initState();
    _refreshLive();
    _poll = Timer.periodic(const Duration(seconds: 60), (_) => _refreshLive());
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  Future<void> _refreshLive() async {
    try {
      final list = await Api.instance.live();
      if (mounted) setState(() => _live = list.length);
    } catch (_) {}
  }

  void go(int i) {
    if (i != _tab) HapticFeedback.selectionClick();
    setState(() => _tab = i);
  }

  bool _onScroll(ScrollNotification n) {
    if (n.depth == 0 && n.metrics.axis == Axis.vertical) {
      final was = _offsets[_tab] > 24;
      _offsets[_tab] = n.metrics.pixels;
      if (was != (_offsets[_tab] > 24)) setState(() {});
    }
    return false;
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final w = MediaQuery.sizeOf(context).width;
    final barWidth = (w - 28).clamp(260.0, 520.0);
    final scaffold = LiquidGlassScaffold(
      backgroundColor: c.bg,
      appBarTopMargin: 4,
      appBar: AppHeader(
        width: barWidth,
        subtitle: headerSubtitle(_tab, _live),
        compact: _offsets[_tab] > 24,
        liveCount: _live,
        onLogo: () => go(0),
        onLive: () => go(1),
        onMenu: () => showMenuSheet(
          context,
          onBirthday: () => _push(context, const BirthdayScreen()),
          onNews: () => _push(context, const NewsScreen()),
        ),
      ),
      body: Stack(children: [
        const Positioned.fill(child: Ambient()),
        NotificationListener<ScrollNotification>(
          onNotification: _onScroll,
          child: IndexedStack(index: _tab, children: [
            HomeScreen(onTab: go),
            const LiveScreen(),
            const ScheduleScreen(),
            const RecentScreen(),
            const MembersScreen(),
          ]),
        ),
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
