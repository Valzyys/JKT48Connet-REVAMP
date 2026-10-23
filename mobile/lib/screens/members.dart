import 'package:flutter/material.dart';
import 'package:liquid_glass_easy/liquid_glass_easy.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/models.dart';
import '../core/theme.dart';
import '../widgets/cards.dart';
import '../widgets/common.dart';
import '../widgets/detail_scaffold.dart';
import '../widgets/glass.dart';
import 'schedule.dart';
import 'shell.dart';

/// Grid member dengan pencarian dan pilihan aktif / lulus.
class MembersScreen extends StatefulWidget {
  const MembersScreen({super.key});
  @override
  State<MembersScreen> createState() => _MembersScreenState();
}

class _MembersScreenState extends State<MembersScreen> {
  late Future<List<Member>> _f = Api.instance.members();
  String _q = '';
  int _seg = 0;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final w = MediaQuery.sizeOf(context).width;
    return FutureBuilder(
      future: _f,
      builder: (_, s) {
        final all = s.data ?? const <Member>[];
        final list = all
            .where((m) => (_seg == 0) != m.isGraduate)
            .where((m) => _q.isEmpty || '${m.name} ${m.nickname}'.toLowerCase().contains(_q.toLowerCase()))
            .toList();
        return RefreshIndicator(
          color: c.brand,
          edgeOffset: kTopInset,
          onRefresh: () async {
            setState(() => _f = Api.instance.members(force: true));
            await _f.catchError((_) => <Member>[]);
          },
          child: CustomScrollView(slivers: [
            const SliverToBoxAdapter(child: SizedBox(height: kTopInset)),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 14),
                child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Micro('JKT48', color: c.brand, dot: true),
                      const SizedBox(height: 6),
                      Text('MEMBER', style: AppText.display(40, color: c.ink)),
                    ]),
                  ),
                  CountUp(list.length, style: AppText.display(40, color: c.brand)),
                ]),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: LiquidGlassLens(
                  style: glass(context, 22),
                  child: SizedBox(
                    height: 48,
                    child: Row(children: [
                      const SizedBox(width: 14),
                      Icon(Icons.search_rounded, color: c.inkSoft),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          onChanged: (v) => setState(() => _q = v),
                          style: AppText.body(15, color: c.ink),
                          decoration: InputDecoration(
                            border: InputBorder.none,
                            hintText: 'Cari oshi kamu…',
                            hintStyle: AppText.body(15, color: c.inkSoft),
                          ),
                        ),
                      ),
                    ]),
                  ),
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 14),
                child: Center(
                  child: GlassSegmented(segments: const ['Aktif', 'Lulus'], selected: _seg, onChanged: (i) => setState(() => _seg = i), width: (w - 40).clamp(240.0, 420.0), height: 44),
                ),
              ),
            ),
            if (s.hasError)
              SliverToBoxAdapter(child: ErrorRetry(error: s.error!, onRetry: () => setState(() => _f = Api.instance.members(force: true))))
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, kBottomInset),
                sliver: SliverGrid(
                  gridDelegate: SliverGridDelegateWithMaxCrossAxisExtent(maxCrossAxisExtent: 180, mainAxisSpacing: 12, crossAxisSpacing: 12, childAspectRatio: 0.7),
                  delegate: SliverChildBuilderDelegate(
                    (_, i) => s.hasData ? _MemberCard(list[i], index: i).staggerIn(i % 12, step: 35) : const Skeleton(radius: 22),
                    childCount: s.hasData ? list.length : 8,
                  ),
                ),
              ),
          ]),
        );
      },
    );
  }
}

class _MemberCard extends StatelessWidget {
  const _MemberCard(this.m, {required this.index});
  final Member m;
  final int index;
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => MemberDetailScreen(m.id, name: m.name, img: m.img))),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(22),
        child: Stack(fit: StackFit.expand, children: [
          Hero(tag: 'member-${m.id}', child: NetImage(m.img, fallback: m.name)),
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0x00000000), Color(0xB3000000)], stops: [0.55, 1]),
            ),
          ),
          Positioned(
            left: 10,
            top: 10,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(color: AppColors.of(context).brand, borderRadius: BorderRadius.circular(99)),
              child: Text((index + 1).toString().padLeft(2, '0'), style: AppText.mono(10, color: Colors.white, weight: FontWeight.w600)),
            ),
          ),
          Positioned(
            left: 12,
            right: 12,
            bottom: 12,
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(m.shortName.toUpperCase(), maxLines: 1, overflow: TextOverflow.ellipsis, style: AppText.display(22, color: Colors.white)),
              Text(m.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppText.body(11.5, color: Colors.white70)),
            ]),
          ),
        ]),
      ),
    );
  }
}

/// Profil member: foto besar di belakang panel info kaca, statistik live, sosial, dan jadwal mendatang.
class MemberDetailScreen extends StatelessWidget {
  const MemberDetailScreen(this.id, {super.key, this.name = '', this.img = ''});
  final String id, name, img;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final h = MediaQuery.sizeOf(context).height;
    return DetailScaffold(
      title: name.isEmpty ? 'Member' : name,
      body: FutureBuilder(
        future: Api.instance.member(id),
        builder: (_, s) {
          final m = s.data;
          return ListView(
            padding: EdgeInsets.zero,
            children: [
              SizedBox(
                height: h * 0.62,
                child: Stack(fit: StackFit.expand, children: [
                  Hero(tag: 'member-$id', child: NetImage(m?.img ?? img, fallback: name)),
                  DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [c.bg.withValues(alpha: 0), c.bg], stops: const [0.6, 1]),
                    ),
                  ),
                  // Panel info kaca di atas foto: lensa membiaskan foto di belakangnya.
                  Positioned(
                    left: 16,
                    right: 16,
                    bottom: 8,
                    child: LiquidGlassLens(
                      style: glass(context, 26),
                      touch: const LiquidGlassTouch(flex: LiquidGlassFlex()),
                      child: Padding(
                        padding: const EdgeInsets.all(18),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Micro(m == null ? 'JKT48' : (m.isGraduate ? 'Lulus' : 'Member aktif'), color: c.brand, dot: true),
                          const SizedBox(height: 6),
                          Text((m?.shortName ?? name).toUpperCase(), style: AppText.display(42, color: c.ink)),
                          Text(m?.fullname.isNotEmpty == true ? m!.fullname : (m?.name ?? name), style: AppText.body(14, color: c.inkSoft)),
                        ]),
                      ),
                    ).staggerIn(0),
                  ),
                ]),
              ),
              if (s.hasError) ErrorRetry(error: s.error!, onRetry: () => (context as Element).markNeedsBuild()),
              if (!s.hasData && !s.hasError) const Padding(padding: EdgeInsets.all(30), child: Center(child: CircularProgressIndicator())),
              if (m != null) ...[
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
                  child: Row(children: [
                    _Stat('Lahir', m.birthdate.isEmpty ? '–' : fmtDate(m.birthdate, pattern: 'd MMM yyyy')),
                    _Stat('Tinggi', m.height.isEmpty ? '–' : m.height),
                    _Stat('Gol. darah', m.bloodType.isEmpty ? '–' : m.bloodType),
                  ]).staggerIn(1),
                ),
                if (m.totalShowroom != null || m.totalIdn != null)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
                    child: Row(children: [
                      _BigStat('Live Showroom', m.totalShowroom),
                      const SizedBox(width: 10),
                      _BigStat('Live IDN', m.totalIdn),
                    ]).staggerIn(2),
                  ),
                if (m.jikosokai.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 22, 20, 0),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Micro('Jikoshoukai', color: c.brand, dot: true),
                      const SizedBox(height: 8),
                      Text('“${m.jikosokai}”', style: AppText.body(16, color: c.ink, weight: 600, height: 1.5)),
                    ]).staggerIn(3),
                  ),
                if (m.socials.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
                    child: Wrap(spacing: 8, runSpacing: 8, children: [
                      for (final so in m.socials)
                        GestureDetector(
                          onTap: () => openUrl(so.url),
                          child: GlassChip(
                            child: Row(mainAxisSize: MainAxisSize.min, children: [
                              Text(so.title, style: AppText.body(13, color: c.ink, weight: 700)),
                              const SizedBox(width: 4),
                              Icon(Icons.north_east_rounded, size: 14, color: c.ink),
                            ]),
                          ),
                        ),
                    ]).staggerIn(4),
                  ),
                if (m.upcomingShows.isNotEmpty) ...[
                  Padding(padding: const EdgeInsets.fromLTRB(20, 26, 20, 10), child: Micro('Jadwal theater', color: c.brand, dot: true)),
                  for (final (i, show) in m.upcomingShows.indexed)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                      child: ShowTile(show, onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => TheaterDetailScreen(show.id, title: show.title)))).staggerIn(i),
                    ),
                ],
                const SizedBox(height: 40),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat(this.label, this.value);
  final String label, value;
  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Expanded(
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 4),
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 12),
        decoration: BoxDecoration(color: c.card, borderRadius: BorderRadius.circular(18)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label.toUpperCase(), style: AppText.micro(color: c.inkSoft, size: 9)),
          const SizedBox(height: 4),
          Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppText.body(14, color: c.ink, weight: 800)),
        ]),
      ),
    );
  }
}

class _BigStat extends StatelessWidget {
  const _BigStat(this.label, this.value);
  final String label;
  final int? value;
  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: c.nav, borderRadius: BorderRadius.circular(20)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label.toUpperCase(), style: AppText.micro(color: Colors.white54, size: 9.5)),
          const SizedBox(height: 6),
          CountUp(value, style: AppText.display(34, color: Colors.white)),
        ]),
      ),
    );
  }
}
