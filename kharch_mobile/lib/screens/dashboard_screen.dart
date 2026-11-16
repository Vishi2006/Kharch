import 'package:flutter/material.dart';
import '../providers/app_state.dart';
import '../theme/arcade_theme.dart';
import '../widgets/arcade_badge.dart';
import '../widgets/arcade_button.dart';
import '../widgets/arcade_card.dart';
import '../widgets/kharch_logo.dart';
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
  String _selectedMatrix = 'day'; // 'day' | 'week' | 'month' | 'year'
  bool _isQuickAdding = false;
  final TextEditingController _quickAmountCtrl = TextEditingController();
  final TextEditingController _quickTitleCtrl = TextEditingController();

  @override
  void dispose() {
    _quickAmountCtrl.dispose();
    _quickTitleCtrl.dispose();
    super.dispose();
  }

  void _handleQuickAdd() async {
    final amount = double.tryParse(_quickAmountCtrl.text);
    final title = _quickTitleCtrl.text.trim();

    if (amount == null || title.isEmpty) return;

    setState(() => _isQuickAdding = true);

    await widget.appState.addTransaction(
      amount: amount,
      title: title,
      type: 'expense',
      importance: 'essential',
    );

    if (mounted) {
      _quickAmountCtrl.clear();
      _quickTitleCtrl.clear();
      setState(() => _isQuickAdding = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = widget.appState.dashboardData;
    final activeSpace = widget.appState.activeSpace;
    final spaces = widget.appState.spaces;
    final unreadInbox = widget.appState.inboxData?['unreadCount'] ?? 0;

    final balance = (data?['netBalance'] ?? 0.0).toDouble();
    final expense = (data?['monthlyExpense'] ?? 0.0).toDouble();
    final income = (data?['monthlyIncome'] ?? 0.0).toDouble();
    final transactions = (data?['recentTransactions'] as List?) ?? [];

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
                const Text(
                  'KHARCH ARCADE',
                  style: TextStyle(
                    color: ArcadeTheme.acidYellow,
                    fontWeight: FontWeight.w900,
                    fontSize: 16,
                    letterSpacing: 0.8,
                  ),
                ),
                Text(
                  activeSpace?['name'] ?? 'Vault',
                  style: const TextStyle(
                    color: ArcadeTheme.slateMuted,
                    fontWeight: FontWeight.w700,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: [
          // Auto-Sync Status Indicator
          GestureDetector(
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => SettingsScreen(appState: widget.appState)),
              );
            },
            child: Container(
              margin: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: widget.appState.isNotificationListenerGranted
                    ? ArcadeTheme.arcadeGreen
                    : ArcadeTheme.punchPink,
                borderRadius: BorderRadius.circular(ArcadeTheme.pillRadius),
                border: Border.all(color: ArcadeTheme.pureBlack, width: 2),
                boxShadow: ArcadeTheme.neoShadow(offset: const Offset(2, 2)),
              ),
              child: Row(
                children: [
                  Icon(
                    widget.appState.isNotificationListenerGranted
                        ? Icons.bolt_rounded
                        : Icons.warning_amber_rounded,
                    color: ArcadeTheme.pureBlack,
                    size: 14,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    widget.appState.isNotificationListenerGranted ? 'AUTO-SYNC' : 'SETUP',
                    style: const TextStyle(
                      color: ArcadeTheme.pureBlack,
                      fontWeight: FontWeight.w900,
                      fontSize: 10,
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
            ),
          ),
          // Inbox Icon with Unread Badge
          IconButton(
            icon: Stack(
              clipBehavior: Clip.none,
              children: [
                const Icon(Icons.inbox_rounded, color: ArcadeTheme.pureWhite, size: 26),
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

              // Net Score / Balance High-Score Card
              ArcadeCard(
                fillColor: ArcadeTheme.acidYellow,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          '★ NET VAULT BALANCE ★',
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
                              'AUDIT VAULT 🔒',
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
                    const SizedBox(height: 12),
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

              // Quick Add Bar with Cute Tap Loading
              ArcadeCard(
                fillColor: ArcadeTheme.darkCard,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      '⚡ FAST ARCADE ADD',
                      style: TextStyle(
                        color: ArcadeTheme.neonCyan,
                        fontWeight: FontWeight.w900,
                        fontSize: 12,
                        letterSpacing: 0.6,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          flex: 3,
                          child: TextField(
                            controller: _quickAmountCtrl,
                            keyboardType: TextInputType.number,
                            style: const TextStyle(
                                color: ArcadeTheme.pureWhite, fontWeight: FontWeight.w900),
                            decoration: InputDecoration(
                              hintText: '₹ Amount',
                              hintStyle: const TextStyle(color: ArcadeTheme.slateMuted),
                              filled: true,
                              fillColor: ArcadeTheme.darkCardLight,
                              contentPadding:
                                  const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(8),
                                borderSide:
                                    const BorderSide(color: ArcadeTheme.pureBlack, width: 2),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          flex: 4,
                          child: TextField(
                            controller: _quickTitleCtrl,
                            style: const TextStyle(
                                color: ArcadeTheme.pureWhite, fontWeight: FontWeight.w700),
                            decoration: InputDecoration(
                              hintText: 'e.g. Coffee',
                              hintStyle: const TextStyle(color: ArcadeTheme.slateMuted),
                              filled: true,
                              fillColor: ArcadeTheme.darkCardLight,
                              contentPadding:
                                  const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
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
                          height: 44,
                          fontSize: 12,
                          backgroundColor: ArcadeTheme.acidYellow,
                          textColor: ArcadeTheme.pureBlack,
                          isLoading: _isQuickAdding,
                          loadingText: 'Saving...',
                          onTap: _handleQuickAdd,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // 4x Comparative Matrix Controls (Day / Week / Month / Year)
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'COMPARATIVE LEDGER',
                    style: TextStyle(
                      color: ArcadeTheme.pureWhite,
                      fontWeight: FontWeight.w900,
                      fontSize: 14,
                      letterSpacing: 0.6,
                    ),
                  ),
                  Container(
                    decoration: BoxDecoration(
                      color: ArcadeTheme.darkCardLight,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: ArcadeTheme.pureBlack, width: 2),
                    ),
                    child: Row(
                      children: ['day', 'week', 'month', 'year'].map((p) {
                        final isSel = _selectedMatrix == p;
                        return GestureDetector(
                          onTap: () => setState(() => _selectedMatrix = p),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: isSel ? ArcadeTheme.acidYellow : Colors.transparent,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              p.toUpperCase(),
                              style: TextStyle(
                                color: isSel ? ArcadeTheme.pureBlack : ArcadeTheme.slateMuted,
                                fontWeight: FontWeight.w900,
                                fontSize: 11,
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Ledger Transactions List
              if (transactions.isEmpty)
                ArcadeCard(
                  fillColor: ArcadeTheme.darkCard,
                  padding: const EdgeInsets.all(28),
                  child: Center(
                    child: Column(
                      children: [
                        const KharchLogo(size: 48, showShadow: false),
                        const SizedBox(height: 12),
                        const Text(
                          'NO TRANSACTIONS YET',
                          style: TextStyle(
                            color: ArcadeTheme.pureWhite,
                            fontWeight: FontWeight.w900,
                            fontSize: 14,
                          ),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Add an expense or scan a QR code to start',
                          style: TextStyle(
                            color: ArcadeTheme.slateMuted,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                )
              else
                ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: transactions.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, idx) {
                    final tx = transactions[idx];
                    final amt = (tx['amount'] ?? 0.0).toDouble();
                    final type = tx['type'] ?? 'expense';
                    final title = tx['title'] ?? 'Untitled';
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
                            '₹ ${amt.toStringAsFixed(2)}',
                            style: TextStyle(
                              color: type == 'income'
                                  ? ArcadeTheme.arcadeGreen
                                  : ArcadeTheme.pureWhite,
                              fontWeight: FontWeight.w900,
                              fontSize: 15,
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
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
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _buildNavButton(
              icon: Icons.dashboard_rounded,
              label: 'DASH',
              isSelected: true,
              onTap: () {},
            ),
            _buildNavButton(
              icon: Icons.qr_code_scanner_rounded,
              label: 'PAY',
              isSelected: false,
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => QrPayScreen(appState: widget.appState)),
                );
              },
            ),
            _buildNavButton(
              icon: Icons.add_circle_rounded,
              label: 'ADD',
              isSelected: false,
              highlightColor: ArcadeTheme.acidYellow,
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => AddTransactionScreen(appState: widget.appState),
                  ),
                );
              },
            ),
            _buildNavButton(
              icon: Icons.lock_clock_rounded,
              label: 'AUDIT',
              isSelected: false,
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => ReconcileScreen(appState: widget.appState),
                  ),
                );
              },
            ),
            _buildNavButton(
              icon: Icons.tune_rounded,
              label: 'SETUP',
              isSelected: false,
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => SettingsScreen(appState: widget.appState),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildNavButton({
    required IconData icon,
    required String label,
    required bool isSelected,
    required VoidCallback onTap,
    Color? highlightColor,
  }) {
    return GestureDetector(
      onTap: onTap,
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
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }
}
