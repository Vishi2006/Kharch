import 'package:flutter/material.dart';
import '../providers/app_state.dart';
import '../theme/arcade_theme.dart';
import '../widgets/arcade_badge.dart';
import '../widgets/arcade_button.dart';
import '../widgets/arcade_card.dart';
import '../widgets/kharch_logo.dart';
import '../widgets/neo_chart.dart';
import 'add_transaction_screen.dart';
import 'inbox_screen.dart';
import 'qr_pay_screen.dart';
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
  int _currentNavIndex = 0; // 0: Dashboard, 1: Pay, 2: Add, 3: Audit, 4: Setup
  bool _isSettingOpening = false;
  final TextEditingController _openingCtrl = TextEditingController();

  @override
  void dispose() {
    _openingCtrl.dispose();
    super.dispose();
  }

  void _handleSetOpening() async {
    final amt = double.tryParse(_openingCtrl.text);
    if (amt == null) return;

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
      // PAY
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => QrPayScreen(appState: widget.appState)),
      ).then((_) => setState(() => _currentNavIndex = 0));
    } else if (index == 2) {
      // ADD
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => AddTransactionScreen(appState: widget.appState)),
      ).then((_) => setState(() => _currentNavIndex = 0));
    } else if (index == 3) {
      // AUDIT
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => ReconcileScreen(appState: widget.appState)),
      ).then((_) => setState(() => _currentNavIndex = 0));
    } else if (index == 4) {
      // SETUP
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => SettingsScreen(appState: widget.appState)),
      ).then((_) => setState(() => _currentNavIndex = 0));
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = widget.appState.user;
    final data = widget.appState.dashboardData;
    final activeSpace = widget.appState.activeSpace;
    final spaces = widget.appState.spaces;
    final unreadInbox = widget.appState.inboxData?['unreadCount'] ?? 0;

    final balance = (data?['netBalance'] ?? 0.0).toDouble();
    final expense = (data?['monthlyExpense'] ?? 0.0).toDouble();
    final income = (data?['monthlyIncome'] ?? 0.0).toDouble();
    final openingBalance = (data?['openingBalance'] ?? 0.0).toDouble();
    final transactions = (data?['recentTransactions'] as List?) ?? [];

    // Chart mock/derived weekly cashflow values
    final List<double> chartValues = expense > 0
        ? <double>[expense * 0.15, expense * 0.25, expense * 0.20, expense * 0.35, expense * 0.05]
        : <double>[150.0, 320.0, 200.0, 450.0, 180.0];
    final chartLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

    return Scaffold(
      backgroundColor: ArcadeTheme.darkCanvas,
      appBar: AppBar(
        backgroundColor: ArcadeTheme.darkCanvas,
        elevation: 0,
        titleSpacing: 16,
        title: Row(
          children: [
            const KharchLogo(size: 36),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Kharch',
                  style: TextStyle(
                    color: ArcadeTheme.pureWhite,
                    fontWeight: FontWeight.w900,
                    fontSize: 18,
                    letterSpacing: 0.5,
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
                        activeSpace?['name'] ?? 'Personal Life',
                        style: const TextStyle(
                          color: ArcadeTheme.acidYellow,
                          fontWeight: FontWeight.w700,
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(width: 3),
                      const Icon(Icons.arrow_drop_down, color: ArcadeTheme.acidYellow, size: 16),
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
                const Icon(Icons.inbox_rounded, color: ArcadeTheme.pureWhite, size: 24),
                if (unreadInbox > 0)
                  Positioned(
                    right: -4,
                    top: -4,
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: const BoxDecoration(
                        color: ArcadeTheme.punchPink,
                        shape: BoxShape.circle,
                      ),
                      child: Text(
                        '$unreadInbox',
                        style: const TextStyle(
                          color: ArcadeTheme.pureWhite,
                          fontSize: 9,
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
          const SizedBox(width: 4),

          // User Profile Photo
          GestureDetector(
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => SettingsScreen(appState: widget.appState)),
              );
            },
            child: Container(
              margin: const EdgeInsets.only(right: 16),
              width: 36,
              height: 36,
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
              // Horizontal Spaces Pills Selector
              SizedBox(
                height: 38,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: spaces.length + 1,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (context, index) {
                    if (index == spaces.length) {
                      return GestureDetector(
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => SpacesScreen(appState: widget.appState),
                            ),
                          );
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          decoration: BoxDecoration(
                            color: ArcadeTheme.darkCardLight,
                            borderRadius: BorderRadius.circular(ArcadeTheme.pillRadius),
                            border: Border.all(color: ArcadeTheme.pureBlack, width: 2),
                          ),
                          alignment: Alignment.center,
                          child: const Row(
                            children: [
                              Icon(Icons.add, color: ArcadeTheme.acidYellow, size: 14),
                              SizedBox(width: 4),
                              Text(
                                'SPACES',
                                style: TextStyle(
                                  color: ArcadeTheme.acidYellow,
                                  fontWeight: FontWeight.w900,
                                  fontSize: 11,
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    }

                    final sp = spaces[index];
                    final isSelected = sp['_id'] == activeSpace?['_id'];
                    return GestureDetector(
                      onTap: () => widget.appState.switchSpace(sp),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14),
                        decoration: BoxDecoration(
                          color: isSelected ? ArcadeTheme.acidYellow : ArcadeTheme.darkCard,
                          borderRadius: BorderRadius.circular(ArcadeTheme.pillRadius),
                          border: Border.all(color: ArcadeTheme.pureBlack, width: 2),
                          boxShadow: isSelected
                              ? ArcadeTheme.neoShadow(offset: const Offset(2, 2))
                              : null,
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          sp['name'] ?? 'Space',
                          style: TextStyle(
                            color: isSelected ? ArcadeTheme.pureBlack : ArcadeTheme.pureWhite,
                            fontWeight: FontWeight.w900,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 16),

              // Opening Balance Prompt if 0
              if (openingBalance == 0) ...[
                ArcadeCard(
                  fillColor: ArcadeTheme.darkCard,
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: const [
                          Icon(Icons.account_balance_wallet_rounded,
                              color: ArcadeTheme.acidYellow, size: 18),
                          SizedBox(width: 8),
                          Text(
                            'SET MONTH STARTING BALANCE',
                            style: TextStyle(
                              color: ArcadeTheme.acidYellow,
                              fontWeight: FontWeight.w900,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'Enter your opening bank balance to audit cashflow and reconciliation.',
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
                                  color: ArcadeTheme.pureWhite, fontWeight: FontWeight.w900),
                              decoration: InputDecoration(
                                hintText: 'e.g. ₹25,000',
                                hintStyle: const TextStyle(color: ArcadeTheme.slateMuted),
                                filled: true,
                                fillColor: ArcadeTheme.darkCardLight,
                                contentPadding:
                                    const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(8),
                                  borderSide:
                                      const BorderSide(color: ArcadeTheme.pureBlack, width: 2),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          ArcadeButton(
                            text: 'SAVE',
                            height: 42,
                            fontSize: 12,
                            backgroundColor: ArcadeTheme.acidYellow,
                            textColor: ArcadeTheme.pureBlack,
                            isLoading: _isSettingOpening,
                            onTap: _handleSetOpening,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // Expected Current Balance Card
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
                            fontSize: 12,
                            letterSpacing: 0.8,
                          ),
                        ),
                        GestureDetector(
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => ReconcileScreen(appState: widget.appState),
                              ),
                            );
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: ArcadeTheme.pureBlack,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Text(
                              'AUDIT 🔒',
                              style: TextStyle(
                                color: ArcadeTheme.pureWhite,
                                fontWeight: FontWeight.w900,
                                fontSize: 10,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '₹ ${balance.toStringAsFixed(2)}',
                      style: ArcadeTheme.arcadeScore,
                    ),
                    const SizedBox(height: 14),
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
                                const Icon(Icons.arrow_downward_rounded,
                                    color: ArcadeTheme.arcadeGreen, size: 16),
                                const SizedBox(width: 4),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text('EARNED',
                                        style: TextStyle(
                                            color: ArcadeTheme.pureBlack,
                                            fontSize: 9,
                                            fontWeight: FontWeight.w900)),
                                    Text('₹ ${income.toStringAsFixed(0)}',
                                        style: const TextStyle(
                                            color: ArcadeTheme.pureBlack,
                                            fontSize: 13,
                                            fontWeight: FontWeight.w900)),
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
                                const Icon(Icons.arrow_upward_rounded,
                                    color: ArcadeTheme.punchPink, size: 16),
                                const SizedBox(width: 4),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text('SPENT',
                                        style: TextStyle(
                                            color: ArcadeTheme.pureBlack,
                                            fontSize: 9,
                                            fontWeight: FontWeight.w900)),
                                    Text('₹ ${expense.toStringAsFixed(0)}',
                                        style: const TextStyle(
                                            color: ArcadeTheme.pureBlack,
                                            fontSize: 13,
                                            fontWeight: FontWeight.w900)),
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
              const SizedBox(height: 16),

              // Weekly Spending Chart Card
              ArcadeCard(
                fillColor: ArcadeTheme.darkCard,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: const [
                        Text(
                          'WEEKLY SPENDING TREND',
                          style: TextStyle(
                            color: ArcadeTheme.neonCyan,
                            fontWeight: FontWeight.w900,
                            fontSize: 12,
                            letterSpacing: 0.6,
                          ),
                        ),
                        Icon(Icons.bar_chart_rounded, color: ArcadeTheme.neonCyan, size: 18),
                      ],
                    ),
                    const SizedBox(height: 14),
                    SizedBox(
                      height: 100,
                      width: double.infinity,
                      child: CustomPaint(
                        painter: NeoChartPainter(
                          values: chartValues,
                          labels: chartLabels,
                          barColor: ArcadeTheme.acidYellow,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Recent Activity (Top 5 transactions matching PWA layout)
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'RECENT ACTIVITY',
                    style: TextStyle(
                      color: ArcadeTheme.pureWhite,
                      fontWeight: FontWeight.w900,
                      fontSize: 14,
                      letterSpacing: 0.6,
                    ),
                  ),
                  GestureDetector(
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => ReconcileScreen(appState: widget.appState),
                        ),
                      );
                    },
                    child: const Text(
                      'View All',
                      style: TextStyle(
                        color: ArcadeTheme.acidYellow,
                        fontWeight: FontWeight.w800,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),

              if (transactions.isEmpty)
                ArcadeCard(
                  fillColor: ArcadeTheme.darkCard,
                  padding: const EdgeInsets.all(28),
                  child: const Center(
                    child: Text(
                      'No transactions recorded yet.',
                      style: TextStyle(
                        color: ArcadeTheme.slateMuted,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                )
              else
                ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: transactions.take(5).length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, idx) {
                    final tx = transactions[idx];
                    final amt = (tx['amount'] ?? 0.0).toDouble();
                    final type = tx['type'] ?? 'expense';
                    final title = tx['title'] ?? 'Transaction';
                    final importance = tx['importance'] ?? 'essential';

                    return ArcadeCard(
                      fillColor: ArcadeTheme.darkCard,
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: type == 'income'
                                  ? ArcadeTheme.arcadeGreen
                                  : ArcadeTheme.punchPink,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: ArcadeTheme.pureBlack, width: 1.5),
                            ),
                            child: Icon(
                              type == 'income'
                                  ? Icons.arrow_downward_rounded
                                  : Icons.arrow_upward_rounded,
                              color: type == 'income'
                                  ? ArcadeTheme.pureBlack
                                  : ArcadeTheme.pureWhite,
                              size: 16,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  title,
                                  style: const TextStyle(
                                    color: ArcadeTheme.pureWhite,
                                    fontWeight: FontWeight.w800,
                                    fontSize: 14,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Row(
                                  children: [
                                    ArcadeBadge.transactionType(type),
                                    const SizedBox(width: 6),
                                    if (type == 'expense')
                                      ArcadeBadge.importance(importance),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          Text(
                            '${type == 'income' ? '+' : '-'}₹ ${amt.toStringAsFixed(2)}',
                            style: TextStyle(
                              color: type == 'income'
                                  ? ArcadeTheme.arcadeGreen
                                  : ArcadeTheme.punchPink,
                              fontWeight: FontWeight.w900,
                              fontSize: 15,
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
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: ArcadeTheme.darkCard,
          border: Border(
            top: BorderSide(color: ArcadeTheme.pureBlack, width: 2.5),
          ),
        ),
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _buildNavButton(
              icon: Icons.dashboard_rounded,
              label: 'Dashboard',
              index: 0,
            ),
            _buildNavButton(
              icon: Icons.qr_code_scanner_rounded,
              label: 'Pay',
              index: 1,
            ),
            _buildNavButton(
              icon: Icons.add_circle_rounded,
              label: 'Add',
              index: 2,
              highlightColor: ArcadeTheme.acidYellow,
            ),
            _buildNavButton(
              icon: Icons.lock_clock_rounded,
              label: 'Audit',
              index: 3,
            ),
            _buildNavButton(
              icon: Icons.tune_rounded,
              label: 'Setup',
              index: 4,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAvatarFallback(String? name) {
    return Container(
      color: ArcadeTheme.acidYellow,
      alignment: Alignment.center,
      child: Text(
        name != null && name.isNotEmpty ? name[0].toUpperCase() : 'U',
        style: const TextStyle(
          color: ArcadeTheme.pureBlack,
          fontWeight: FontWeight.w900,
          fontSize: 16,
        ),
      ),
    );
  }

  Widget _buildNavButton({
    required IconData icon,
    required String label,
    required int index,
    Color? highlightColor,
  }) {
    final isSelected = _currentNavIndex == index;
    return GestureDetector(
      onTap: () => _onBottomNavTap(index),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              color: isSelected
                  ? ArcadeTheme.acidYellow
                  : (highlightColor ?? ArcadeTheme.slateMuted),
              size: 24,
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                color: isSelected
                    ? ArcadeTheme.acidYellow
                    : (highlightColor ?? ArcadeTheme.slateMuted),
                fontWeight: FontWeight.w900,
                fontSize: 10,
                letterSpacing: 0.3,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
