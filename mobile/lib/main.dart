import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:liquid_glass_easy/liquid_glass_easy.dart';

import 'core/theme.dart';
import 'screens/shell.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('id_ID');
  // Kompilasi shader kaca di awal supaya kaca pertama langsung tampil sempurna.
  await LiquidGlassShaders.ensureLoaded();
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  runApp(const JktApp());
}

class JktApp extends StatelessWidget {
  const JktApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'JKT48Connect',
        debugShowCheckedModeBanner: false,
        theme: buildTheme(Brightness.light),
        darkTheme: buildTheme(Brightness.dark),
        home: const Shell(),
      );
}
