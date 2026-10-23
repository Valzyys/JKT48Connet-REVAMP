import 'dart:async';

import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/models.dart';
import '../core/theme.dart';
import '../widgets/cards.dart';
import '../widgets/common.dart';
import 'shell.dart';

/// Semua member yang sedang live; diperbarui otomatis tiap 30 detik.
class LiveScreen extends StatefulWidget {
  const LiveScreen({super.key});
  @override
  State<LiveScreen> createState() => _LiveScreenState();
}

class _LiveScreenState extends State<LiveScreen> {
  late Future<List<LiveSession>> _f = Api.instance.live();
  late final Timer _poll = Timer.periodic(const Duration(seconds: 30), (_) => _reload());

  void _reload() {
    if (mounted) setState(() => _f = Api.instance.live(force: true));
  }

  @override
  void dispose() {
    _poll.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    return RefreshIndicator(
      color: c.brand,
      edgeOffset: kTopInset,
      onRefresh: () async {
        _reload();
        await _f.catchError((_) => <LiveSession>[]);
      },
      child: FutureBuilder(
        future: _f,
        builder: (_, s) {
          final list = s.data ?? const <LiveSession>[];
          return ListView(
            padding: const EdgeInsets.only(top: kTopInset, bottom: kBottomInset),
            children: [
              PageHeader(
                label: 'IDN Live · Showroom',
                title: 'Live sekarang',
                trailing: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  CountUp(list.length, style: AppText.display(48, color: list.isEmpty ? c.inkSoft : c.brand)),
                  Text('MEMBER', style: AppText.micro(color: c.inkSoft)),
                ]),
              ),
              if (s.hasError)
                ErrorRetry(error: s.error!, onRetry: _reload)
              else if (!s.hasData)
                for (var i = 0; i < 2; i++) const Padding(padding: EdgeInsets.fromLTRB(20, 0, 20, 14), child: Skeleton(height: 300, radius: 28))
              else if (list.isEmpty)
                Container(
                  margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 36),
                  decoration: c.cardDecoration(radius: 28),
                  child: Column(children: [
                    Container(
                      width: 76,
                      height: 76,
                      decoration: BoxDecoration(color: c.bg.withValues(alpha: c.dark ? 0.6 : 1), shape: BoxShape.circle),
                      alignment: Alignment.center,
                      child: SignalBars(active: false, height: 30, color: c.inkSoft),
                    ),
                    const SizedBox(height: 16),
                    Text('BELUM ADA YANG LIVE', style: AppText.display(28, color: c.ink)),
                    const SizedBox(height: 8),
                    Text('Halaman ini memperbarui sendiri setiap 30 detik.\nTarik ke bawah untuk cek sekarang.', textAlign: TextAlign.center, style: AppText.body(14, color: c.inkSoft)),
                  ]),
                ).staggerIn(0)
              else
                for (final (i, l) in list.indexed) Padding(padding: const EdgeInsets.fromLTRB(16, 0, 16, 14), child: LiveCard(l, height: 300).staggerIn(i)),
            ],
          );
        },
      ),
    );
  }
}
