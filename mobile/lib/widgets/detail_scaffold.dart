import 'package:flutter/material.dart';
import 'package:liquid_glass_easy/liquid_glass_easy.dart';

import '../core/theme.dart';
import 'glass.dart';

/// Halaman detail: latar ambient, isi bergulir di bawah kepala kaca bergaya iOS 26 —
/// tombol kembali bulat, kapsul judul, dan tombol aksi bulat sebagai lensa terpisah.
class DetailScaffold extends StatelessWidget {
  const DetailScaffold({super.key, required this.title, required this.body, this.actions = const []});
  final String title;
  final Widget body;

  /// Tiap aksi dibungkus lensa bulat sendiri (isi berupa [GlassIconButton]).
  final List<Widget> actions;

  static const double _h = 52;

  Widget _circle(BuildContext context, Widget child) => LiquidGlassLens(
        style: glass(context, _h / 2),
        touch: const LiquidGlassTouch(flex: LiquidGlassFlex()),
        child: SizedBox.square(dimension: _h, child: Center(child: child)),
      );

  @override
  Widget build(BuildContext context) {
    final c = AppColors.of(context);
    final w = MediaQuery.sizeOf(context).width;
    return LiquidGlassScaffold(
      backgroundColor: c.bg,
      appBarTopMargin: 4,
      appBar: SizedBox(
        width: (w - 28).clamp(260.0, 520.0),
        child: Row(children: [
          _circle(context, GlassIconButton(tooltip: 'Kembali', size: _h, icon: const Icon(Icons.arrow_back_rounded), onTap: () => Navigator.of(context).maybePop())),
          const SizedBox(width: 8),
          Expanded(
            child: LiquidGlassLens(
              style: glass(context, _h / 2),
              child: SizedBox(
                height: _h,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 18),
                  child: Center(
                    child: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppText.body(15.5, color: c.ink, weight: 800)),
                  ),
                ),
              ),
            ),
          ),
          for (final a in actions) ...[const SizedBox(width: 8), _circle(context, a)],
        ]),
      ),
      body: Stack(children: [const Positioned.fill(child: Ambient()), body]),
    );
  }
}
