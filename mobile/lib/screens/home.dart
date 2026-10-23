import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/models.dart';
import '../core/theme.dart';
import '../widgets/cards.dart';
import '../widgets/common.dart';
import '../widgets/glass.dart';
import 'birthday.dart';
import 'news.dart';
import 'recent.dart';
import 'schedule.dart';
import 'shell.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.onTab});
  final void Function(int) onTab;
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final api = Api.instance;
  late Future<List<LiveSession>> _live;
  late Future<List<TheaterShow>> _next;
  late Future<Paged<RecentLive>> _recent;
  late Future<List<BirthdayEntry>> _birthdays;
  late Future<Paged<NewsItem>> _news;

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load({bool force = false}) {
    _live = api.live(force: force);
    _next = api.nextSchedule(force: force);
    _recent = api.recent(1, force: force);
    _birthdays = api.birthdays(force: force);
    _news = api.news(1, force: force);
  }

  Future<void> _refresh() async {
    setState(() => _load(force: true));
    await Future.wait([_live, _next, _recent]).catchError((_) => <Object>[]);
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return RefreshIndicator(
      color: c.brand,
      edgeOffset: kTopInset,
      onRefresh: _refresh,
      child: ListView(
        padding: const EdgeInsets.only(top: kTopInset, bottom: kBottomInset),
        children: [
          const _Hero(),
          _QuickActions(onTab: widget.onTab),
          SectionHead(label: 'Sedang berlangsung', title: 'Live sekarang', onMore: () => widget.onTab(1)),
          FutureBuilder(
            future: _live,
            builder: (_, s) {
              if (s.hasError) return ErrorRetry(error: s.error!, onRetry: () => setState(() => _live = api.live(force: true)));
              if (!s.hasData) return const Padding(padding: EdgeInsets.symmetric(horizontal: 16), child: Skeleton(height: 260, radius: 28));
              final list = s.data!;
              if (list.isEmpty) return const _EmptyLive();
              return SizedBox(
                height: 268,
                child: PageView.builder(
                  controller: PageController(viewportFraction: 0.86),
                  padEnds: false,
                  itemCount: list.length,
                  itemBuilder: (_, i) => Padding(padding: EdgeInsets.only(left: i == 0 ? 16 : 6, right: 6), child: LiveCard(list[i]).staggerIn(i)),
                ),
              );
            },
          ),
          SectionHead(label: 'Jangan sampai ketinggalan', title: 'Show berikutnya', onMore: () => widget.onTab(2)),
          FutureBuilder(
            future: _next,
            builder: (_, s) {
              if (s.hasError) return ErrorRetry(error: s.error!, onRetry: () => setState(() => _next = api.nextSchedule(force: true)));
              if (!s.hasData) return const Padding(padding: EdgeInsets.symmetric(horizontal: 20), child: Skeleton(height: 150, radius: 26));
              final shows = s.data!;
              if (shows.isEmpty) return const SizedBox.shrink();
              final show = shows.firstWhere((x) => x.category == 'show', orElse: () => shows.first);
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: _NextShow(show, onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => TheaterDetailScreen(show.id, title: show.title)))),
              );
            },
          ),
          SectionHead(label: 'Rekap live', title: 'Recent', onMore: () => widget.onTab(3)),
          FutureBuilder(
            future: _recent,
            builder: (_, s) {
              if (s.hasError) return ErrorRetry(error: s.error!, onRetry: () => setState(() => _recent = api.recent(1, force: true)));
              if (!s.hasData) {
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Column(children: [for (var i = 0; i < 3; i++) const Padding(padding: EdgeInsets.only(bottom: 10), child: Skeleton(height: 94))]),
                );
              }
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Column(children: [
                  for (final (i, r) in s.data!.items.take(4).indexed)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: RecentTile(r, onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => RecentDetailScreen(r)))).staggerIn(i),
                    ),
                ]),
              );
            },
          ),
          SectionHead(
            label: 'Rayakan bersama',
            title: 'Ulang tahun',
            onMore: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const BirthdayScreen())),
          ),
          FutureBuilder(
            future: _birthdays,
            builder: (_, s) {
              if (!s.hasData) return const SizedBox(height: 120);
              return SizedBox(
                height: 128,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  itemCount: s.data!.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 14),
                  itemBuilder: (_, i) => BirthdayBubble(s.data![i]).staggerIn(i),
                ),
              );
            },
          ),
          SectionHead(
            label: 'Kabar terbaru',
            title: 'Berita',
            onMore: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const NewsScreen())),
          ),
          FutureBuilder(
            future: _news,
            builder: (_, s) {
              if (!s.hasData) return const SizedBox(height: 80);
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Column(children: [
                  for (final (i, n) in s.data!.items.take(3).indexed)
                    NewsTile(n, index: i, onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => NewsDetailScreen(n)))).staggerIn(i),
                ]),
              );
            },
          ),
          const SizedBox(height: 24),
          const Center(child: PixelLogo(size: 18)),
          const SizedBox(height: 10),
          Center(child: Text('Fan-made · tidak berafiliasi dengan JKT48 Operation Team', style: AppText.mono(10.5, color: c.inkSoft))),
        ],
      ),
    );
  }
}

/// Panel pembuka bergradasi merah: logo piksel yang tersusun, sapaan, dan tagline dengan baris bergaris tepi.
class _Hero extends StatelessWidget {
  const _Hero();
  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final hour = DateTime.now().toUtc().add(const Duration(hours: 7)).hour;
    final greet = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 18 ? 'Selamat sore' : 'Selamat malam';
    final outline = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.4
      ..color = Colors.white;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 0),
      child: Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          gradient: c.brandGradient,
          borderRadius: BorderRadius.circular(32),
          boxShadow: [BoxShadow(color: c.brand.withValues(alpha: c.dark ? 0.28 : 0.30), blurRadius: 32, offset: const Offset(0, 14))],
        ),
        child: Stack(children: [
          // Logo besar samar sebagai tanda air, berputar sangat pelan.
          Positioned(
            right: -46,
            top: -30,
            child: const Opacity(opacity: 0.14, child: PixelLogo(size: 210, color: Colors.white))
                .animate(onPlay: (x) => x.repeat())
                .rotate(duration: 60.seconds, begin: 0, end: 1),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(22, 22, 22, 24),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                const PixelLogo(size: 26, assemble: true, color: Colors.white),
                const SizedBox(width: 12),
                Expanded(child: Text('$greet · Fan Signal'.toUpperCase(), style: AppText.micro(color: Colors.white.withValues(alpha: 0.78)))),
                const SignalBars(height: 13, color: Colors.white),
              ]),
              const SizedBox(height: 26),
              Text('YOUR OSHI.', style: AppText.display(48, color: Colors.white)),
              Text('YOUR FRONT ROW', style: AppText.display(48, foreground: outline)),
              Text('FEELING.', style: AppText.display(48, color: Colors.white)),
              const SizedBox(height: 14),
              Text('Live, jadwal theater, recap, dan member — semua dalam genggaman.', style: AppText.body(14, color: Colors.white.withValues(alpha: 0.82))),
            ]
                .animate(interval: 70.ms)
                .fadeIn(duration: 500.ms)
                .slideY(begin: 0.25, end: 0, curve: Curves.easeOutCubic)),
          ),
        ]),
      ),
    );
  }
}

/// Pintasan kaca di bawah hero: tiap tombol bercahaya putih saat disentuh.
class _QuickActions extends StatelessWidget {
  const _QuickActions({required this.onTab});
  final void Function(int) onTab;
  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    void push(Widget page) => Navigator.of(context).push(MaterialPageRoute(builder: (_) => page));
    final items = [
      (Icons.sensors_rounded, 'Live', () => onTab(1)),
      (Icons.calendar_month_rounded, 'Jadwal', () => onTab(2)),
      (Icons.cake_rounded, 'Ultah', () => push(const BirthdayScreen())),
      (Icons.newspaper_rounded, 'Berita', () => push(const NewsScreen())),
    ];
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      child: Row(children: [
        for (final (i, (icon, label, onTap)) in items.indexed) ...[
          if (i > 0) const SizedBox(width: 10),
          Expanded(
            child: GlassChip(
              radius: 22,
              onTap: onTap,
              padding: const EdgeInsets.symmetric(vertical: 13),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Icon(icon, color: c.brand, size: 22),
                const SizedBox(height: 5),
                Text(label, style: AppText.body(12, color: c.ink, weight: 800)),
              ]),
            ).staggerIn(i, step: 60),
          ),
        ],
      ]),
    );
  }
}

class _EmptyLive extends StatelessWidget {
  const _EmptyLive();
  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: c.cardDecoration(radius: 24),
        child: Row(children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(color: c.bg.withValues(alpha: c.dark ? 0.6 : 1), borderRadius: BorderRadius.circular(16)),
            alignment: Alignment.center,
            child: SignalBars(active: false, height: 18, color: c.inkSoft),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Belum ada yang live', style: AppText.body(15, color: c.ink, weight: 800)),
              const SizedBox(height: 2),
              Text('Cek lagi sebentar ya!', style: AppText.body(13, color: c.inkSoft)),
            ]),
          ),
        ]),
      ),
    );
  }
}

/// Show berikutnya: panel kontras dengan pil hitung mundur merah dan deret member.
class _NextShow extends StatelessWidget {
  const _NextShow(this.show, {this.onTap});
  final TheaterShow show;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Pressable(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: c.panelDecoration(radius: 28),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            categoryPill(context, show.category),
            const SizedBox(width: 8),
            Text('${fmtDate(show.date, pattern: 'EEE, d MMM')} · ${fmtTime(show.date)}', style: AppText.mono(11, color: Colors.white60)),
            const Spacer(),
            Container(
              width: 32,
              height: 32,
              decoration: const BoxDecoration(color: Colors.white12, shape: BoxShape.circle),
              child: const Icon(Icons.north_east_rounded, color: Colors.white, size: 16),
            ),
          ]),
          const SizedBox(height: 14),
          Text(show.title.toUpperCase(), style: AppText.display(32, color: Colors.white)),
          const SizedBox(height: 16),
          Row(children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(gradient: c.brandGradient, borderRadius: BorderRadius.circular(99)),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.timer_outlined, color: Colors.white, size: 15),
                const SizedBox(width: 6),
                Countdown(show.date, style: AppText.mono(13.5, color: Colors.white, weight: FontWeight.w600)),
              ]),
            ),
            const Spacer(),
            if (show.members.isNotEmpty) AvatarStack(show.members.map((m) => m.img).toList(), size: 28, max: 5, ring: c.panel, extraColor: Colors.white60),
          ]),
        ]),
      ),
    ).animate().fadeIn(duration: 450.ms).scaleXY(begin: 0.96, end: 1, curve: Curves.easeOutBack);
  }
}
