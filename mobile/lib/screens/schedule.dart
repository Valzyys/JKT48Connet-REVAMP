import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/models.dart';
import '../core/theme.dart';
import '../widgets/cards.dart';
import '../widgets/common.dart';
import '../widgets/detail_scaffold.dart';
import '../widgets/glass.dart';
import 'members.dart';
import 'shell.dart';

/// Jadwal mendatang (show, event, exclusive) dan arsip pertunjukan theater, dipilih lewat segmented kaca.
class ScheduleScreen extends StatefulWidget {
  const ScheduleScreen({super.key});
  @override
  State<ScheduleScreen> createState() => _ScheduleScreenState();
}

class _ScheduleScreenState extends State<ScheduleScreen> {
  int _seg = 0;
  late Future<List<TheaterShow>> _next = Api.instance.nextSchedule();
  final List<TheaterShow> _theater = [];
  int _page = 0;
  bool _more = true, _loading = false;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _loadTheater();
  }

  Future<void> _loadTheater({bool reset = false}) async {
    if (_loading || (!_more && !reset)) return;
    setState(() => _loading = true);
    try {
      final p = await Api.instance.theater(reset ? 1 : _page + 1, force: reset);
      setState(() {
        if (reset) _theater.clear();
        _theater.addAll(p.items);
        _page = p.page;
        _more = p.hasMore;
        _error = null;
      });
    } catch (e) {
      setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _open(TheaterShow s) => Navigator.of(context).push(MaterialPageRoute(builder: (_) => TheaterDetailScreen(s.id, title: s.title)));

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final w = MediaQuery.sizeOf(context).width;
    return NotificationListener<ScrollNotification>(
      onNotification: (n) {
        if (_seg == 1 && n.metrics.pixels > n.metrics.maxScrollExtent - 500) _loadTheater();
        return false;
      },
      child: RefreshIndicator(
        color: c.brand,
        edgeOffset: kTopInset,
        onRefresh: () async {
          setState(() => _next = Api.instance.nextSchedule(force: true));
          await _loadTheater(reset: true);
        },
        child: ListView(
          padding: const EdgeInsets.only(top: kTopInset, bottom: kBottomInset),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 14),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Micro('Theater & event', color: c.brand, dot: true),
                const SizedBox(height: 6),
                Text('JADWAL', style: AppText.display(40, color: c.ink)),
              ]),
            ),
            Center(
              child: GlassSegmented(segments: const ['Mendatang', 'Theater'], selected: _seg, onChanged: (i) => setState(() => _seg = i), width: (w - 40).clamp(240.0, 420.0), height: 46),
            ),
            const SizedBox(height: 16),
            if (_seg == 0)
              FutureBuilder(
                future: _next,
                builder: (_, s) {
                  if (s.hasError) return ErrorRetry(error: s.error!, onRetry: () => setState(() => _next = Api.instance.nextSchedule(force: true)));
                  if (!s.hasData) {
                    return Column(children: [for (var i = 0; i < 4; i++) const Padding(padding: EdgeInsets.fromLTRB(20, 0, 20, 10), child: Skeleton(height: 96))]);
                  }
                  // Dikelompokkan per tanggal.
                  final groups = <String, List<TheaterShow>>{};
                  for (final x in s.data!) {
                    groups.putIfAbsent(fmtDate(x.date, pattern: 'EEEE, d MMMM'), () => []).add(x);
                  }
                  var i = 0;
                  return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    for (final e in groups.entries) ...[
                      Padding(padding: const EdgeInsets.fromLTRB(22, 10, 22, 8), child: Micro(e.key)),
                      for (final show in e.value)
                        Padding(padding: const EdgeInsets.fromLTRB(16, 0, 16, 10), child: ShowTile(show, onTap: () => _open(show)).staggerIn(i++)),
                    ],
                  ]);
                },
              )
            else ...[
              for (final (i, show) in _theater.indexed)
                Padding(padding: const EdgeInsets.fromLTRB(16, 0, 16, 10), child: ShowTile(show, onTap: () => _open(show)).staggerIn(i % 12)),
              if (_error != null) ErrorRetry(error: _error!, onRetry: _loadTheater),
              if (_loading) const Padding(padding: EdgeInsets.all(20), child: Center(child: CircularProgressIndicator())),
            ],
          ],
        ),
      ),
    );
  }
}

/// Detail pertunjukan: poster/banner, waktu, setlist, dan member yang tampil.
class TheaterDetailScreen extends StatelessWidget {
  const TheaterDetailScreen(this.id, {super.key, this.title = 'Theater'});
  final String id, title;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return DetailScaffold(
      title: title,
      body: FutureBuilder(
        future: Api.instance.theaterDetail(id),
        builder: (_, s) {
          if (s.hasError) return Center(child: ErrorRetry(error: s.error!, onRetry: () => (context as Element).markNeedsBuild()));
          if (!s.hasData) return const Center(child: CircularProgressIndicator());
          final t = s.data!;
          final img = t.banner.isNotEmpty ? t.banner : t.poster;
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, kTopInset, 16, 40),
            children: [
              if (img.isNotEmpty)
                ClipRRect(borderRadius: BorderRadius.circular(26), child: AspectRatio(aspectRatio: 16 / 9, child: NetImage(img, alignment: Alignment.center))).staggerIn(0),
              const SizedBox(height: 18),
              Row(children: [categoryPill(context, t.category), const SizedBox(width: 8), if (t.team.isNotEmpty) Micro(t.team)]).staggerIn(1),
              const SizedBox(height: 10),
              Text(t.title.toUpperCase(), style: AppText.display(36, color: c.ink)).staggerIn(2),
              const SizedBox(height: 8),
              Text('${fmtDate(t.date)} · ${fmtTime(t.date)}', style: AppText.mono(13, color: c.inkSoft)).staggerIn(3),
              if (DateTime.tryParse(t.date)?.isAfter(DateTime.now()) ?? false) ...[
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(color: c.brand, borderRadius: BorderRadius.circular(20)),
                  child: Row(children: [
                    const Icon(Icons.timer_outlined, color: Colors.white),
                    const SizedBox(width: 10),
                    Text('Mulai dalam ', style: AppText.body(14, color: Colors.white70)),
                    Countdown(t.date, style: AppText.mono(15, color: Colors.white, weight: FontWeight.w600)),
                  ]),
                ).staggerIn(4),
              ],
              if (t.members.isNotEmpty) ...[
                const SizedBox(height: 26),
                Micro('Member tampil · ${t.members.length}', color: c.brand, dot: true),
                const SizedBox(height: 12),
                GridView.count(
                  crossAxisCount: 4,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 10,
                  childAspectRatio: 0.72,
                  children: [
                    for (final (i, m) in t.members.indexed)
                      GestureDetector(
                        onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => MemberDetailScreen(m.id, name: m.name, img: m.img))),
                        child: Column(children: [
                          Expanded(child: ClipRRect(borderRadius: BorderRadius.circular(16), child: NetImage(m.img, fallback: m.name))),
                          const SizedBox(height: 6),
                          Text(m.name.split(' ').first, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppText.body(12, color: c.ink, weight: 700)),
                        ]),
                      ).staggerIn(i, step: 25),
                  ],
                ),
              ],
              if (t.songs.isNotEmpty) ...[
                const SizedBox(height: 26),
                Micro('Setlist', color: c.brand, dot: true),
                const SizedBox(height: 8),
                for (final (i, song) in t.songs.indexed)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 7),
                    child: Row(children: [
                      SizedBox(width: 34, child: Text((i + 1).toString().padLeft(2, '0'), style: AppText.mono(12, color: c.brand, weight: FontWeight.w600))),
                      Expanded(child: Text(song, style: AppText.body(15, color: c.ink, weight: 600))),
                    ]),
                  ),
              ],
            ],
          );
        },
      ),
    );
  }
}
