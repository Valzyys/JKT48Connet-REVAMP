import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../core/api.dart';
import '../core/models.dart';
import '../core/theme.dart';
import '../widgets/cards.dart';
import '../widgets/common.dart';
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
          SectionHead(label: 'Sedang berlangsung', title: 'Live sekarang', onMore: () => widget.onTab(1)),
          FutureBuilder(
            future: _live,
            builder: (_, s) {
              if (s.hasError) return ErrorRetry(error: s.error!, onRetry: () => setState(() => _live = api.live(force: true)));
              if (!s.hasData) return const Padding(padding: EdgeInsets.symmetric(horizontal: 20), child: Skeleton(height: 260, radius: 28));
              final list = s.data!;
              if (list.isEmpty) return const _EmptyLive();
              return SizedBox(
                height: 268,
                child: PageView.builder(
                  controller: PageController(viewportFraction: 0.86),
                  padEnds: false,
                  itemCount: list.length,
                  itemBuilder: (_, i) => Padding(padding: EdgeInsets.only(left: i == 0 ? 20 : 6, right: 6), child: LiveCard(list[i]).staggerIn(i)),
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
                padding: const EdgeInsets.symmetric(horizontal: 20),
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
                padding: const EdgeInsets.symmetric(horizontal: 20),
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
          const SizedBox(height: 20),
          Center(child: Text('Fan-made · tidak berafiliasi dengan JKT48 Operation Team', style: AppText.mono(10.5, color: c.inkSoft))),
        ],
      ),
    );
  }
}

/// Panel tinta pembuka: logo piksel yang tersusun + tagline.
class _Hero extends StatelessWidget {
  const _Hero();
  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final hour = DateTime.now().toUtc().add(const Duration(hours: 7)).hour;
    final greet = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 18 ? 'Selamat sore' : 'Selamat malam';
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 0),
      child: Container(
        padding: const EdgeInsets.fromLTRB(22, 22, 22, 24),
        decoration: BoxDecoration(color: c.nav, borderRadius: BorderRadius.circular(30)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const PixelLogo(size: 30, assemble: true),
            const SizedBox(width: 12),
            Expanded(child: Text('$greet · Fan Signal'.toUpperCase(), style: AppText.micro(color: Colors.white54))),
            const SignalBars(height: 13),
          ]),
          const SizedBox(height: 22),
          Text('YOUR OSHI.', style: AppText.display(46, color: Colors.white)),
          Text('YOUR FRONT ROW', style: AppText.display(46, color: c.brand)),
          Text('FEELING.', style: AppText.display(46, color: Colors.white)),
          const SizedBox(height: 12),
          Text('Live, jadwal theater, recap, dan member — semua dalam genggaman.', style: AppText.body(14, color: Colors.white60)),
        ]
            .animate(interval: 70.ms)
            .fadeIn(duration: 500.ms)
            .slideY(begin: 0.25, end: 0, curve: Curves.easeOutCubic)),
      ),
    );
  }
}

class _EmptyLive extends StatelessWidget {
  const _EmptyLive();
  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(color: c.card, borderRadius: BorderRadius.circular(24), border: Border.all(color: c.line)),
        child: Row(children: [
          SignalBars(active: false, height: 18, color: c.inkSoft),
          const SizedBox(width: 14),
          Expanded(child: Text('Belum ada member yang live. Cek lagi sebentar ya!', style: AppText.body(14, color: c.inkSoft))),
        ]),
      ),
    );
  }
}

class _NextShow extends StatelessWidget {
  const _NextShow(this.show, {this.onTap});
  final TheaterShow show;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(color: c.brand, borderRadius: BorderRadius.circular(26)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Text('SHOW BERIKUTNYA', style: AppText.micro(color: Colors.white70)),
            const Spacer(),
            const Icon(Icons.north_east_rounded, color: Colors.white, size: 18),
          ]),
          const SizedBox(height: 10),
          Text(show.title.toUpperCase(), style: AppText.display(30, color: Colors.white)),
          const SizedBox(height: 10),
          Row(children: [
            const Icon(Icons.timer_outlined, color: Colors.white, size: 16),
            const SizedBox(width: 6),
            Countdown(show.date, style: AppText.mono(15, color: Colors.white, weight: FontWeight.w600)),
          ]),
          if (show.members.isNotEmpty) ...[const SizedBox(height: 14), AvatarStack(show.members.map((m) => m.img).toList(), size: 30, max: 8)],
        ]),
      ),
    ).animate().fadeIn(duration: 450.ms).scaleXY(begin: 0.96, end: 1, curve: Curves.easeOutBack);
  }
}
