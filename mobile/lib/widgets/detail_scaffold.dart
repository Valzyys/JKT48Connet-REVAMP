import 'package:flutter/material.dart';
import 'package:liquid_glass_easy/liquid_glass_easy.dart';

import '../core/theme.dart';
import 'glass.dart';

/// Halaman detail: latar ambient, isi bergulir di bawah kepala kaca dengan tombol kembali yang bercahaya saat disentuh.
class DetailScaffold extends StatelessWidget {
  const DetailScaffold({super.key, required this.title, required this.body, this.actions = const []});
  final String title;
  final Widget body;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final w = MediaQuery.sizeOf(context).width;
    return LiquidGlassScaffold(
      backgroundColor: c.bg,
      appBar: LiquidGlassAppBar(
        width: (w - 28).clamp(260.0, 520.0),
        height: 54,
        centerTitle: true,
        style: glass(context, 27),
        foregroundColor: c.ink,
        leading: Padding(
          padding: const EdgeInsets.only(left: 6),
          child: GlassIconButton(tooltip: 'Kembali', icon: const Icon(Icons.arrow_back_rounded), onTap: () => Navigator.of(context).maybePop()),
        ),
        title: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppText.body(16, color: c.ink, weight: 800)),
        actions: [...actions, const SizedBox(width: 6)],
      ),
      body: Stack(children: [const Positioned.fill(child: Ambient()), body]),
    );
  }
}
