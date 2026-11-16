import 'package:flutter/material.dart';
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
  int _currentNavIndex = 0;

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
    if (index == _currentNavIndex && index == 0) return;

    setState(() => _currentNavIndex = index);

    if (index == 1) {
      // RECONCILE
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => ReconcileScreen(appState: widget.appState)),
      ).then((_) => setState(() => _currentNavIndex = 0));
    } else if (index == 2) {
      // UNIFIED ADD & PAY
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => AddPayScreen(appState: widget.appState)),
      ).then((_) => setState(() => _currentNavIndex = 0));
    } else if (index == 3) {
      // ANALYTICS
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => AnalyticsScreen(appState: widget.appState)),
      ).then((_) => setState(() => _currentNavIndex = 0));
    } else if (index == 4) {
      // SPACES
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => SpacesScreen(appState: widget.appState)),
      ).then((_) => setState(() => _currentNavIndex = 0));
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = widget.appState.user;
    final data = widget.appState.dashboardData;
    final activeSpace = widget.appState.activeSpace;
    final unreadInbox = widget.appState.inboxData?['unreadCount'] ?? 0;

    // Direct mapping to PWA dashboard response structure
    final openingBalance = (data?['openingBalance'] ?? 0.0).toDouble();
    final currentBalance = (data?['currentBalance'] ?? data?['netBalance'] ?? 0.0).toDouble();
    final monthEarned = (data?['monthEarned'] ?? data?['monthlyIncome'] ?? 0.0).toDouble();
    final monthSpent = (data?['monthSpent'] ?? data?['monthlyExpense'] ?? 0.0).toDouble();
    final monthInvestments = (data?['monthInvestments'] ?? 0.0).toDouble();
    final monthSavings = (data?['monthSavings'] ?? 0.0).toDouble();
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
                    color: ArcadeTheme.slateMuted,
                    fontWeight: FontWeight.w800,
                    fontSize: 10,
                    letterSpacing: 0.6,
                  ),
                ),
                Text(
                  'Hey, ${user?['name']?.toString().split(' ').first ?? 'User'}',
                  style: const TextStyle(
                    color: ArcadeTheme.pureWhite,
                    fontWeight: FontWeight.w900,
                    fontSize: 16,
                  ),
                ),
                GestureDetector(
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => SpacesScreen(appState: widget.appState)),
                    );
                  },
                  child: Row(
                    children: [
                      Text(
                        'Space: ${activeSpace?['name'] ?? 'Personal Life'} →',
                        style: const TextStyle(
                          color: ArcadeTheme.acidYellow,
                          fontWeight: FontWeight.w700,
                          fontSize: 11,
                          decoration: TextDecoration.underline,
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
          // Inbox icon with unread badge
          IconButton(
            icon: Stack(
              clipBehavior: Clip.none,
              children: [
                const Icon(Icons.inbox_rounded, color: ArcadeTheme.pureWhite, size: 22),
                if (unreadInbox > 0)
                  Positioned(
                    right: -4,
                    top: -4,
                    child: Container(
                      padding: const EdgeInsets.all(3),
                      decoration: const BoxDecoration(
                        color: ArcadeTheme.punchPink,
                        shape: BoxShape.circle,
                      ),
                      child: Text(
                        '$unreadInbox',
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
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => InboxScreen(appState: widget.appState)),
              );
            },
          ),
          // Settings icon
          IconButton(
            icon: const Icon(Icons.settings_rounded, color: ArcadeTheme.pureWhite, size: 22),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => SettingsScreen(appState: widget.appState)),
              );
            },
          ),
          // User profile avatar
          GestureDetector(
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => SettingsScreen(appState: widget.appState)),
              );
            },
            child: Padding(
              padding: const EdgeInsets.only(right: 14),
              child: Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: ArcadeTheme.acidYellow,
                  shape: BoxShape.circle,
                  border: Border.all(color: ArcadeTheme.pureBlack, width: 2),
                  boxShadow: ArcadeTheme.neoShadow(offset: const Offset(2, 2)),
                ),
                child: ClipOval(
                  child: user?['picture'] != null && user!['picture'].toString().isNotEmpty
                      ? Image.network(
                          user['picture'],
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => _buildAvatarFallback(user['name']),
                        )
                      : _buildAvatarFallback(user?['name']),
                ),
              ),
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
              // 1. Conditional Warning: Set Opening Balance (matches PWA)
              if (openingBalance == 0) ...[
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: ArcadeTheme.darkCard,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: ArcadeTheme.acidYellow, width: 2),
                    boxShadow: ArcadeTheme.neoShadow(offset: const Offset(3, 3)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.warning_amber_rounded, color: ArcadeTheme.acidYellow, size: 18),
                          const SizedBox(width: 6),
                          Text(
                            'Set $monthStr Opening Balance',
                            style: const TextStyle(
                              color: ArcadeTheme.acidYellow,
                              fontWeight: FontWeight.w900,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'To calculate your monthly reconciliation and cashflow, enter your starting bank balance.',
                        style: TextStyle(color: ArcadeTheme.slateMuted, fontSize: 11),
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _openingCtrl,
                              keyboardType: TextInputType.number,
                              style: const TextStyle(
                                color: ArcadeTheme.pureWhite,
                                fontWeight: FontWeight.w800,
                                fontSize: 13,
                              ),
                              decoration: InputDecoration(
                                hintText: 'e.g. ₹25,000',
                                hintStyle: const TextStyle(color: ArcadeTheme.slateMuted, fontSize: 12),
                                filled: true,
                                fillColor: ArcadeTheme.darkCardLight,
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
                                color: ArcadeTheme.acidYellow,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: ArcadeTheme.pureBlack, width: 2),
                                boxShadow: ArcadeTheme.neoShadow(offset: const Offset(2, 2)),
                              ),
                              child: _isSettingOpening
                                  ? const SizedBox(
                                      width: 14,
                                      height: 14,
                                      child: CircularProgressIndicator(strokeWidth: 2, color: ArcadeTheme.pureBlack),
                                    )
                                  : const Text(
                                      'SAVE',
                                      style: TextStyle(
                                        color: ArcadeTheme.pureBlack,
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

              // 2. Expected Current Balance Card (matches PWA)
              ArcadeCard(
                fillColor: ArcadeTheme.acidYellow,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'EXPECTED CURRENT BALANCE',
                          style: TextStyle(
                            color: ArcadeTheme.pureBlack,
                            fontWeight: FontWeight.w900,
                            fontSize: 11,
                            letterSpacing: 0.8,
                          ),
                        ),
                        GestureDetector(
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(builder: (_) => ReconcileScreen(appState: widget.appState)),
                            );
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: ArcadeTheme.pureBlack,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.lock_outline_rounded, size: 10, color: ArcadeTheme.pureWhite),
                                SizedBox(width: 3),
                                Text(
                                  'AUDIT',
                                  style: TextStyle(
                                    color: ArcadeTheme.pureWhite,
                                    fontWeight: FontWeight.w900,
                                    fontSize: 9,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '₹ ${currentBalance.toStringAsFixed(2)}',
                      style: const TextStyle(
                        color: ArcadeTheme.pureBlack,
                        fontWeight: FontWeight.w900,
                        fontSize: 32,
                        letterSpacing: -0.5,
                      ),
                    ),
                    const SizedBox(height: 12),
                    // Sub-categories row (Earned & Spent)
                    Row(
                      children: [
                        Expanded(
                          child: Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: ArcadeTheme.pureWhite,
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
                                    const Text(
                                      'EARNED',
                                      style: TextStyle(
                                        color: ArcadeTheme.pureBlack,
                                        fontWeight: FontWeight.w900,
                                        fontSize: 9,
                                      ),
                                    ),
                                    Text(
                                      '+₹ ${monthEarned.toStringAsFixed(0)}',
                                      style: const TextStyle(
                                        color: ArcadeTheme.arcadeGreen,
                                        fontWeight: FontWeight.w900,
                                        fontSize: 12,
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
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: ArcadeTheme.pureWhite,
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
                                    const Text(
                                      'SPENT',
                                      style: TextStyle(
                                        color: ArcadeTheme.pureBlack,
                                        fontWeight: FontWeight.w900,
                                        fontSize: 9,
                                      ),
                                    ),
                                    Text(
                                      '-₹ ${monthSpent.toStringAsFixed(0)}',
                                      style: const TextStyle(
                                        color: ArcadeTheme.punchPink,
                                        fontWeight: FontWeight.w900,
                                        fontSize: 12,
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
                    // Investments & Savings row (if present)
                    if (monthInvestments > 0 || monthSavings > 0) ...[
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          if (monthInvestments > 0)
                            Text(
                              'Invested: ₹ ${monthInvestments.toStringAsFixed(0)}',
                              style: const TextStyle(
                                color: ArcadeTheme.pureBlack,
                                fontWeight: FontWeight.w800,
                                fontSize: 10,
                              ),
                            ),
                          if (monthSavings > 0)
                            Text(
                              'Emergency Savings: ₹ ${monthSavings.toStringAsFixed(0)}',
                              style: const TextStyle(
                                color: ArcadeTheme.pureBlack,
                                fontWeight: FontWeight.w800,
                                fontSize: 10,
                              ),
                            ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 14),

              // 3. Today's Spend Overview & AI Insight Card (matches PWA)
              ArcadeCard(
                fillColor: ArcadeTheme.darkCard,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          "TODAY'S SPEND OVERVIEW",
                          style: TextStyle(
                            color: ArcadeTheme.pureWhite,
                            fontWeight: FontWeight.w900,
                            fontSize: 12,
                            letterSpacing: 0.6,
                          ),
                        ),
                        Text(
                          '₹ ${todaySpent.toStringAsFixed(0)}',
                          style: const TextStyle(
                            color: ArcadeTheme.acidYellow,
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
                        style: TextStyle(color: ArcadeTheme.slateMuted, fontSize: 11, fontStyle: FontStyle.italic),
                      ),
                    const SizedBox(height: 10),
                    // Dynamic AI Insight banner
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: ArcadeTheme.darkCardLight,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: ArcadeTheme.pureBlack, width: 1.5),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(Icons.auto_awesome_rounded, color: ArcadeTheme.acidYellow, size: 16),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              insight,
                              style: const TextStyle(
                                color: ArcadeTheme.pureWhite,
                                fontWeight: FontWeight.w600,
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
              const SizedBox(height: 14),

              // 4. Recent Activity (matches PWA 5 items)
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'RECENT ACTIVITY',
                    style: TextStyle(
                      color: ArcadeTheme.pureWhite,
                      fontWeight: FontWeight.w900,
                      fontSize: 13,
                      letterSpacing: 0.6,
                    ),
                  ),
                  GestureDetector(
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => AnalyticsScreen(appState: widget.appState)),
                      );
                    },
                    child: const Text(
                      'View All →',
                      style: TextStyle(
                        color: ArcadeTheme.acidYellow,
                        fontWeight: FontWeight.w800,
                        fontSize: 11,
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
                    style: TextStyle(color: ArcadeTheme.slateMuted, fontSize: 12),
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
                        color: ArcadeTheme.darkCard,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: ArcadeTheme.pureBlack, width: 2),
                        boxShadow: ArcadeTheme.neoShadow(offset: const Offset(2, 2)),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
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
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    title,
                                    style: const TextStyle(
                                      color: ArcadeTheme.pureWhite,
                                      fontWeight: FontWeight.w800,
                                      fontSize: 13,
                                    ),
                                  ),
                                  Text(
                                    note.isNotEmpty ? '$dateLabel • $note' : dateLabel,
                                    style: const TextStyle(
                                      color: ArcadeTheme.slateMuted,
                                      fontSize: 10,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
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
      bottomNavigationBar: _buildPersistentBottomNav(),
    );
  }

  Widget _buildSpendLegend(String label, double val, Color color) {
    return Row(
      children: [
        Container(width: 6, height: 6, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 4),
        Text(
          '$label (₹${val.toStringAsFixed(0)})',
          style: const TextStyle(color: ArcadeTheme.slateMuted, fontSize: 9, fontWeight: FontWeight.w700),
        ),
      ],
    );
  }

  Widget _buildPersistentBottomNav() {
    return Container(
      decoration: const BoxDecoration(
        color: ArcadeTheme.darkCard,
        border: Border(top: BorderSide(color: ArcadeTheme.pureBlack, width: 2.5)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: SafeArea(
        top: false,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _buildNavItem(0, 'Home', Icons.home_rounded, ArcadeTheme.acidYellow),
            _buildNavItem(1, 'Reconcile', Icons.scale_rounded, ArcadeTheme.acidYellow),
            // Central Elevated Add/Pay Button
            GestureDetector(
              onTap: () => _onBottomNavTap(2),
              child: Container(
                width: 50,
                height: 50,
                decoration: BoxDecoration(
                  color: ArcadeTheme.acidYellow,
                  shape: BoxShape.circle,
                  border: Border.all(color: ArcadeTheme.pureBlack, width: 2.5),
                  boxShadow: ArcadeTheme.neoShadow(offset: const Offset(3, 3)),
                ),
                child: const Icon(Icons.add_rounded, color: ArcadeTheme.pureBlack, size: 30),
              ),
            ),
            _buildNavItem(3, 'Analytics', Icons.bar_chart_rounded, ArcadeTheme.acidYellow),
            _buildNavItem(4, 'Spaces', Icons.folder_shared_rounded, ArcadeTheme.acidYellow),
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
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              color: isSelected ? activeColor : ArcadeTheme.slateMuted,
              size: 22,
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                color: isSelected ? activeColor : ArcadeTheme.slateMuted,
                fontWeight: isSelected ? FontWeight.w900 : FontWeight.w700,
                fontSize: 10,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAvatarFallback(String? name) {
    final initial = (name != null && name.isNotEmpty) ? name[0].toUpperCase() : 'U';
    return Container(
      color: ArcadeTheme.acidYellow,
      alignment: Alignment.center,
      child: Text(
        initial,
        style: const TextStyle(
          color: ArcadeTheme.pureBlack,
          fontWeight: FontWeight.w900,
          fontSize: 15,
        ),
      ),
    );
  }
}
