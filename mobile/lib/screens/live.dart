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
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 18),
                child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Micro('IDN Live · Showroom', color: c.brand, dot: true),
                      const SizedBox(height: 6),
                      Text('LIVE SEKARANG', style: AppText.display(40, color: c.ink)),
                    ]),
                  ),
                  Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                    CountUp(list.length, style: AppText.display(48, color: list.isEmpty ? c.inkSoft : c.brand)),
                    Text('MEMBER', style: AppText.micro(color: c.inkSoft)),
                  ]),
                ]),
              ),
              if (s.hasError)
                ErrorRetry(error: s.error!, onRetry: _reload)
              else if (!s.hasData)
                for (var i = 0; i < 2; i++) const Padding(padding: EdgeInsets.fromLTRB(20, 0, 20, 14), child: Skeleton(height: 300, radius: 28))
              else if (list.isEmpty)
                Padding(
                  padding: const EdgeInsets.all(32),
                  child: Column(children: [
                    SignalBars(active: false, height: 32, color: c.inkSoft),
                    const SizedBox(height: 14),
                    Text('Belum ada yang live', style: AppText.display(26, color: c.ink)),
                    const SizedBox(height: 6),
                    Text('Halaman ini memperbarui sendiri setiap 30 detik.', textAlign: TextAlign.center, style: AppText.body(14, color: c.inkSoft)),
                  ]),
                )
              else
                for (final (i, l) in list.indexed) Padding(padding: const EdgeInsets.fromLTRB(16, 0, 16, 14), child: LiveCard(l, height: 300).staggerIn(i)),
            ],
          );
        },
      ),
    );
  }
}
