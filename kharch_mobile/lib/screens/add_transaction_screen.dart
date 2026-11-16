import 'package:flutter/material.dart';
import '../providers/app_state.dart';
import '../theme/arcade_theme.dart';
import '../widgets/arcade_button.dart';
import '../widgets/arcade_card.dart';

class AddTransactionScreen extends StatefulWidget {
  final AppState appState;

  const AddTransactionScreen({super.key, required this.appState});

  @override
  State<AddTransactionScreen> createState() => _AddTransactionScreenState();
}

class _AddTransactionScreenState extends State<AddTransactionScreen> {
  String _amountStr = '0';
  String _type = 'expense'; // 'expense' | 'income'
  String _importance = 'essential'; // 'essential' | 'moderate' | 'low'
  String _selectedCategory = 'Food';
  final TextEditingController _customTitleCtrl = TextEditingController();
  bool _isSaving = false;

  final List<Map<String, dynamic>> _categories = [
    {'name': 'Food', 'icon': Icons.restaurant_rounded},
    {'name': 'Transit', 'icon': Icons.directions_car_rounded},
    {'name': 'Coffee', 'icon': Icons.local_cafe_rounded},
    {'name': 'Rent', 'icon': Icons.home_rounded},
    {'name': 'Groceries', 'icon': Icons.shopping_cart_rounded},
    {'name': 'Tech', 'icon': Icons.devices_rounded},
    {'name': 'Health', 'icon': Icons.medical_services_rounded},
    {'name': 'Fun', 'icon': Icons.sports_esports_rounded},
  ];

  @override
  void dispose() {
    _customTitleCtrl.dispose();
    super.dispose();
  }

  void _onKeypadTap(String val) {
    setState(() {
      if (val == 'C') {
        _amountStr = '0';
      } else if (val == '⌫') {
        if (_amountStr.length > 1) {
          _amountStr = _amountStr.substring(0, _amountStr.length - 1);
        } else {
          _amountStr = '0';
        }
      } else if (val == '.') {
        if (!_amountStr.contains('.')) {
          _amountStr += '.';
        }
      } else {
        if (_amountStr == '0') {
          _amountStr = val;
        } else {
          _amountStr += val;
        }
      }
    });
  }

  void _handleSave() async {
    final amount = double.tryParse(_amountStr);
    if (amount == null || amount <= 0) return;

    final title = _customTitleCtrl.text.trim().isNotEmpty
        ? _customTitleCtrl.text.trim()
        : _selectedCategory;

    setState(() => _isSaving = true);

    final success = await widget.appState.addTransaction(
      amount: amount,
      title: title,
      type: _type,
      importance: _importance,
    );

    if (mounted) {
      setState(() => _isSaving = false);
      if (success) {
        Navigator.pop(context);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
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
          'ADD TRANSACTION',
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
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Type Switcher (Expense / Income)
              Row(
                children: [
                  Expanded(
                    child: GestureDetector(
                      onTap: () => setState(() => _type = 'expense'),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        decoration: BoxDecoration(
                          color: _type == 'expense'
                              ? ArcadeTheme.punchPink
                              : ArcadeTheme.darkCard,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: ArcadeTheme.pureBlack, width: 2),
                          boxShadow: _type == 'expense'
                              ? ArcadeTheme.neoShadow(offset: const Offset(2, 2))
                              : null,
                        ),
                        alignment: Alignment.center,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.arrow_upward_rounded,
                              size: 16,
                              color: _type == 'expense'
                                  ? ArcadeTheme.pureWhite
                                  : ArcadeTheme.slateMuted,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              'EXPENSE',
                              style: TextStyle(
                                color: _type == 'expense'
                                    ? ArcadeTheme.pureWhite
                                    : ArcadeTheme.slateMuted,
                                fontWeight: FontWeight.w900,
                                fontSize: 13,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: GestureDetector(
                      onTap: () => setState(() => _type = 'income'),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        decoration: BoxDecoration(
                          color: _type == 'income'
                              ? ArcadeTheme.arcadeGreen
                              : ArcadeTheme.darkCard,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: ArcadeTheme.pureBlack, width: 2),
                          boxShadow: _type == 'income'
                              ? ArcadeTheme.neoShadow(offset: const Offset(2, 2))
                              : null,
                        ),
                        alignment: Alignment.center,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.arrow_downward_rounded,
                              size: 16,
                              color: _type == 'income'
                                  ? ArcadeTheme.pureBlack
                                  : ArcadeTheme.slateMuted,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              'INCOME',
                              style: TextStyle(
                                color: _type == 'income'
                                    ? ArcadeTheme.pureBlack
                                    : ArcadeTheme.slateMuted,
                                fontWeight: FontWeight.w900,
                                fontSize: 13,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Large Score Display
              ArcadeCard(
                fillColor: ArcadeTheme.darkCard,
                child: Column(
                  children: [
                    const Text(
                      'ENTER AMOUNT',
                      style: TextStyle(
                        color: ArcadeTheme.slateMuted,
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '₹ $_amountStr',
                      style: const TextStyle(
                        color: ArcadeTheme.acidYellow,
                        fontSize: 36,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1.0,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Category Quick Chips
              const Text(
                'CATEGORY',
                style: TextStyle(
                  color: ArcadeTheme.pureWhite,
                  fontWeight: FontWeight.w900,
                  fontSize: 12,
                ),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: _categories.map((c) {
                  final isSel = _selectedCategory == c['name'];
                  final icon = c['icon'] as IconData;
                  return GestureDetector(
                    onTap: () => setState(() => _selectedCategory = c['name'] as String),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: isSel ? ArcadeTheme.acidYellow : ArcadeTheme.darkCard,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: ArcadeTheme.pureBlack, width: 2),
                        boxShadow: isSel
                            ? ArcadeTheme.neoShadow(offset: const Offset(2, 2))
                            : null,
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            icon,
                            size: 14,
                            color: isSel ? ArcadeTheme.pureBlack : ArcadeTheme.neonCyan,
                          ),
                          const SizedBox(width: 5),
                          Text(
                            c['name'] as String,
                            style: TextStyle(
                              color: isSel ? ArcadeTheme.pureBlack : ArcadeTheme.pureWhite,
                              fontWeight: FontWeight.w800,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 14),

              // Optional Custom Title Input
              TextField(
                controller: _customTitleCtrl,
                style: const TextStyle(
                    color: ArcadeTheme.pureWhite, fontWeight: FontWeight.w700),
                decoration: InputDecoration(
                  hintText: 'Custom Note (optional)',
                  hintStyle: const TextStyle(color: ArcadeTheme.slateMuted),
                  filled: true,
                  fillColor: ArcadeTheme.darkCard,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(color: ArcadeTheme.pureBlack, width: 2),
                  ),
                ),
              ),
              const SizedBox(height: 14),

              // Importance Selector (if Expense)
              if (_type == 'expense') ...[
                const Text(
                  'IMPORTANCE',
                  style: TextStyle(
                    color: ArcadeTheme.pureWhite,
                    fontWeight: FontWeight.w900,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: _buildImportancePill('essential', 'ESSENTIAL', ArcadeTheme.arcadeGreen),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _buildImportancePill('moderate', 'MODERATE', ArcadeTheme.acidYellow),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _buildImportancePill('low', 'LOW VALUE', ArcadeTheme.punchPink),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
              ],

              // Tactile Arcade Numpad
              Container(
                decoration: ArcadeTheme.neoBox(
                  fillColor: ArcadeTheme.darkCard,
                  radius: 12,
                ),
                padding: const EdgeInsets.all(12),
                child: Column(
                  children: [
                    _buildKeypadRow(['1', '2', '3']),
                    const SizedBox(height: 8),
                    _buildKeypadRow(['4', '5', '6']),
                    const SizedBox(height: 8),
                    _buildKeypadRow(['7', '8', '9']),
                    const SizedBox(height: 8),
                    _buildKeypadRow(['.', '0', '⌫']),
                  ],
                ),
              ),
              const SizedBox(height: 18),

              // Submit Action with Tactile Loading
              ArcadeButton(
                text: 'SAVE TRANSACTION',
                icon: Icons.check_circle_rounded,
                backgroundColor: ArcadeTheme.acidYellow,
                textColor: ArcadeTheme.pureBlack,
                isLoading: _isSaving,
                loadingText: 'Saving Transaction...',
                onTap: _handleSave,
                width: double.infinity,
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildImportancePill(String val, String label, Color color) {
    final isSel = _importance == val;
    return GestureDetector(
      onTap: () => setState(() => _importance = val),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: isSel ? color : ArcadeTheme.darkCard,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: ArcadeTheme.pureBlack, width: 2),
          boxShadow: isSel ? ArcadeTheme.neoShadow(offset: const Offset(2, 2)) : null,
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: TextStyle(
            color: isSel ? ArcadeTheme.pureBlack : ArcadeTheme.pureWhite,
            fontWeight: FontWeight.w900,
            fontSize: 10,
          ),
        ),
      ),
    );
  }

  Widget _buildKeypadRow(List<String> keys) {
    return Row(
      children: keys.map((k) {
        return Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: GestureDetector(
              onTap: () => _onKeypadTap(k),
              child: Container(
                height: 48,
                decoration: BoxDecoration(
                  color: ArcadeTheme.darkCardLight,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: ArcadeTheme.pureBlack, width: 1.5),
                  boxShadow: ArcadeTheme.neoShadow(offset: const Offset(2, 2)),
                ),
                alignment: Alignment.center,
                child: Text(
                  k,
                  style: const TextStyle(
                    color: ArcadeTheme.pureWhite,
                    fontWeight: FontWeight.w900,
                    fontSize: 18,
                  ),
                ),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}
