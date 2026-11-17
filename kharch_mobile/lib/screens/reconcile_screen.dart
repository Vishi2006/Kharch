import 'package:flutter/material.dart';
import '../providers/app_state.dart';
import '../theme/arcade_theme.dart';
import '../widgets/arcade_button.dart';
import '../widgets/arcade_card.dart';

class ReconcileScreen extends StatefulWidget {
  final AppState appState;
  final bool isEmbedded;

  const ReconcileScreen({super.key, required this.appState, this.isEmbedded = false});

  @override
  State<ReconcileScreen> createState() => _ReconcileScreenState();
}

class _ReconcileScreenState extends State<ReconcileScreen> {
  final TextEditingController _openingCtrl = TextEditingController();
  final TextEditingController _closingCtrl = TextEditingController();
  bool _isSavingOpening = false;
  bool _isLockingMonth = false;

  @override
  void initState() {
    super.initState();
    widget.appState.refreshSummary();
  }

  @override
  void dispose() {
    _openingCtrl.dispose();
    _closingCtrl.dispose();
    super.dispose();
  }

  void _handleSaveOpening() async {
    final amt = double.tryParse(_openingCtrl.text);
    if (amt == null) return;

    setState(() => _isSavingOpening = true);
    await widget.appState.setOpeningBalance(amt);
    if (mounted) {
      _openingCtrl.clear();
      setState(() => _isSavingOpening = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('OPENING BALANCE UPDATED', style: TextStyle(fontWeight: FontWeight.w900, color: ArcadeTheme.pureBlack)),
          backgroundColor: ArcadeTheme.arcadeGreen,
          duration: Duration(seconds: 1),
        ),
      );
    }
  }

  void _handleLockMonth() async {
    final amt = double.tryParse(_closingCtrl.text);
    if (amt == null) return;

    setState(() => _isLockingMonth = true);
    await widget.appState.finalizeClosingBalance(amt);
    if (mounted) {
      _closingCtrl.clear();
      setState(() => _isLockingMonth = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('MONTH-END RECONCILED & SEALED', style: TextStyle(fontWeight: FontWeight.w900, color: ArcadeTheme.pureBlack)),
          backgroundColor: ArcadeTheme.arcadeGreen,
          duration: Duration(seconds: 1),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final summary = widget.appState.summaryData;
    final data = widget.appState.dashboardData;
    final opening = (summary?['openingBalance'] ?? 0.0).toDouble();
    final calculated = (summary?['calculatedClosingBalance'] ?? 0.0).toDouble();
    final currentBalance = (data?['currentBalance'] ?? data?['netBalance'] ?? calculated).toDouble();
    final actual = summary?['actualClosingBalance'] != null
        ? (summary!['actualClosingBalance'] as num).toDouble()
        : null;
    final isLocked = summary?['isLocked'] == true;

    final discrepancy = actual != null ? actual - calculated : 0.0;

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
        title: const Text(
          'MONTHLY AUDIT & BALANCE',
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
              // 1. Expected Current Balance Card (Private Vault)
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
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: ArcadeTheme.pureBlack,
                            borderRadius: BorderRadius.circular(ArcadeTheme.pillRadius),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.shield_rounded, size: 12, color: ArcadeTheme.acidYellow),
                              SizedBox(width: 4),
                              Text(
                                'PRIVATE VAULT',
                                style: TextStyle(
                                  color: ArcadeTheme.acidYellow,
                                  fontSize: 9,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '₹ ${currentBalance.toStringAsFixed(2)}',
                      style: ArcadeTheme.arcadeScore.copyWith(fontSize: 30),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Protected balance view. Not visible on home scan screen.',
                      style: TextStyle(
                        color: ArcadeTheme.pureBlack,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // 2. Vault Status Card (Light Neo-Brutalist)
              ArcadeCard(
                fillColor: isLocked ? ArcadeTheme.cardWhite : ArcadeTheme.cardWhite,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          isLocked ? 'STATUS: RECONCILED' : 'STATUS: ACTIVE',
                          style: TextStyle(
                            color: isLocked ? ArcadeTheme.arcadeGreen : ArcadeTheme.punchPink,
                            fontWeight: FontWeight.w900,
                            fontSize: 12,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          isLocked
                              ? 'Closing balance is reconciled'
                              : 'Reconcile actual vs ledger balance',
                          style: const TextStyle(
                            color: ArcadeTheme.pureBlack,
                            fontWeight: FontWeight.w800,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                    Icon(
                      isLocked ? Icons.lock_rounded : Icons.lock_open_rounded,
                      color: isLocked ? ArcadeTheme.arcadeGreen : ArcadeTheme.punchPink,
                      size: 28,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // 3. Balances Breakdown (Punch Pink Card)
              ArcadeCard(
                fillColor: ArcadeTheme.punchPink,
                child: Column(
                  children: [
                    _buildBalanceRow('Opening Balance', '₹ ${opening.toStringAsFixed(2)}', isPinkBg: true),
                    const Divider(color: ArcadeTheme.pureBlack, thickness: 1.5, height: 20),
                    _buildBalanceRow('Calculated Ledger', '₹ ${calculated.toStringAsFixed(2)}', isPinkBg: true),
                    if (actual != null) ...[
                      const Divider(color: ArcadeTheme.pureBlack, thickness: 1.5, height: 20),
                      _buildBalanceRow('Actual Bank Closing', '₹ ${actual.toStringAsFixed(2)}', isPinkBg: true),
                      const Divider(color: ArcadeTheme.pureBlack, thickness: 1.5, height: 20),
                      _buildBalanceRow(
                        'Audit Discrepancy',
                        '₹ ${discrepancy.toStringAsFixed(2)}',
                        valueColor: discrepancy.abs() < 1.0
                            ? ArcadeTheme.arcadeGreen
                            : ArcadeTheme.pureWhite,
                        isPinkBg: true,
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 18),

              // 4. Set Opening Balance (Light Inputs)
              if (!isLocked) ...[
                const Text(
                  'UPDATE OPENING BALANCE',
                  style: TextStyle(
                    color: ArcadeTheme.pureBlack,
                    fontWeight: FontWeight.w900,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _openingCtrl,
                        keyboardType: TextInputType.number,
                        style: const TextStyle(
                            color: ArcadeTheme.pureBlack, fontWeight: FontWeight.w900),
                        decoration: InputDecoration(
                          hintText: '₹ Opening Balance',
                          hintStyle: const TextStyle(color: ArcadeTheme.slateMuted),
                          filled: true,
                          fillColor: ArcadeTheme.cardWhite,
                          contentPadding:
                              const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide:
                                const BorderSide(color: ArcadeTheme.pureBlack, width: 2),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide:
                                const BorderSide(color: ArcadeTheme.pureBlack, width: 2),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide:
                                const BorderSide(color: ArcadeTheme.punchPink, width: 2),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    ArcadeButton(
                      text: 'SAVE',
                      height: 48,
                      backgroundColor: ArcadeTheme.acidYellow,
                      textColor: ArcadeTheme.pureBlack,
                      isLoading: _isSavingOpening,
                      loadingText: 'Saving...',
                      onTap: _handleSaveOpening,
                    ),
                  ],
                ),
                const SizedBox(height: 24),

                // Seal Month / Closing Balance
                const Text(
                  'SEAL MONTH-END CLOSING BALANCE',
                  style: TextStyle(
                    color: ArcadeTheme.pureBlack,
                    fontWeight: FontWeight.w900,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _closingCtrl,
                  keyboardType: TextInputType.number,
                  style: const TextStyle(
                      color: ArcadeTheme.pureBlack, fontWeight: FontWeight.w900),
                  decoration: InputDecoration(
                    hintText: 'Enter bank account closing balance (₹)',
                    hintStyle: const TextStyle(color: ArcadeTheme.slateMuted),
                    filled: true,
                    fillColor: ArcadeTheme.cardWhite,
                    contentPadding:
                        const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: ArcadeTheme.pureBlack, width: 2),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: ArcadeTheme.pureBlack, width: 2),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: ArcadeTheme.punchPink, width: 2),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                ArcadeButton(
                  text: 'LOCK & RECONCILE LEDGER',
                  icon: Icons.verified_rounded,
                  backgroundColor: ArcadeTheme.arcadeGreen,
                  textColor: ArcadeTheme.pureBlack,
                  isLoading: _isLockingMonth,
                  loadingText: 'Reconciling Ledger...',
                  onTap: _handleLockMonth,
                  width: double.infinity,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBalanceRow(String label, String value, {Color? valueColor, bool isPinkBg = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            color: isPinkBg ? ArcadeTheme.pureWhite : ArcadeTheme.slateDark,
            fontWeight: FontWeight.w800,
            fontSize: 13,
          ),
        ),
        Text(
          value,
          style: TextStyle(
            color: valueColor ?? (isPinkBg ? ArcadeTheme.acidYellow : ArcadeTheme.pureBlack),
            fontWeight: FontWeight.w900,
            fontSize: 15,
          ),
        ),
      ],
    );
  }
}
