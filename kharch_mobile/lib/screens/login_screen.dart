import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../providers/app_state.dart';
import '../theme/arcade_theme.dart';
import '../widgets/arcade_button.dart';
import '../widgets/arcade_card.dart';
import '../widgets/google_logo.dart';
import '../widgets/kharch_logo.dart';

class LoginScreen extends StatefulWidget {
  final AppState appState;

  const LoginScreen({super.key, required this.appState});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  double _dragPosition = 0;
  bool _isUnlocked = false;
  bool _isLoading = false;
  String _errorMessage = '';
  bool _isApi10 = false;

  final double _sliderWidth = 280;
  final double _handleWidth = 56;

  void _handleGoogleLogin() async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
      _isApi10 = false;
    });

    final result = await widget.appState.signInWithGoogle();

    if (!mounted) return;

    if (result['success'] == true) {
      // Login successful, AppState automatically updates view
    } else {
      setState(() {
        _isLoading = false;
        _errorMessage = result['error'] ?? 'Sign-in failed. Please try again.';
        _isApi10 = result['isApi10'] == true;
        _isUnlocked = false;
        _dragPosition = 0;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ArcadeTheme.darkCanvas,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Punch Pink Neo-Brutal Tag
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(
                    color: ArcadeTheme.punchPink,
                    borderRadius: BorderRadius.circular(ArcadeTheme.pillRadius),
                    border: Border.all(color: ArcadeTheme.pureBlack, width: 2),
                    boxShadow: ArcadeTheme.neoShadow(offset: const Offset(2.5, 2.5)),
                  ),
                  child: const Text(
                    '✦ SMART EXPENSE VAULT ✦',
                    style: TextStyle(
                      color: ArcadeTheme.pureWhite,
                      fontWeight: FontWeight.w900,
                      fontSize: 10,
                      letterSpacing: 1.0,
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Clean App Logo
                const KharchLogo(size: 88),
                const SizedBox(height: 16),

                // App Title & Tagline
                const Text(
                  'Kharch',
                  style: TextStyle(
                    color: ArcadeTheme.pureBlack,
                    fontSize: 34,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                  decoration: BoxDecoration(
                    color: ArcadeTheme.punchPink,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: ArcadeTheme.pureBlack, width: 1.5),
                  ),
                  child: const Text(
                    'Where did your money go?',
                    style: TextStyle(
                      color: ArcadeTheme.pureWhite,
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Personal finance, cashflow & smart auto-capture',
                  style: TextStyle(
                    color: ArcadeTheme.slateDark,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 32),

                // Clean Login Card in Neo-Brutal styling
                ArcadeCard(
                  fillColor: ArcadeTheme.darkCard,
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    children: [
                      const Text(
                        'SIGN IN TO CONTINUE',
                        style: TextStyle(
                          color: ArcadeTheme.pureWhite,
                          fontWeight: FontWeight.w900,
                          fontSize: 14,
                          letterSpacing: 0.8,
                        ),
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'Slide the Google key to unlock',
                        style: TextStyle(
                          color: ArcadeTheme.slateMuted,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Slide-to-Unlock Slider with Punch Pink Touch & Authentic Google Logo
                      if (!_isUnlocked)
                        Container(
                          width: _sliderWidth,
                          height: 58,
                          decoration: BoxDecoration(
                            color: ArcadeTheme.darkCardLight,
                            borderRadius: BorderRadius.circular(100),
                            border: Border.all(color: ArcadeTheme.punchPink, width: 2.5),
                            boxShadow: ArcadeTheme.neoShadow(offset: const Offset(3, 3)),
                          ),
                          child: Stack(
                            children: [
                              const Center(
                                child: Text(
                                  'SLIDE TO SIGN IN',
                                  style: TextStyle(
                                    color: ArcadeTheme.slateMuted,
                                    fontWeight: FontWeight.w900,
                                    fontSize: 12,
                                    letterSpacing: 1.2,
                                  ),
                                ),
                              ),
                              Positioned(
                                left: _dragPosition,
                                top: 2,
                                bottom: 2,
                                child: GestureDetector(
                                  onHorizontalDragUpdate: (details) {
                                    setState(() {
                                      _dragPosition = (_dragPosition + details.delta.dx)
                                          .clamp(0.0, _sliderWidth - _handleWidth - 4);
                                    });
                                  },
                                  onHorizontalDragEnd: (details) {
                                    if (_dragPosition >= (_sliderWidth - _handleWidth - 20)) {
                                      setState(() {
                                        _isUnlocked = true;
                                        _dragPosition = _sliderWidth - _handleWidth - 4;
                                      });
                                    } else {
                                      setState(() {
                                        _dragPosition = 0;
                                      });
                                    }
                                  },
                                  child: Container(
                                    width: _handleWidth,
                                    decoration: BoxDecoration(
                                      color: ArcadeTheme.pureWhite,
                                      shape: BoxShape.circle,
                                      border: Border.all(color: ArcadeTheme.pureBlack, width: 2.5),
                                      boxShadow: ArcadeTheme.neoShadow(offset: const Offset(2, 2)),
                                    ),
                                    child: const Center(
                                      child: GoogleLogo(size: 26),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),

                      // Sign In Action (Rendered when unlocked)
                      if (_isUnlocked) ...[
                        ArcadeButton(
                          text: 'SIGN IN WITH GOOGLE',
                          icon: Icons.g_mobiledata_rounded,
                          backgroundColor: ArcadeTheme.acidYellow,
                          textColor: ArcadeTheme.pureBlack,
                          isLoading: _isLoading,
                          loadingText: 'Signing in...',
                          onTap: _handleGoogleLogin,
                          width: double.infinity,
                        ),
                      ],

                      if (_errorMessage.isNotEmpty) ...[
                        const SizedBox(height: 14),
                        Text(
                          _errorMessage,
                          style: const TextStyle(
                            color: ArcadeTheme.punchPink,
                            fontWeight: FontWeight.w700,
                            fontSize: 12,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],

                      if (_isApi10) ...[
                        const SizedBox(height: 14),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: ArcadeTheme.darkCardLight,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: ArcadeTheme.acidYellow, width: 2),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Row(
                                children: [
                                  Icon(Icons.vpn_key_rounded, size: 16, color: ArcadeTheme.acidYellow),
                                  SizedBox(width: 6),
                                  Text(
                                    'GOOGLE CLOUD SHA-1 NEEDED',
                                    style: TextStyle(
                                      color: ArcadeTheme.acidYellow,
                                      fontWeight: FontWeight.w900,
                                      fontSize: 11,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              const Text(
                                'Add this SHA-1 fingerprint to your Android OAuth Client in Google Cloud Console (Package: com.kharch.kharch_mobile):',
                                style: TextStyle(color: ArcadeTheme.pureWhite, fontSize: 11),
                              ),
                              const SizedBox(height: 8),
                              const SelectableText(
                                'B7:AE:28:C0:AB:01:86:31:5B:F6:C9:41:BB:76:C4:93:0D:75:2C:14',
                                style: TextStyle(
                                  color: ArcadeTheme.neonCyan,
                                  fontWeight: FontWeight.w800,
                                  fontSize: 10,
                                  fontFamily: 'monospace',
                                ),
                              ),
                              const SizedBox(height: 10),
                              ArcadeButton(
                                text: 'COPY SHA-1 FINGERPRINT',
                                icon: Icons.copy_rounded,
                                height: 36,
                                backgroundColor: ArcadeTheme.acidYellow,
                                textColor: ArcadeTheme.pureBlack,
                                onTap: () {
                                  Clipboard.setData(const ClipboardData(
                                    text: 'B7:AE:28:C0:AB:01:86:31:5B:F6:C9:41:BB:76:C4:93:0D:75:2C:14',
                                  ));
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text('SHA-1 copied to clipboard!'),
                                      backgroundColor: ArcadeTheme.arcadeGreen,
                                    ),
                                  );
                                },
                                width: double.infinity,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),

                const SizedBox(height: 28),
                const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.lock_outline_rounded, color: ArcadeTheme.arcadeGreen, size: 16),
                    SizedBox(width: 6),
                    Text(
                      'Private & Secure On-Device Auto-Sync',
                      style: TextStyle(
                        color: ArcadeTheme.slateMuted,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
