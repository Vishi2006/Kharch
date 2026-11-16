import 'package:flutter/material.dart';
import '../providers/app_state.dart';
import '../theme/arcade_theme.dart';
import '../widgets/arcade_button.dart';
import '../widgets/arcade_card.dart';

class SettingsScreen extends StatefulWidget {
  final AppState appState;

  const SettingsScreen({super.key, required this.appState});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _isLoggingOut = false;

  @override
  void initState() {
    super.initState();
    widget.appState.checkNativePermissions();
  }

  void _handleLogout() async {
    setState(() => _isLoggingOut = true);
    await widget.appState.logout();
    if (mounted) {
      setState(() => _isLoggingOut = false);
      Navigator.popUntil(context, (route) => route.isFirst);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = widget.appState.user;
    final isNotifGranted = widget.appState.isNotificationListenerGranted;
    final isBatteryIgnored = widget.appState.isBatteryOptimizationIgnored;

    return Scaffold(
      backgroundColor: ArcadeTheme.darkCanvas,
      appBar: AppBar(
        backgroundColor: ArcadeTheme.darkCanvas,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: ArcadeTheme.pureBlack),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'SETTINGS',
          style: TextStyle(
            color: ArcadeTheme.pureBlack,
            fontWeight: FontWeight.w900,
            fontSize: 18,
            letterSpacing: 0.8,
          ),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // PERMISSIONS & AUTO-TRACKING
              const Text(
                'PERMISSIONS & AUTO-TRACKING',
                style: TextStyle(
                  color: ArcadeTheme.pureBlack,
                  fontWeight: FontWeight.w900,
                  fontSize: 13,
                  letterSpacing: 0.8,
                ),
              ),
              const SizedBox(height: 10),

              // Notification Access Card
              ArcadeCard(
                fillColor: ArcadeTheme.darkCard,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'NOTIFICATION LISTENER',
                          style: TextStyle(
                            color: ArcadeTheme.pureWhite,
                            fontWeight: FontWeight.w900,
                            fontSize: 14,
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: isNotifGranted
                                ? ArcadeTheme.arcadeGreen
                                : ArcadeTheme.punchPink,
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: ArcadeTheme.pureBlack, width: 1.5),
                          ),
                          child: Text(
                            isNotifGranted ? 'ACTIVE' : 'PERMISSION NEEDED',
                            style: TextStyle(
                              color: isNotifGranted
                                  ? ArcadeTheme.pureBlack
                                  : ArcadeTheme.pureWhite,
                              fontWeight: FontWeight.w900,
                              fontSize: 10,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Captures PhonePe, Google Pay, Paytm, and bank SMS transactions instantly. Runs 0% idle CPU and zero battery drain.',
                      style: TextStyle(color: ArcadeTheme.slateMuted, fontSize: 12),
                    ),
                    const SizedBox(height: 12),
                    if (!isNotifGranted)
                      ArcadeButton(
                        text: 'GRANT ACCESS (ONCE ONLY)',
                        icon: Icons.security_rounded,
                        backgroundColor: ArcadeTheme.acidYellow,
                        textColor: ArcadeTheme.pureBlack,
                        onTap: () => widget.appState.openNotificationSettings(),
                        width: double.infinity,
                      )
                    else
                      Row(
                        children: const [
                          Icon(Icons.check_circle_rounded,
                              color: ArcadeTheme.arcadeGreen, size: 18),
                          SizedBox(width: 6),
                          Text(
                            'Granted & listening in background',
                            style: TextStyle(
                              color: ArcadeTheme.arcadeGreen,
                              fontWeight: FontWeight.w800,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 12),

              // Battery Optimization Exemption Card
              ArcadeCard(
                fillColor: ArcadeTheme.darkCard,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'BATTERY OPTIMIZATION',
                          style: TextStyle(
                            color: ArcadeTheme.pureWhite,
                            fontWeight: FontWeight.w900,
                            fontSize: 14,
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: isBatteryIgnored
                                ? ArcadeTheme.arcadeGreen
                                : ArcadeTheme.acidYellow,
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: ArcadeTheme.pureBlack, width: 1.5),
                          ),
                          child: Text(
                            isBatteryIgnored ? 'EXEMPTED' : 'RECOMMENDED',
                            style: const TextStyle(
                              color: ArcadeTheme.pureBlack,
                              fontWeight: FontWeight.w900,
                              fontSize: 10,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Prevents aggressive OEM task killers (Xiaomi, Samsung, OnePlus) from stopping the listener when app is closed.',
                      style: TextStyle(color: ArcadeTheme.slateMuted, fontSize: 12),
                    ),
                    const SizedBox(height: 12),
                    if (!isBatteryIgnored)
                      ArcadeButton(
                        text: 'EXEMPT FROM BATTERY KILLER',
                        icon: Icons.battery_charging_full_rounded,
                        backgroundColor: ArcadeTheme.darkCardLight,
                        textColor: ArcadeTheme.pureWhite,
                        onTap: () => widget.appState.requestBatteryOptimization(),
                        width: double.infinity,
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // USER ACCOUNT & LOGOUT
              if (user != null) ...[
                const Text(
                  'USER ACCOUNT',
                  style: TextStyle(
                    color: ArcadeTheme.pureBlack,
                    fontWeight: FontWeight.w900,
                    fontSize: 13,
                    letterSpacing: 0.8,
                  ),
                ),
                const SizedBox(height: 10),
                ArcadeCard(
                  fillColor: ArcadeTheme.darkCard,
                  child: Row(
                    children: [
                      Container(
                        width: 46,
                        height: 46,
                        decoration: BoxDecoration(
                          color: ArcadeTheme.acidYellow,
                          shape: BoxShape.circle,
                          border: Border.all(color: ArcadeTheme.pureBlack, width: 2),
                          boxShadow: ArcadeTheme.neoShadow(offset: const Offset(2, 2)),
                        ),
                        child: ClipOval(
                          child: user['picture'] != null && (user['picture'] as String).isNotEmpty
                              ? Image.network(
                                  user['picture'],
                                  width: 46,
                                  height: 46,
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, __, ___) => const Center(
                                    child: Icon(Icons.person_rounded, color: ArcadeTheme.pureBlack, size: 28),
                                  ),
                                  loadingBuilder: (context, child, loadingProgress) {
                                    if (loadingProgress == null) return child;
                                    return const Center(
                                      child: Icon(Icons.person_rounded, color: ArcadeTheme.pureBlack, size: 28),
                                    );
                                  },
                                )
                              : const Center(
                                  child: Icon(Icons.person_rounded, color: ArcadeTheme.pureBlack, size: 28),
                                ),
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              user['name'] ?? 'Kharch User',
                              style: const TextStyle(
                                color: ArcadeTheme.pureWhite,
                                fontWeight: FontWeight.w900,
                                fontSize: 15,
                              ),
                            ),
                            Text(
                              user['email'] ?? '',
                              style: const TextStyle(
                                color: ArcadeTheme.slateMuted,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                ArcadeButton(
                  text: 'LOG OUT',
                  icon: Icons.logout_rounded,
                  backgroundColor: ArcadeTheme.punchPink,
                  textColor: ArcadeTheme.pureWhite,
                  isLoading: _isLoggingOut,
                  loadingText: 'Logging out...',
                  onTap: _handleLogout,
                  width: double.infinity,
                ),
                const SizedBox(height: 32),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
