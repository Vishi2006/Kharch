import 'package:flutter/material.dart';
import '../providers/app_state.dart';
import '../theme/arcade_theme.dart';
import '../widgets/arcade_button.dart';
import '../widgets/arcade_card.dart';

class ReconcileScreen extends StatefulWidget {
  final AppState appState;

  const ReconcileScreen({super.key, required this.appState});

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
    }
  }

  @override
  Widget build(BuildContext context) {
    final summary = widget.appState.summaryData;
    final opening = (summary?['openingBalance'] ?? 0.0).toDouble();
    final calculated = (summary?['calculatedClosingBalance'] ?? 0.0).toDouble();
    final actual = summary?['actualClosingBalance'] != null
        ? (summary!['actualClosingBalance'] as num).toDouble()
        : null;
    final isLocked = summary?['isLocked'] == true;

    final discrepancy = actual != null ? actual - calculated : 0.0;

    return Scaffold(
      backgroundColor: ArcadeTheme.darkCanvas,
      appBar: AppBar(
        backgroundColor: ArcadeTheme.darkCanvas,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: ArcadeTheme.pureWhite),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'MONTHLY AUDIT',
          style: TextStyle(
            color: ArcadeTheme.acidYellow,
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
              // Vault Status Card
              ArcadeCard(
                fillColor: isLocked ? ArcadeTheme.darkCardLight : ArcadeTheme.acidYellow,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          isLocked ? 'STATUS: RECONCILED' : 'STATUS: ACTIVE',
                          style: TextStyle(
                            color: isLocked ? ArcadeTheme.neonCyan : ArcadeTheme.pureBlack,
                            fontWeight: FontWeight.w900,
                            fontSize: 12,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          isLocked
                              ? 'Closing balance is reconciled'
                              : 'Reconcile actual vs ledger balance',
                          style: TextStyle(
                            color: isLocked ? ArcadeTheme.slateMuted : ArcadeTheme.pureBlack,
                            fontWeight: FontWeight.w700,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                    Icon(
                      isLocked ? Icons.lock_rounded : Icons.lock_open_rounded,
                      color: isLocked ? ArcadeTheme.arcadeGreen : ArcadeTheme.pureBlack,
                      size: 28,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Balances Breakdown
              ArcadeCard(
                fillColor: ArcadeTheme.darkCard,
                child: Column(
                  children: [
                    _buildBalanceRow('Opening Balance', '₹ ${opening.toStringAsFixed(2)}'),
                    const Divider(color: ArcadeTheme.pureBlack, thickness: 1.5, height: 20),
                    _buildBalanceRow('Calculated Ledger', '₹ ${calculated.toStringAsFixed(2)}'),
                    if (actual != null) ...[
                      const Divider(color: ArcadeTheme.pureBlack, thickness: 1.5, height: 20),
                      _buildBalanceRow('Actual Bank Closing', '₹ ${actual.toStringAsFixed(2)}'),
                      const Divider(color: ArcadeTheme.pureBlack, thickness: 1.5, height: 20),
                      _buildBalanceRow(
                        'Audit Discrepancy',
                        '₹ ${discrepancy.toStringAsFixed(2)}',
                        valueColor: discrepancy.abs() < 1.0
                            ? ArcadeTheme.arcadeGreen
                            : ArcadeTheme.punchPink,
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 18),

              // Set Opening Balance
              if (!isLocked) ...[
                const Text(
                  'UPDATE OPENING BALANCE',
                  style: TextStyle(
                    color: ArcadeTheme.pureWhite,
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
                            color: ArcadeTheme.pureWhite, fontWeight: FontWeight.w900),
                        decoration: InputDecoration(
                          hintText: '₹ Opening Balance',
                          hintStyle: const TextStyle(color: ArcadeTheme.slateMuted),
                          filled: true,
                          fillColor: ArcadeTheme.darkCard,
                          contentPadding:
                              const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
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
                    color: ArcadeTheme.pureWhite,
                    fontWeight: FontWeight.w900,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _closingCtrl,
                  keyboardType: TextInputType.number,
                  style: const TextStyle(
                      color: ArcadeTheme.pureWhite, fontWeight: FontWeight.w900),
                  decoration: InputDecoration(
                    hintText: 'Enter bank account closing balance (₹)',
                    hintStyle: const TextStyle(color: ArcadeTheme.slateMuted),
                    filled: true,
                    fillColor: ArcadeTheme.darkCard,
                    contentPadding:
                        const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: ArcadeTheme.pureBlack, width: 2),
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

  Widget _buildBalanceRow(String label, String value, {Color? valueColor}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: ArcadeTheme.slateMuted,
            fontWeight: FontWeight.w700,
            fontSize: 13,
          ),
        ),
        Text(
          value,
          style: TextStyle(
            color: valueColor ?? ArcadeTheme.pureWhite,
            fontWeight: FontWeight.w900,
            fontSize: 15,
          ),
        ),
      ],
    );
  }
}
