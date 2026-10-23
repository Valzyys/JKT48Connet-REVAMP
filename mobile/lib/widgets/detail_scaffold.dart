import 'package:flutter/material.dart';
import 'package:liquid_glass_easy/liquid_glass_easy.dart';

import '../core/theme.dart';
import 'glass.dart';

/// Halaman detail: isi bergulir di bawah kepala kaca dengan tombol kembali.
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
        height: 52,
        centerTitle: true,
        style: glass(context, 26),
        foregroundColor: c.ink,
        fontSize: 16,
        leading: IconButton(
          tooltip: 'Kembali',
          onPressed: () => Navigator.of(context).maybePop(),
          icon: Icon(Icons.arrow_back_rounded, color: c.ink),
        ),
        title: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppText.body(16, color: c.ink, weight: 800)),
        actions: actions,
      ),
      body: body,
    );
  }
}
