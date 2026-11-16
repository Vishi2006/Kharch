import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'providers/app_state.dart';
import 'screens/dashboard_screen.dart';
import 'screens/login_screen.dart';
import 'theme/arcade_theme.dart';
import 'widgets/cute_coin_loader.dart';
import 'widgets/kharch_logo.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Neo-Brutalist Light canvas navigation bar & status bar styling
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      systemNavigationBarColor: ArcadeTheme.lightCanvas,
      systemNavigationBarIconBrightness: Brightness.dark,
    ),
  );

  final appState = AppState();
  runApp(KharchApp(appState: appState));
}

class KharchApp extends StatefulWidget {
  final AppState appState;

  const KharchApp({super.key, required this.appState});

  @override
  State<KharchApp> createState() => _KharchAppState();
}

class _KharchAppState extends State<KharchApp> {
  @override
  void initState() {
    super.initState();
    widget.appState.init();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Kharch',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: ArcadeTheme.darkCanvas,
        colorScheme: const ColorScheme.dark(
          primary: ArcadeTheme.acidYellow,
          secondary: ArcadeTheme.arcadeViolet,
          surface: ArcadeTheme.darkCard,
        ),
      ),
      home: ListenableBuilder(
        listenable: widget.appState,
        builder: (context, _) {
          if (!widget.appState.isInitialized) {
            return const Scaffold(
              backgroundColor: ArcadeTheme.darkCanvas,
              body: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    KharchLogo(size: 72),
                    SizedBox(height: 24),
                    CuteCoinLoader(
                      message: 'Compiling your transactions...',
                      coinSize: 28,
                    ),
                  ],
                ),
              ),
            );
          }

          if (widget.appState.isAuthenticated) {
            return DashboardScreen(appState: widget.appState);
          } else {
            return LoginScreen(appState: widget.appState);
          }
        },
      ),
    );
  }
}
