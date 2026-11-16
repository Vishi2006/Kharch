import 'package:flutter/material.dart';
import '../providers/app_state.dart';
import '../theme/arcade_theme.dart';
import '../widgets/arcade_button.dart';
import '../widgets/arcade_card.dart';
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

  final double _sliderWidth = 280;
  final double _handleWidth = 56;

  void _handleGoogleLogin({String? mockEmail}) async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });

    final token = mockEmail != null
        ? 'mock_token_$mockEmail'
        : 'mock_token_arcade_hero@kharch.com';

    final success = await widget.appState.login(token);

    if (!mounted) return;

    if (!success) {
      setState(() {
        _isLoading = false;
        _errorMessage = 'Authentication failed. Please try again.';
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
                // Top Arcade Badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(
                    color: ArcadeTheme.punchPink,
                    borderRadius: BorderRadius.circular(ArcadeTheme.pillRadius),
                    border: Border.all(color: ArcadeTheme.pureBlack, width: 2),
                    boxShadow: ArcadeTheme.neoShadow(offset: const Offset(2, 2)),
                  ),
                  child: const Text(
                    '★ INSERT COIN TO TRACK ★',
                    style: TextStyle(
                      color: ArcadeTheme.pureWhite,
                      fontWeight: FontWeight.w900,
                      fontSize: 12,
                      letterSpacing: 1.0,
                    ),
                  ),
                ),
                const SizedBox(height: 24),

                // Large Animated Coin Logo
                const KharchLogo(size: 96),
                const SizedBox(height: 16),

                // App Title & Tagline
                const Text(
                  'KHARCH',
                  style: TextStyle(
                    color: ArcadeTheme.acidYellow,
                    fontSize: 40,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 2.0,
                  ),
                ),
                const Text(
                  'NEO-BRUTAL CASHFLOW VAULT',
                  style: TextStyle(
                    color: ArcadeTheme.slateMuted,
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.5,
                  ),
                ),
                const SizedBox(height: 36),

                // Arcade Cabinet Card
                ArcadeCard(
                  fillColor: ArcadeTheme.darkCard,
                  padding: const EdgeInsets.all(22),
                  child: Column(
                    children: [
                      const Text(
                        'PLAYER 1: SIGN IN',
                        style: TextStyle(
                          color: ArcadeTheme.neonCyan,
                          fontWeight: FontWeight.w900,
                          fontSize: 16,
                          letterSpacing: 0.8,
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Slide the arcade coin to unlock login',
                        style: TextStyle(
                          color: ArcadeTheme.pureWhite,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Slide-to-Unlock Slider
                      if (!_isUnlocked)
                        Container(
                          width: _sliderWidth,
                          height: 56,
                          decoration: BoxDecoration(
                            color: ArcadeTheme.darkCardLight,
                            borderRadius: BorderRadius.circular(100),
                            border: Border.all(color: ArcadeTheme.pureBlack, width: 2.5),
                          ),
                          child: Stack(
                            children: [
                              const Center(
                                child: Text(
                                  'SLIDE TO UNLOCK ▶▶',
                                  style: TextStyle(
                                    color: ArcadeTheme.slateMuted,
                                    fontWeight: FontWeight.w900,
                                    fontSize: 13,
                                    letterSpacing: 1.0,
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
                                      color: ArcadeTheme.acidYellow,
                                      shape: BoxShape.circle,
                                      border: Border.all(color: ArcadeTheme.pureBlack, width: 2.5),
                                      boxShadow: ArcadeTheme.neoShadow(offset: const Offset(2, 2)),
                                    ),
                                    child: const Center(
                                      child: Icon(
                                        Icons.arrow_forward_rounded,
                                        color: ArcadeTheme.pureBlack,
                                        size: 26,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),

                      // Sign In Actions (Rendered when unlocked)
                      if (_isUnlocked) ...[
                        ArcadeButton(
                          text: 'SIGN IN WITH GOOGLE',
                          icon: Icons.login_rounded,
                          backgroundColor: ArcadeTheme.acidYellow,
                          textColor: ArcadeTheme.pureBlack,
                          isLoading: _isLoading,
                          loadingText: 'Unlocking Vault...',
                          onTap: () => _handleGoogleLogin(),
                          width: double.infinity,
                        ),
                        const SizedBox(height: 12),
                        ArcadeButton(
                          text: 'QUICK DEMO ACCESS',
                          icon: Icons.flash_on_rounded,
                          backgroundColor: ArcadeTheme.arcadeGreen,
                          textColor: ArcadeTheme.pureBlack,
                          isLoading: _isLoading,
                          loadingText: 'Loading Demo...',
                          onTap: () => _handleGoogleLogin(mockEmail: 'arcade_demo@kharch.com'),
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
                        ),
                      ],
                    ],
                  ),
                ),

                const SizedBox(height: 28),
                const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.shield_rounded, color: ArcadeTheme.arcadeGreen, size: 16),
                    SizedBox(width: 6),
                    Text(
                      '100% On-Device Notification Parsing',
                      style: TextStyle(
                        color: ArcadeTheme.slateMuted,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
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
