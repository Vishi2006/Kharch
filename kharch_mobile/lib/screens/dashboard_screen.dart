import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../providers/app_state.dart';
import '../theme/arcade_theme.dart';
import '../widgets/arcade_card.dart';
import '../widgets/kharch_logo.dart';
import 'add_pay_screen.dart';
import 'analytics_screen.dart';
import 'inbox_screen.dart';
import 'reconcile_screen.dart';
import 'settings_screen.dart';
import 'spaces_screen.dart';

class DashboardScreen extends StatefulWidget {
  final AppState appState;

  const DashboardScreen({super.key, required this.appState});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final TextEditingController _openingCtrl = TextEditingController();
  bool _isSettingOpening = false;
  int _currentNavIndex = 0; // 0: Home, 1: Reconcile/Audit, 2: Scan Action, 3: Analytics, 4: Spaces

  @override
  void initState() {
    super.initState();
    widget.appState.refreshDashboard();
  }

  @override
  void dispose() {
    _openingCtrl.dispose();
    super.dispose();
  }

  void _handleSetOpening() async {
    final amt = double.tryParse(_openingCtrl.text);
    if (amt == null || amt < 0) return;

    setState(() => _isSettingOpening = true);
    await widget.appState.setOpeningBalance(amt);
    if (mounted) {
      _openingCtrl.clear();
      setState(() => _isSettingOpening = false);
    }
  }

  void _onBottomNavTap(int index) {
    HapticFeedback.selectionClick();
    setState(() => _currentNavIndex = index);
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.appState,
      builder: (context, _) {
        return Scaffold(
          backgroundColor: ArcadeTheme.lightCanvas,
          body: IndexedStack(
            index: _currentNavIndex,
            children: [
              _buildHomeTab(context),
              ReconcileScreen(appState: widget.appState, isEmbedded: true),
              AddPayScreen(
                appState: widget.appState,
                isEmbedded: true,
                initialTab: 1,
                onBackOrDone: () => setState(() => _currentNavIndex = 0),
              ),
              AnalyticsScreen(appState: widget.appState, isEmbedded: true),
              InboxScreen(appState: widget.appState, isEmbedded: true),
            ],
          ),
          bottomNavigationBar: _buildPersistentBottomNav(),
        );
      },
    );
  }

  Widget _buildHomeTab(BuildContext context) {
    final user = widget.appState.user;
    final data = widget.appState.dashboardData;
    final activeSpace = widget.appState.activeSpace;

    final openingBalance = (data?['openingBalance'] ?? 0.0).toDouble();
    final monthEarned = (data?['monthEarned'] ?? data?['monthlyIncome'] ?? 0.0).toDouble();
    final monthSpent = (data?['monthSpent'] ?? data?['monthlyExpense'] ?? 0.0).toDouble();
    final todaySpent = (data?['todaySpent'] ?? 0.0).toDouble();
    final todayImportance = (data?['todayImportance'] as Map?) ?? {};
    final recentTransactions = (data?['recentTransactions'] as List?) ?? [];
    final insight = data?['insight'] as String? ?? 'Keep track of your expenses daily.';

    final essentialVal = (todayImportance['essential'] ?? 0).toDouble();
    final moderateVal = (todayImportance['moderate'] ?? 0).toDouble();
    final lowVal = (todayImportance['low_value'] ?? todayImportance['low'] ?? 0).toDouble();

    final now = DateTime.now();
    final months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    final dateStr = '${now.day} ${months[now.month - 1]} ${now.year}';
    final monthStr = '${months[now.month - 1]} ${now.year}';

    return Scaffold(
      backgroundColor: ArcadeTheme.darkCanvas,
      appBar: AppBar(
        backgroundColor: ArcadeTheme.darkCanvas,
        elevation: 0,
        titleSpacing: 16,
        automaticallyImplyLeading: false,
        title: Row(
          children: [
            const KharchLogo(size: 34),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  dateStr.toUpperCase(),
                  style: const TextStyle(
                    color: ArcadeTheme.slateDark,
                    fontWeight: FontWeight.w800,
                    fontSize: 10,
                    letterSpacing: 0.6,
                  ),
                ),
                Text(
                  'Hey, ${user?['name']?.toString().split(' ').first ?? 'User'}',
                  style: const TextStyle(
                    color: ArcadeTheme.pureBlack,
                    fontWeight: FontWeight.w900,
                    fontSize: 16,
                  ),
                ),
                GestureDetector(
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => SpacesScreen(
                          appState: widget.appState,
                          isEmbedded: false,
                          onSpaceSwitched: () {
                            widget.appState.refreshDashboard();
                          },
                        ),
                      ),
                    );
                  },
                  child: Row(
                    children: [
                      Text(
                        'Space: ${activeSpace?['name'] ?? 'Personal Life'} →',
                        style: const TextStyle(
                          color: ArcadeTheme.punchPink,
                          fontWeight: FontWeight.w800,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: [
          // Settings icon
          IconButton(
            icon: const Icon(Icons.settings_rounded, color: ArcadeTheme.pureBlack, size: 22),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => SettingsScreen(appState: widget.appState)),
              );
            },
          ),
          // User profile avatar (aligned perfectly with its circular placeholder)
          GestureDetector(
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => SettingsScreen(appState: widget.appState)),
              );
            },
            child: Padding(
              padding: const EdgeInsets.only(right: 14),
              child: _buildAvatar(user, size: 36),
            ),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => widget.appState.refreshDashboard(),
        color: ArcadeTheme.acidYellow,
        backgroundColor: ArcadeTheme.darkCard,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. Conditional Warning: Set Opening Balance
              if (openingBalance == 0) ...[
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: ArcadeTheme.cardWhite,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: ArcadeTheme.pureBlack, width: 2),
                    boxShadow: ArcadeTheme.neoShadow(offset: const Offset(3, 3)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.warning_amber_rounded, color: ArcadeTheme.pureBlack, size: 18),
                          const SizedBox(width: 6),
                          Text(
                            'Set $monthStr Opening Balance',
                            style: const TextStyle(
                              color: ArcadeTheme.pureBlack,
                              fontWeight: FontWeight.w900,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'To calculate monthly reconciliation and cashflow, enter your starting bank balance.',
                        style: TextStyle(color: ArcadeTheme.slateDark, fontSize: 11, fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _openingCtrl,
                              keyboardType: TextInputType.number,
                              style: const TextStyle(
                                color: ArcadeTheme.pureBlack,
                                fontWeight: FontWeight.w800,
                                fontSize: 13,
                              ),
                              decoration: InputDecoration(
                                hintText: 'e.g. ₹25,000',
                                hintStyle: const TextStyle(color: ArcadeTheme.slateMuted, fontSize: 12),
                                filled: true,
                                fillColor: ArcadeTheme.lightCanvas,
                                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(8),
                                  borderSide: const BorderSide(color: ArcadeTheme.pureBlack, width: 1.5),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          GestureDetector(
                            onTap: _handleSetOpening,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                              decoration: BoxDecoration(
                                color: ArcadeTheme.punchPink,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: ArcadeTheme.pureBlack, width: 2),
                                boxShadow: ArcadeTheme.neoShadow(offset: const Offset(2, 2)),
                              ),
                              child: _isSettingOpening
                                  ? const SizedBox(
                                      width: 14,
                                      height: 14,
                                      child: CircularProgressIndicator(strokeWidth: 2, color: ArcadeTheme.pureWhite),
                                    )
                                  : const Text(
                                      'SAVE',
                                      style: TextStyle(
                                        color: ArcadeTheme.pureWhite,
                                        fontWeight: FontWeight.w900,
                                        fontSize: 12,
                                      ),
                                    ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
              ],

              // 2. HERO TODAY'S EXPENSES CARD (Punch Pink Neo-Brutal styling)
              // Note: Expected Current Balance is placed in Audit/Reconcile tab for privacy
              ArcadeCard(
                fillColor: ArcadeTheme.punchPink,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(4),
                              decoration: BoxDecoration(
                                color: ArcadeTheme.acidYellow,
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(color: ArcadeTheme.pureBlack, width: 1.5),
                              ),
                              child: const Icon(Icons.flash_on_rounded, size: 14, color: ArcadeTheme.pureBlack),
                            ),
                            const SizedBox(width: 8),
                            const Text(
                              "TODAY'S SPENT",
                              style: TextStyle(
                                color: ArcadeTheme.pureWhite,
                                fontWeight: FontWeight.w900,
                                fontSize: 13,
                                letterSpacing: 0.8,
                              ),
                            ),
                          ],
                        ),
                        GestureDetector(
                          onTap: () {
                            setState(() => _currentNavIndex = 1); // Switch to Audit
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: ArcadeTheme.acidYellow,
                              borderRadius: BorderRadius.circular(ArcadeTheme.pillRadius),
                              border: Border.all(color: ArcadeTheme.pureBlack, width: 1.5),
                            ),
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.shield_rounded, size: 11, color: ArcadeTheme.punchPink),
                                SizedBox(width: 4),
                                Text(
                                  'AUDIT VAULT →',
                                  style: TextStyle(
                                    color: ArcadeTheme.pureBlack,
                                    fontWeight: FontWeight.w900,
                                    fontSize: 9,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Text(
                          '₹ ${todaySpent.toStringAsFixed(2)}',
                          style: const TextStyle(
                            color: ArcadeTheme.pureWhite,
                            fontWeight: FontWeight.w900,
                            fontSize: 34,
                            letterSpacing: -0.5,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '($dateStr)',
                          style: TextStyle(
                            color: ArcadeTheme.pureWhite.withValues(alpha: 0.85),
                            fontWeight: FontWeight.w700,
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        Expanded(
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                            decoration: BoxDecoration(
                              color: ArcadeTheme.pureBlack,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: ArcadeTheme.pureBlack, width: 1.5),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.trending_down_rounded, color: ArcadeTheme.punchPink, size: 16),
                                const SizedBox(width: 6),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'THIS MONTH',
                                      style: TextStyle(
                                        color: ArcadeTheme.pureWhite.withValues(alpha: 0.7),
                                        fontWeight: FontWeight.w900,
                                        fontSize: 9,
                                      ),
                                    ),
                                    Text(
                                      '₹ ${monthSpent.toStringAsFixed(0)}',
                                      style: const TextStyle(
                                        color: ArcadeTheme.acidYellow,
                                        fontWeight: FontWeight.w900,
                                        fontSize: 13,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                            decoration: BoxDecoration(
                              color: ArcadeTheme.pureBlack,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: ArcadeTheme.pureBlack, width: 1.5),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.trending_up_rounded, color: ArcadeTheme.arcadeGreen, size: 16),
                                const SizedBox(width: 6),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'INFLOW',
                                      style: TextStyle(
                                        color: ArcadeTheme.pureWhite.withValues(alpha: 0.7),
                                        fontWeight: FontWeight.w900,
                                        fontSize: 9,
                                      ),
                                    ),
                                    Text(
                                      '+₹ ${monthEarned.toStringAsFixed(0)}',
                                      style: const TextStyle(
                                        color: ArcadeTheme.arcadeGreen,
                                        fontWeight: FontWeight.w900,
                                        fontSize: 13,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),

              // 3. Privacy Shield Indicator Pill
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: ArcadeTheme.pureWhite,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: ArcadeTheme.pureBlack, width: 1.5),
                  boxShadow: ArcadeTheme.neoShadow(offset: const Offset(2, 2)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.visibility_off_outlined, color: ArcadeTheme.punchPink, size: 16),
                    const SizedBox(width: 8),
                    const Expanded(
                      child: Text(
                        'Total balance is safely hidden from strangers.',
                        style: TextStyle(
                          color: ArcadeTheme.pureBlack,
                          fontWeight: FontWeight.w700,
                          fontSize: 11,
                        ),
                      ),
                    ),
                    GestureDetector(
                      onTap: () => setState(() => _currentNavIndex = 1),
                      child: const Text(
                        'Audit →',
                        style: TextStyle(
                          color: ArcadeTheme.punchPink,
                          fontWeight: FontWeight.w900,
                          fontSize: 11,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),

              // 4. Today's Spend Breakdown & AI Insight Card (Pink Neo-Brutal background)
              ArcadeCard(
                fillColor: ArcadeTheme.acidYellow,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          "TODAY'S SPEND BREAKDOWN",
                          style: TextStyle(
                            color: ArcadeTheme.pureBlack,
                            fontWeight: FontWeight.w900,
                            fontSize: 12,
                            letterSpacing: 0.6,
                          ),
                        ),
                        Text(
                          '₹ ${todaySpent.toStringAsFixed(0)}',
                          style: const TextStyle(
                            color: ArcadeTheme.pureBlack,
                            fontWeight: FontWeight.w900,
                            fontSize: 14,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    if (todaySpent > 0) ...[
                      // Stacked horizontal proportion bar
                      ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: SizedBox(
                          height: 8,
                          child: Row(
                            children: [
                              if (essentialVal > 0)
                                Expanded(
                                  flex: (essentialVal * 100).toInt(),
                                  child: Container(color: ArcadeTheme.arcadeGreen),
                                ),
                              if (moderateVal > 0)
                                Expanded(
                                  flex: (moderateVal * 100).toInt(),
                                  child: Container(color: ArcadeTheme.acidYellow),
                                ),
                              if (lowVal > 0)
                                Expanded(
                                  flex: (lowVal * 100).toInt(),
                                  child: Container(color: ArcadeTheme.punchPink),
                                ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      // Legend pills
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          _buildSpendLegend('Essential', essentialVal, ArcadeTheme.arcadeGreen),
                          _buildSpendLegend('Moderate', moderateVal, ArcadeTheme.acidYellow),
                          _buildSpendLegend('Low Value', lowVal, ArcadeTheme.punchPink),
                        ],
                      ),
                    ] else
                      const Text(
                        'No transactions recorded today.',
                        style: TextStyle(color: ArcadeTheme.slateDark, fontSize: 11, fontStyle: FontStyle.italic, fontWeight: FontWeight.w600),
                      ),
                    const SizedBox(height: 10),
                    // Dynamic AI Insight banner
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: ArcadeTheme.creamWhite,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: ArcadeTheme.pureBlack, width: 1.5),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(Icons.auto_awesome_rounded, color: ArcadeTheme.punchPink, size: 16),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              insight,
                              style: const TextStyle(
                                color: ArcadeTheme.pureBlack,
                                fontWeight: FontWeight.w700,
                                fontSize: 11,
                                height: 1.3,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // 5. Recent Activity Section
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'RECENT ACTIVITY',
                    style: TextStyle(
                      color: ArcadeTheme.pureBlack,
                      fontWeight: FontWeight.w900,
                      fontSize: 13,
                      letterSpacing: 0.6,
                    ),
                  ),
                  GestureDetector(
                    onTap: () {
                      setState(() => _currentNavIndex = 3); // Switch to Analytics
                    },
                    child: const Text(
                      'View All →',
                      style: TextStyle(
                        color: ArcadeTheme.punchPink,
                        fontWeight: FontWeight.w900,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),

              if (recentTransactions.isEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 24),
                  alignment: Alignment.center,
                  child: const Text(
                    'No transaction logs recorded.',
                    style: TextStyle(color: ArcadeTheme.slateDark, fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                )
              else
                ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: recentTransactions.length > 5 ? 5 : recentTransactions.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, idx) {
                    final tx = recentTransactions[idx];
                    final isIncome = tx['type'] == 'income';
                    final amt = (tx['amount'] ?? 0.0).toDouble();
                    final title = tx['titleId']?['displayName'] ?? tx['title'] ?? 'Transaction';
                    final dateRaw = tx['date']?.toString() ?? '';
                    final note = tx['note']?.toString() ?? '';

                    String dateLabel = dateRaw;
                    if (dateRaw.isNotEmpty) {
                      try {
                        final dt = DateTime.parse(dateRaw).toLocal();
                        dateLabel = '${dt.day} ${months[dt.month - 1]}';
                      } catch (_) {}
                    }

                    Color dotColor = ArcadeTheme.punchPink;
                    if (isIncome) {
                      dotColor = ArcadeTheme.arcadeGreen;
                    } else if (tx['type'] == 'investment') {
                      dotColor = ArcadeTheme.neonCyan;
                    } else if (tx['type'] == 'savings') {
                      dotColor = const Color(0xFFC084FC);
                    } else if (tx['importance'] == 'essential') {
                      dotColor = ArcadeTheme.arcadeGreen;
                    } else if (tx['importance'] == 'moderate') {
                      dotColor = ArcadeTheme.acidYellow;
                    }

                    return Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: ArcadeTheme.creamWhite,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: ArcadeTheme.pureBlack, width: 2),
                        boxShadow: ArcadeTheme.neoShadow(offset: const Offset(2, 2)),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Row(
                              children: [
                                Container(
                                  width: 9,
                                  height: 9,
                                  decoration: BoxDecoration(
                                    color: dotColor,
                                    shape: BoxShape.circle,
                                    border: Border.all(color: ArcadeTheme.pureBlack, width: 1),
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        title,
                                        style: const TextStyle(
                                          color: ArcadeTheme.pureBlack,
                                          fontWeight: FontWeight.w800,
                                          fontSize: 13,
                                        ),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      Text(
                                        note.isNotEmpty ? '$dateLabel • $note' : dateLabel,
                                        style: const TextStyle(
                                          color: ArcadeTheme.slateDark,
                                          fontSize: 10,
                                          fontWeight: FontWeight.w600,
                                        ),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            '${isIncome ? '+' : '-'}₹ ${amt.toStringAsFixed(0)}',
                            style: TextStyle(
                              color: isIncome ? ArcadeTheme.arcadeGreen : ArcadeTheme.punchPink,
                              fontWeight: FontWeight.w900,
                              fontSize: 14,
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSpendLegend(String label, double val, Color color) {
    return Row(
      children: [
        Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle, border: Border.all(color: ArcadeTheme.pureBlack, width: 1.5))),
        const SizedBox(width: 4),
        Text(
          '$label (₹${val.toStringAsFixed(0)})',
          style: const TextStyle(color: ArcadeTheme.pureBlack, fontSize: 9, fontWeight: FontWeight.w800),
        ),
      ],
    );
  }

  /// Permanent, static bottom navigation bar that remains across all screens
  Widget _buildPersistentBottomNav() {
    return Container(
      decoration: const BoxDecoration(
        color: ArcadeTheme.cardWhite, // Crisp white bottom bar on light canvas
        border: Border(
          top: BorderSide(color: ArcadeTheme.pureBlack, width: 2.5),
        ),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      child: SafeArea(
        top: false,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _buildNavItem(0, 'Home', Icons.home_rounded, ArcadeTheme.punchPink),
            _buildNavItem(1, 'Audit', Icons.fact_check_rounded, ArcadeTheme.punchPink),
            // Central Elevated Scan & Pay Button (camera opens by default)
            GestureDetector(
              onTap: () => _onBottomNavTap(2),
              child: Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: _currentNavIndex == 2 ? ArcadeTheme.punchPink : ArcadeTheme.acidYellow,
                  shape: BoxShape.circle,
                  border: Border.all(color: ArcadeTheme.pureBlack, width: 2.5),
                  boxShadow: ArcadeTheme.neoShadow(offset: const Offset(3, 3)),
                ),
                child: Icon(
                  Icons.qr_code_scanner_rounded,
                  color: _currentNavIndex == 2 ? ArcadeTheme.pureWhite : ArcadeTheme.pureBlack,
                  size: 28,
                ),
              ),
            ),
            _buildNavItem(3, 'Analytics', Icons.bar_chart_rounded, ArcadeTheme.punchPink),
            _buildInboxNavItem(4, 'Inbox', Icons.inbox_rounded, ArcadeTheme.punchPink, widget.appState.inboxData?['unreadCount'] ?? 0),
          ],
        ),
      ),
    );
  }

  Widget _buildInboxNavItem(int index, String label, IconData icon, Color activeColor, int unreadCount) {
    final isSelected = _currentNavIndex == index;
    return GestureDetector(
      onTap: () => _onBottomNavTap(index),
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        decoration: isSelected
            ? BoxDecoration(
                color: activeColor.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: ArcadeTheme.pureBlack, width: 1.5),
              )
            : null,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Icon(
                  icon,
                  color: isSelected ? activeColor : ArcadeTheme.slateDark,
                  size: 22,
                ),
                if (unreadCount > 0)
                  Positioned(
                    right: -6,
                    top: -4,
                    child: Container(
                      padding: const EdgeInsets.all(3),
                      decoration: BoxDecoration(
                        color: ArcadeTheme.punchPink,
                        shape: BoxShape.circle,
                        border: Border.all(color: ArcadeTheme.pureBlack, width: 1),
                      ),
                      child: Text(
                        '$unreadCount',
                        style: const TextStyle(
                          color: ArcadeTheme.pureWhite,
                          fontSize: 8,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                color: isSelected ? ArcadeTheme.pureBlack : ArcadeTheme.slateDark,
                fontWeight: isSelected ? FontWeight.w900 : FontWeight.w700,
                fontSize: 10,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildNavItem(int index, String label, IconData icon, Color activeColor) {
    final isSelected = _currentNavIndex == index;
    return GestureDetector(
      onTap: () => _onBottomNavTap(index),
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        decoration: isSelected
            ? BoxDecoration(
                color: activeColor.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: ArcadeTheme.pureBlack, width: 1.5),
              )
            : null,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              color: isSelected ? activeColor : ArcadeTheme.slateDark,
              size: 22,
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                color: isSelected ? ArcadeTheme.pureBlack : ArcadeTheme.slateDark,
                fontWeight: isSelected ? FontWeight.w900 : FontWeight.w700,
                fontSize: 10,
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Pixel-perfect aligned Google profile avatar with fallback placeholder
  Widget _buildAvatar(Map<String, dynamic>? user, {double size = 36}) {
    final pictureUrl = user?['picture']?.toString();
    final name = user?['name']?.toString();
    final initial = (name != null && name.trim().isNotEmpty) ? name.trim()[0].toUpperCase() : 'U';

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: ArcadeTheme.acidYellow,
        shape: BoxShape.circle,
        border: Border.all(color: ArcadeTheme.pureBlack, width: 2),
        boxShadow: ArcadeTheme.neoShadow(offset: const Offset(2, 2)),
      ),
      child: ClipOval(
        child: pictureUrl != null && pictureUrl.isNotEmpty
            ? Image.network(
                pictureUrl,
                width: size,
                height: size,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => _buildAvatarFallbackText(initial, size),
                loadingBuilder: (context, child, loadingProgress) {
                  if (loadingProgress == null) return child;
                  return _buildAvatarFallbackText(initial, size);
                },
              )
            : _buildAvatarFallbackText(initial, size),
      ),
    );
  }

  Widget _buildAvatarFallbackText(String initial, double size) {
    return Container(
      width: size,
      height: size,
      color: ArcadeTheme.acidYellow,
      alignment: Alignment.center,
      child: Text(
        initial,
        textAlign: TextAlign.center,
        style: TextStyle(
          color: ArcadeTheme.pureBlack,
          fontWeight: FontWeight.w900,
          fontSize: size * 0.45,
          height: 1.0,
        ),
      ),
    );
  }
}
