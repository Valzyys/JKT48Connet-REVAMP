import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/format.dart';
import '../core/models.dart';
import '../core/theme.dart';
import 'common.dart';
import 'glass.dart';

Future<void> openUrl(String url) async {
  if (url.isEmpty) return;
  await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
}

/// Kartu besar member yang sedang live: foto penuh, pil kaca merah "LIVE" yang membiaskan foto di belakangnya.
class LiveCard extends StatelessWidget {
  const LiveCard(this.live, {super.key, this.height = 260});
  final LiveSession live;
  final double height;

  @override
  Widget build(BuildContext context) {
    final img = live.banner.isNotEmpty ? live.banner : (live.img.isNotEmpty ? live.img : live.avatar);
    return GestureDetector(
      onTap: () => openUrl(live.link),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(28),
        child: SizedBox(
          height: height,
          child: Stack(fit: StackFit.expand, children: [
            NetImage(img, fallback: live.name, alignment: live.banner.isNotEmpty ? Alignment.center : Alignment.topCenter),
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0x00000000), Color(0xCC000000)], stops: [0.45, 1]),
              ),
            ),
            Positioned(
              left: 14,
              top: 14,
              child: GlassChip(
                style: glassRed(16),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  const SignalBars(color: Colors.white, height: 11),
                  const SizedBox(width: 7),
                  Text('LIVE · ${live.platformLabel.toUpperCase()}', style: AppText.micro(color: Colors.white)),
                ]),
              ),
            ),
            Positioned(
              left: 18,
              right: 18,
              bottom: 16,
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(live.name.toUpperCase(), style: AppText.display(32, color: Colors.white)),
                const SizedBox(height: 4),
                Text(
                  [if (live.title.isNotEmpty) live.title, timeAgo(live.startedAt)].join(' · '),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(13, color: Colors.white70),
                ),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}

Pill categoryPill(BuildContext context, String category) {
  final c = AppColors.of(context);
  return switch (category) {
    'exclusive' => Pill('Exclusive', bg: c.blush, fg: c.brand),
    'general' => Pill('Event', bg: c.surface, fg: c.inkSoft),
    _ => Pill('Show', bg: c.butter, fg: const Color(0xFF7A4B00)),
  };
}

/// Kartu jadwal: tanggal besar di kiri, judul, jam, dan deret avatar member.
class ShowTile extends StatelessWidget {
  const ShowTile(this.show, {super.key, this.onTap});
  final TheaterShow show;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final t = parseTime(show.date);
    return Material(
      color: c.card,
      borderRadius: BorderRadius.circular(22),
      child: InkWell(
        borderRadius: BorderRadius.circular(22),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(children: [
            Container(
              width: 58,
              padding: const EdgeInsets.symmetric(vertical: 8),
              decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(16)),
              child: Column(children: [
                Text(t == null ? '–' : '${t.day}', style: AppText.display(28, color: c.ink)),
                Text(fmtDate(show.date, pattern: 'MMM'), style: AppText.micro(color: c.inkSoft)),
              ]),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [categoryPill(context, show.category), const SizedBox(width: 8), Text(fmtTime(show.date), style: AppText.mono(11, color: c.inkSoft))]),
                const SizedBox(height: 6),
                Text(show.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: AppText.body(15, color: c.ink, weight: 750)),
                if (show.members.isNotEmpty) ...[const SizedBox(height: 8), AvatarStack(show.members.map((m) => m.img).toList())],
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}

/// Deret foto bulat yang saling menumpuk.
class AvatarStack extends StatelessWidget {
  const AvatarStack(this.images, {super.key, this.size = 26, this.max = 6});
  final List<String> images;
  final double size;
  final int max;
  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final shown = images.take(max).toList();
    final extra = images.length - shown.length;
    return SizedBox(
      height: size,
      child: Stack(children: [
        for (final (i, url) in shown.indexed)
          Positioned(
            left: i * size * 0.68,
            child: Container(
              width: size,
              height: size,
              decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: c.card, width: 2)),
              child: ClipOval(child: NetImage(url)),
            ),
          ),
        if (extra > 0)
          Positioned(
            left: shown.length * size * 0.68 + 4,
            top: size * 0.22,
            child: Text('+$extra', style: AppText.mono(11, color: c.inkSoft, weight: FontWeight.w600)),
          ),
      ]),
    );
  }
}

/// Baris rekap live: foto, nama, platform, durasi, penonton.
class RecentTile extends StatelessWidget {
  const RecentTile(this.r, {super.key, this.onTap});
  final RecentLive r;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return Material(
      color: c.card,
      borderRadius: BorderRadius.circular(22),
      child: InkWell(
        borderRadius: BorderRadius.circular(22),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Row(children: [
            ClipRRect(borderRadius: BorderRadius.circular(16), child: SizedBox(width: 62, height: 74, child: NetImage(r.img, fallback: r.name))),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Micro(r.platformLabel, color: r.platform == 'idn' ? c.brand : c.inkSoft),
                const SizedBox(height: 4),
                Text(r.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppText.body(16, color: c.ink, weight: 800)),
                const SizedBox(height: 2),
                Text('${fmtDate(r.start, pattern: 'd MMM')} · ${fmtTime(r.start)}', style: AppText.mono(11, color: c.inkSoft)),
              ]),
            ),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text(fmtDuration(r.durationMs), style: AppText.display(22, color: c.ink)),
              const SizedBox(height: 4),
              Row(mainAxisSize: MainAxisSize.min, children: [
                Icon(Icons.visibility_rounded, size: 13, color: c.inkSoft),
                const SizedBox(width: 3),
                Text(fmtCompact(r.viewers), style: AppText.mono(11, color: c.inkSoft)),
              ]),
            ]),
            const SizedBox(width: 6),
          ]),
        ),
      ),
    );
  }
}

/// Baris berita: kategori, judul, tanggal.
class NewsTile extends StatelessWidget {
  const NewsTile(this.n, {super.key, this.onTap, this.index});
  final NewsItem n;
  final VoidCallback? onTap;
  final int? index;
  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (index != null) ...[
            SizedBox(width: 30, child: Text((index! + 1).toString().padLeft(2, '0'), style: AppText.mono(12, color: c.brand, weight: FontWeight.w600))),
          ],
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Micro(n.category, color: c.inkSoft),
              const SizedBox(height: 4),
              Text(n.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: AppText.body(15, color: c.ink, weight: 700)),
              const SizedBox(height: 4),
              Text(fmtDate(n.date, pattern: 'd MMMM yyyy'), style: AppText.mono(11, color: c.inkSoft)),
            ]),
          ),
          Icon(Icons.north_east_rounded, size: 16, color: c.inkSoft),
        ]),
      ),
    );
  }
}
