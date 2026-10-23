import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/models.dart';
import '../core/theme.dart';
import '../widgets/common.dart';
import '../widgets/detail_scaffold.dart';
import 'members.dart';
import 'shell.dart';

int daysUntil(String birthdate) {
  final b = DateTime.tryParse(birthdate);
  if (b == null) return 999;
  final now = DateTime.now().toUtc().add(const Duration(hours: 7));
  final today = DateTime(now.year, now.month, now.day);
  var next = DateTime(now.year, b.month, b.day);
  if (next.isBefore(today)) next = DateTime(now.year + 1, b.month, b.day);
  return next.difference(today).inDays;
}

/// Foto bulat + nama + "Hari ini / N hari"; yang berulang tahun hari ini diberi cincin merah berdenyut.
class BirthdayBubble extends StatelessWidget {
  const BirthdayBubble(this.b, {super.key});
  final BirthdayEntry b;
  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final d = daysUntil(b.birthdate);
    Widget photo = Container(
      width: 74,
      height: 74,
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: d == 0 ? c.brand : c.line, width: 2.5)),
      child: ClipOval(child: NetImage(b.img, fallback: b.name)),
    );
    if (d == 0) photo = photo.animate(onPlay: (x) => x.repeat(reverse: true)).scaleXY(begin: 1, end: 1.06, duration: 900.ms);
    return GestureDetector(
      onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => MemberDetailScreen(b.id, name: b.name, img: b.img))),
      child: SizedBox(
        width: 82,
        child: Column(children: [
          photo,
          const SizedBox(height: 6),
          Text(b.name.split(' ').first, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppText.body(12.5, color: c.ink, weight: 700)),
          Text(d == 0 ? 'HARI INI' : '$d HARI', style: AppText.micro(color: d == 0 ? c.brand : c.inkSoft, size: 9.5)),
        ]),
      ),
    );
  }
}

class BirthdayScreen extends StatelessWidget {
  const BirthdayScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return DetailScaffold(
      title: 'Ulang tahun',
      body: FutureBuilder(
        future: Api.instance.birthdays(),
        builder: (_, s) {
          if (s.hasError) return Center(child: ErrorRetry(error: s.error!, onRetry: () => (context as Element).markNeedsBuild()));
          if (!s.hasData) return const Center(child: CircularProgressIndicator());
          final list = [...s.data!]..sort((a, b) => daysUntil(a.birthdate).compareTo(daysUntil(b.birthdate)));
          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, kTopInset, 16, 40),
            itemCount: list.length,
            separatorBuilder: (_, _) => const SizedBox(height: 10),
            itemBuilder: (_, i) {
              final b = list[i];
              final d = daysUntil(b.birthdate);
              final born = DateTime.tryParse(b.birthdate);
              // Usia yang akan dicapai pada ulang tahun berikutnya.
              final age = born == null ? null : DateTime.now().add(Duration(days: d)).year - born.year;
              return Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: d == 0 ? c.brand : c.card, borderRadius: BorderRadius.circular(22)),
                child: Row(children: [
                  ClipRRect(borderRadius: BorderRadius.circular(16), child: SizedBox(width: 56, height: 66, child: NetImage(b.img, fallback: b.name))),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(b.name, style: AppText.body(16, color: d == 0 ? Colors.white : c.ink, weight: 800)),
                      const SizedBox(height: 3),
                      Text(
                        '${fmtDate(b.birthdate, pattern: 'd MMMM')}${age != null ? ' · genap $age tahun' : ''}',
                        style: AppText.mono(11.5, color: d == 0 ? Colors.white70 : c.inkSoft),
                      ),
                    ]),
                  ),
                  Text(d == 0 ? '🎉' : '$d', style: AppText.display(30, color: d == 0 ? Colors.white : c.brand)),
                  if (d != 0) Padding(padding: const EdgeInsets.only(left: 4, top: 8), child: Text('HARI', style: AppText.micro(color: c.inkSoft, size: 9))),
                ]),
              ).staggerIn(i);
            },
          );
        },
      ),
    );
  }
}
