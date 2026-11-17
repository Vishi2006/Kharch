import 'package:flutter/services.dart';
import 'package:flutter/material.dart';
import '../providers/app_state.dart';
import '../theme/arcade_theme.dart';
import '../widgets/arcade_card.dart';

class AnalyticsScreen extends StatefulWidget {
  final AppState appState;
  final bool isEmbedded;

  const AnalyticsScreen({super.key, required this.appState, this.isEmbedded = false});

  @override
  State<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends State<AnalyticsScreen> {
  String _selectedPeriod = 'month'; // 'day' | 'week' | 'month' | 'year'

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  void _loadData() {
    widget.appState.fetchAnalytics(_selectedPeriod);
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.appState,
      builder: (context, _) {
        final activeSpace = widget.appState.activeSpace;
        final analytics = widget.appState.analyticsData;
        final isLoading = widget.appState.isAnalyticsLoading;

        final trends = (analytics?['trends'] as List?) ?? [];
        final importanceList = (analytics?['importance'] as List?) ?? [];
        final topTitles = (analytics?['topSpendingTitles'] as List?) ?? [];
        final wasteful = (analytics?['repeatedWasteful'] as List?) ?? [];

        double totalSpent = 0;
        double totalEarned = 0;
        for (final t in trends) {
          totalSpent += (t['spent'] ?? 0).toDouble();
          totalEarned += (t['earned'] ?? 0).toDouble();
        }
        final netCashflow = totalEarned - totalSpent;

        double essentialVal = 0;
        double moderateVal = 0;
        double lowVal = 0;
        for (final imp in importanceList) {
          final name = imp['name']?.toString().toLowerCase() ?? '';
          final val = (imp['value'] ?? 0).toDouble();
          if (name == 'essential') essentialVal = val;
          if (name == 'moderate') moderateVal = val;
          if (name == 'low_value' || name == 'low') lowVal = val;
        }
        final totalImportance = essentialVal + moderateVal + lowVal;

        final dayTxCount = (analytics?['dayTransactionCount'] as num?)?.toInt() ??
            (widget.appState.dashboardData?['todaySpent'] != null && (widget.appState.dashboardData?['todaySpent'] as num) > 0 ? 1 : 0);
        final todaySpentDay = (widget.appState.dashboardData?['todaySpent'] as num?)?.toDouble() ?? 0.0;

        return Scaffold(
          backgroundColor: ArcadeTheme.lightCanvas,
          appBar: AppBar(
            backgroundColor: ArcadeTheme.lightCanvas,
            elevation: 0,
            automaticallyImplyLeading: false,
            leading: widget.isEmbedded
                ? null
                : IconButton(
                    icon: const Icon(Icons.arrow_back_rounded, color: ArcadeTheme.pureBlack),
                    onPressed: () => Navigator.pop(context),
                  ),
            title: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'ANALYTICS & TRENDS',
                  style: TextStyle(
                    color: ArcadeTheme.pureBlack,
                    fontWeight: FontWeight.w900,
                    fontSize: 16,
                    letterSpacing: 0.8,
                  ),
                ),
                Text(
                  activeSpace?['name'] ?? 'Personal Life',
                  style: const TextStyle(
                    color: ArcadeTheme.slateDark,
                    fontWeight: FontWeight.w700,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
          body: SafeArea(
            child: RefreshIndicator(
              onRefresh: () async => _loadData(),
              color: ArcadeTheme.punchPink,
              backgroundColor: ArcadeTheme.cardWhite,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Period Switcher (Day, Week, Month, Year) - Neo-Brutalist Light
                    Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: ArcadeTheme.cardWhite,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: ArcadeTheme.pureBlack, width: 2),
                        boxShadow: ArcadeTheme.neoShadow(offset: const Offset(2, 2)),
                      ),
                      child: Row(
                        children: [
                          _buildPeriodTab('day', 'DAY'),
                          _buildPeriodTab('week', 'WEEK'),
                          _buildPeriodTab('month', 'MONTH'),
                          _buildPeriodTab('year', 'YEAR'),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    if (isLoading)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 40),
                        child: Center(
                          child: CircularProgressIndicator(color: ArcadeTheme.punchPink),
                        ),
                      )
                    else ...[
                      // 1. Day View: Total Transactions on that Day
                      if (_selectedPeriod == 'day') ...[
                        ArcadeCard(
                          fillColor: ArcadeTheme.punchPink,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  const Text(
                                    "TODAY'S ACTIVITY",
                                    style: TextStyle(
                                      color: ArcadeTheme.pureWhite,
                                      fontWeight: FontWeight.w900,
                                      fontSize: 12,
                                      letterSpacing: 0.8,
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: ArcadeTheme.acidYellow,
                                      borderRadius: BorderRadius.circular(6),
                                      border: Border.all(color: ArcadeTheme.pureBlack, width: 1.5),
                                    ),
                                    child: Text(
                                      '$dayTxCount ${dayTxCount == 1 ? 'TRANSACTION' : 'TRANSACTIONS'}',
                                      style: const TextStyle(
                                        color: ArcadeTheme.pureBlack,
                                        fontWeight: FontWeight.w900,
                                        fontSize: 9,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              Row(
                                children: [
                                  Expanded(
                                    child: Container(
                                      padding: const EdgeInsets.all(12),
                                      decoration: BoxDecoration(
                                        color: ArcadeTheme.pureBlack,
                                        borderRadius: BorderRadius.circular(8),
                                        border: Border.all(color: ArcadeTheme.pureBlack, width: 1.5),
                                      ),
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          const Text(
                                            'TOTAL TRANSACTIONS',
                                            style: TextStyle(
                                              color: ArcadeTheme.pureWhite,
                                              fontWeight: FontWeight.w800,
                                              fontSize: 9,
                                            ),
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            '$dayTxCount',
                                            style: const TextStyle(
                                              color: ArcadeTheme.acidYellow,
                                              fontWeight: FontWeight.w900,
                                              fontSize: 22,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Container(
                                      padding: const EdgeInsets.all(12),
                                      decoration: BoxDecoration(
                                        color: ArcadeTheme.pureBlack,
                                        borderRadius: BorderRadius.circular(8),
                                        border: Border.all(color: ArcadeTheme.pureBlack, width: 1.5),
                                      ),
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          const Text(
                                            'TOTAL SPENT TODAY',
                                            style: TextStyle(
                                              color: ArcadeTheme.pureWhite,
                                              fontWeight: FontWeight.w800,
                                              fontSize: 9,
                                            ),
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            '₹ ${todaySpentDay.toStringAsFixed(0)}',
                                            style: const TextStyle(
                                              color: ArcadeTheme.arcadeGreen,
                                              fontWeight: FontWeight.w900,
                                              fontSize: 22,
                                            ),
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
                      ],

                      // 2. Month View Only: Current Month Cashflow Summary Card (Punch Pink Neo-Brutal)
                      if (_selectedPeriod == 'month') ...[
                        ArcadeCard(
                          fillColor: ArcadeTheme.punchPink,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  const Text(
                                    'CURRENT MONTH CASHFLOW',
                                    style: TextStyle(
                                      color: ArcadeTheme.pureWhite,
                                      fontWeight: FontWeight.w900,
                                      fontSize: 12,
                                      letterSpacing: 0.6,
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: ArcadeTheme.punchPink,
                                      borderRadius: BorderRadius.circular(6),
                                      border: Border.all(color: ArcadeTheme.pureBlack, width: 1.5),
                                    ),
                                    child: Text(
                                      netCashflow >= 0 ? 'NET SAVINGS' : 'NET DEFICIT',
                                      style: const TextStyle(
                                        color: ArcadeTheme.pureWhite,
                                        fontWeight: FontWeight.w900,
                                        fontSize: 9,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              Row(
                                children: [
                                  Expanded(
                                    child: _buildMetricTile(
                                      label: 'EARNED',
                                      amount: totalEarned,
                                      color: ArcadeTheme.arcadeGreen,
                                      icon: Icons.trending_up_rounded,
                                      backgroundColor: ArcadeTheme.pureBlack,
                                      textColor: ArcadeTheme.pureWhite,
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: _buildMetricTile(
                                      label: 'SPENT',
                                      amount: totalSpent,
                                      color: ArcadeTheme.acidYellow,
                                      icon: Icons.trending_down_rounded,
                                      backgroundColor: ArcadeTheme.pureBlack,
                                      textColor: ArcadeTheme.pureWhite,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],

                      // 3. Spending vs Earning Chart (Cream White Card)
                      ArcadeCard(
                        fillColor: ArcadeTheme.creamWhite,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                const Text(
                                  'SPENDING VS EARNING',
                                  style: TextStyle(
                                    color: ArcadeTheme.pureBlack,
                                    fontWeight: FontWeight.w900,
                                    fontSize: 12,
                                    letterSpacing: 0.6,
                                  ),
                                ),
                                Row(
                                  children: [
                                    _buildLegendDot('Spent', ArcadeTheme.punchPink),
                                    const SizedBox(width: 10),
                                    _buildLegendDot('Earned', ArcadeTheme.arcadeGreen),
                                  ],
                                ),
                              ],
                            ),
                            const SizedBox(height: 16),
                            if (trends.isEmpty)
                              const Padding(
                                padding: EdgeInsets.symmetric(vertical: 24),
                                child: Center(
                                  child: Text(
                                    'No trend data recorded for this period',
                                    style: TextStyle(color: ArcadeTheme.slateDark, fontSize: 12, fontWeight: FontWeight.w700),
                                  ),
                                ),
                              )
                            else
                              SizedBox(
                                height: 160,
                                child: _buildTrendsBarChart(trends),
                              ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),

                      // 4. Importance Breakdown (Cream White Card)
                      if (totalImportance > 0) ...[
                        ArcadeCard(
                          fillColor: ArcadeTheme.creamWhite,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'SPENDING BY IMPORTANCE',
                                style: TextStyle(
                                  color: ArcadeTheme.pureBlack,
                                  fontWeight: FontWeight.w900,
                                  fontSize: 12,
                                  letterSpacing: 0.6,
                                ),
                              ),
                              const SizedBox(height: 12),
                              ClipRRect(
                                borderRadius: BorderRadius.circular(6),
                                child: SizedBox(
                                  height: 12,
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
                              const SizedBox(height: 14),
                              Row(
                                children: [
                                  Expanded(
                                    child: _buildImportanceItem(
                                      'Essential',
                                      essentialVal,
                                      totalImportance,
                                      ArcadeTheme.arcadeGreen,
                                    ),
                                  ),
                                  const SizedBox(width: 6),
                                  Expanded(
                                    child: _buildImportanceItem(
                                      'Moderate',
                                      moderateVal,
                                      totalImportance,
                                      ArcadeTheme.acidYellow,
                                    ),
                                  ),
                                  const SizedBox(width: 6),
                                  Expanded(
                                    child: _buildImportanceItem(
                                      'Low Value',
                                      lowVal,
                                      totalImportance,
                                      ArcadeTheme.punchPink,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],

                      // 5. Top Spending Categories (Cream White Cards)
                      if (topTitles.isNotEmpty) ...[
                        const Text(
                          'TOP SPENDING CATEGORIES',
                          style: TextStyle(
                            color: ArcadeTheme.pureBlack,
                            fontWeight: FontWeight.w900,
                            fontSize: 13,
                            letterSpacing: 0.6,
                          ),
                        ),
                        const SizedBox(height: 8),
                        ListView.separated(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: topTitles.length > 5 ? 5 : topTitles.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 8),
                          itemBuilder: (context, idx) {
                            final item = topTitles[idx];
                            final name = item['name'] ?? 'Category';
                            final amount = (item['amount'] ?? 0.0).toDouble();
                            final pct = totalSpent > 0 ? (amount / totalSpent) * 100 : 0.0;
                            return Container(
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                              decoration: BoxDecoration(
                                color: ArcadeTheme.creamWhite,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: ArcadeTheme.pureBlack, width: 2),
                                boxShadow: ArcadeTheme.neoShadow(offset: const Offset(2, 2)),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        name,
                                        style: const TextStyle(
                                          color: ArcadeTheme.pureBlack,
                                          fontWeight: FontWeight.w900,
                                          fontSize: 13,
                                        ),
                                      ),
                                      Text(
                                        '${pct.toStringAsFixed(1)}% of total spending',
                                        style: const TextStyle(
                                          color: ArcadeTheme.slateDark,
                                          fontSize: 10,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ],
                                  ),
                                  Text(
                                    '₹ ${amount.toStringAsFixed(0)}',
                                    style: const TextStyle(
                                      color: ArcadeTheme.punchPink,
                                      fontWeight: FontWeight.w900,
                                      fontSize: 14,
                                    ),
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                        const SizedBox(height: 16),
                      ],

                      // 6. Wasteful / Low-Value Watch (Pink Pastel Card)
                      if (wasteful.isNotEmpty) ...[
                        ArcadeCard(
                          fillColor: const Color(0xFFFFD9E8),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: const [
                                  Icon(Icons.warning_amber_rounded,
                                      color: ArcadeTheme.punchPink, size: 18),
                                  SizedBox(width: 6),
                                  Text(
                                    'REPEATED LOW-VALUE SPENDING',
                                    style: TextStyle(
                                      color: ArcadeTheme.pureBlack,
                                      fontWeight: FontWeight.w900,
                                      fontSize: 12,
                                      letterSpacing: 0.6,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              ...wasteful.take(3).map((w) {
                                final name = w['name'] ?? 'Item';
                                final count = w['count'] ?? 1;
                                final amount = (w['amount'] ?? 0.0).toDouble();
                                return Padding(
                                  padding: const EdgeInsets.symmetric(vertical: 4),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        '$name ($count times)',
                                        style: const TextStyle(
                                          color: ArcadeTheme.pureBlack,
                                          fontWeight: FontWeight.w800,
                                          fontSize: 12,
                                        ),
                                      ),
                                      Text(
                                        '-₹ ${amount.toStringAsFixed(0)}',
                                        style: const TextStyle(
                                          color: ArcadeTheme.punchPink,
                                          fontWeight: FontWeight.w900,
                                          fontSize: 12,
                                        ),
                                      ),
                                    ],
                                  ),
                                );
                              }),
                            ],
                          ),
                        ),
                        const SizedBox(height: 24),
                      ],
                    ],
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildPeriodTab(String period, String label) {
    final isSel = _selectedPeriod == period;
    return Expanded(
      child: GestureDetector(
        onTap: () {
          HapticFeedback.selectionClick();
          setState(() => _selectedPeriod = period);
          _loadData();
        },
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: isSel ? ArcadeTheme.acidYellow : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
            border: isSel ? Border.all(color: ArcadeTheme.pureBlack, width: 1.5) : null,
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: TextStyle(
              color: isSel ? ArcadeTheme.pureBlack : ArcadeTheme.slateDark,
              fontWeight: FontWeight.w900,
              fontSize: 11,
              letterSpacing: 0.5,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildMetricTile({
    required String label,
    required double amount,
    required Color color,
    required IconData icon,
    Color? backgroundColor,
    Color? textColor,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: backgroundColor ?? ArcadeTheme.lightCanvas,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: ArcadeTheme.pureBlack, width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: color, size: 14),
              const SizedBox(width: 4),
              Text(
                label,
                style: TextStyle(
                  color: color,
                  fontWeight: FontWeight.w900,
                  fontSize: 10,
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '₹ ${amount.toStringAsFixed(0)}',
            style: TextStyle(
              color: textColor ?? ArcadeTheme.pureBlack,
              fontWeight: FontWeight.w900,
              fontSize: 16,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLegendDot(String label, Color color) {
    return Row(
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
            border: Border.all(color: ArcadeTheme.pureBlack, width: 1),
          ),
        ),
        const SizedBox(width: 4),
        Text(
          label,
          style: const TextStyle(
            color: ArcadeTheme.pureBlack,
            fontSize: 10,
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    );
  }

  Widget _buildImportanceItem(String label, double val, double total, Color color) {
    final pct = total > 0 ? (val / total * 100).toStringAsFixed(0) : '0';
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: ArcadeTheme.lightCanvas,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: ArcadeTheme.pureBlack, width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(width: 6, height: 6, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  label,
                  style: const TextStyle(
                    color: ArcadeTheme.pureBlack,
                    fontSize: 9,
                    fontWeight: FontWeight.w800,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '₹ ${val.toStringAsFixed(0)}',
            style: const TextStyle(
              color: ArcadeTheme.pureBlack,
              fontWeight: FontWeight.w900,
              fontSize: 11,
            ),
          ),
          Text(
            '$pct%',
            style: const TextStyle(
              color: ArcadeTheme.slateDark,
              fontSize: 9,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTrendsBarChart(List trends) {
    double maxVal = 1;
    for (final t in trends) {
      final spent = (t['spent'] ?? 0).toDouble();
      final earned = (t['earned'] ?? 0).toDouble();
      if (spent > maxVal) maxVal = spent;
      if (earned > maxVal) maxVal = earned;
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        return SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: trends.map((t) {
              final spent = (t['spent'] ?? 0).toDouble();
              final earned = (t['earned'] ?? 0).toDouble();
              final label = (t['label'] ?? '').toString();

              final spentHeight = (spent / maxVal) * (constraints.maxHeight - 28);
              final earnedHeight = (earned / maxVal) * (constraints.maxHeight - 28);

              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 6),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        // Spent Bar
                        Container(
                          width: 14,
                          height: spentHeight < 4 ? 4 : spentHeight,
                          decoration: BoxDecoration(
                            color: ArcadeTheme.punchPink,
                            borderRadius: const BorderRadius.vertical(top: Radius.circular(3)),
                            border: Border.all(color: ArcadeTheme.pureBlack, width: 1),
                          ),
                        ),
                        const SizedBox(width: 3),
                        // Earned Bar
                        Container(
                          width: 14,
                          height: earnedHeight < 4 ? 4 : earnedHeight,
                          decoration: BoxDecoration(
                            color: ArcadeTheme.arcadeGreen,
                            borderRadius: const BorderRadius.vertical(top: Radius.circular(3)),
                            border: Border.all(color: ArcadeTheme.pureBlack, width: 1),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      label,
                      style: const TextStyle(
                        color: ArcadeTheme.pureBlack,
                        fontSize: 9,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
        );
      },
    );
  }
}
