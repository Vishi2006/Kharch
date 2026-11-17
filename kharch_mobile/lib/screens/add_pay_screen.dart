import 'package:flutter/services.dart';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:url_launcher/url_launcher.dart';
import '../providers/app_state.dart';
import '../services/api_service.dart';
import '../theme/arcade_theme.dart';
import '../widgets/arcade_button.dart';
import '../widgets/arcade_card.dart';

class AddPayScreen extends StatefulWidget {
  final AppState appState;
  final int initialTab; // 0: Manual Add, 1: Scan & Pay
  final bool isEmbedded;
  final VoidCallback? onBackOrDone;

  const AddPayScreen({
    super.key,
    required this.appState,
    this.initialTab = 1,
    this.isEmbedded = false,
    this.onBackOrDone,
  });

  @override
  State<AddPayScreen> createState() => _AddPayScreenState();
}

class _AddPayScreenState extends State<AddPayScreen> {
  late int _activeTab; // 0: Add, 1: QR Pay

  // --- Manual Add State ---
  String _amountStr = '0';
  String _type = 'expense'; // 'expense' | 'income' | 'investment' | 'savings'
  String _importance = 'essential'; // 'essential' | 'moderate' | 'low_value'
  String _selectedCategory = 'Fast Food';
  final TextEditingController _customTitleCtrl = TextEditingController();
  final TextEditingController _noteCtrl = TextEditingController();
  bool _isSaving = false;

  // 20 Curated Daily Life Title Chips (4 per row, 5 rows) for Expense
  static final List<Map<String, dynamic>> _expenseCategories = [
    // Row 1
    {'name': 'Transportation', 'icon': Icons.directions_car_rounded},
    {'name': 'Groceries', 'icon': Icons.shopping_cart_rounded},
    {'name': 'Fast Food', 'icon': Icons.fastfood_rounded},
    {'name': 'Chai Pani', 'icon': Icons.local_cafe_rounded},
    // Row 2
    {'name': 'Shopping', 'icon': Icons.shopping_bag_rounded},
    {'name': 'Home', 'icon': Icons.home_rounded},
    {'name': 'Udhari', 'icon': Icons.handshake_rounded},
    {'name': 'Tech', 'icon': Icons.devices_rounded},
    // Row 3
    {'name': 'Dining', 'icon': Icons.restaurant_rounded},
    {'name': 'Fuel', 'icon': Icons.local_gas_station_rounded},
    {'name': 'Rent', 'icon': Icons.apartment_rounded},
    {'name': 'Bills', 'icon': Icons.receipt_long_rounded},
    // Row 4
    {'name': 'Healthcare', 'icon': Icons.medical_services_rounded},
    {'name': 'Fun', 'icon': Icons.movie_creation_rounded},
    {'name': 'Education', 'icon': Icons.school_rounded},
    {'name': 'Personal Care', 'icon': Icons.spa_rounded},
    // Row 5
    {'name': 'Subscriptions', 'icon': Icons.subscriptions_rounded},
    {'name': 'Travel', 'icon': Icons.flight_takeoff_rounded},
    {'name': 'Gifts', 'icon': Icons.card_giftcard_rounded},
    {'name': 'Other', 'icon': Icons.add_circle_outline_rounded},
  ];

  static final List<Map<String, dynamic>> _incomeCategories = [
    {'name': 'Salary', 'icon': Icons.account_balance_wallet_rounded},
    {'name': 'Freelance', 'icon': Icons.laptop_mac_rounded},
    {'name': 'Business', 'icon': Icons.storefront_rounded},
    {'name': 'Invest Return', 'icon': Icons.trending_up_rounded},
    {'name': 'Gift', 'icon': Icons.card_giftcard_rounded},
    {'name': 'Other', 'icon': Icons.add_circle_outline_rounded},
  ];

  static final List<Map<String, dynamic>> _investmentCategories = [
    {'name': 'Mutual Funds', 'icon': Icons.pie_chart_rounded},
    {'name': 'Stocks', 'icon': Icons.show_chart_rounded},
    {'name': 'Gold', 'icon': Icons.diamond_rounded},
    {'name': 'Crypto', 'icon': Icons.currency_bitcoin_rounded},
    {'name': 'FD', 'icon': Icons.savings_rounded},
    {'name': 'Other', 'icon': Icons.add_circle_outline_rounded},
  ];

  static final List<Map<String, dynamic>> _savingsCategories = [
    {'name': 'Emergency Fund', 'icon': Icons.security_rounded},
    {'name': 'Bank Deposit', 'icon': Icons.account_balance_rounded},
    {'name': 'Savings', 'icon': Icons.savings_rounded},
    {'name': 'Chit Fund', 'icon': Icons.groups_rounded},
    {'name': 'Other', 'icon': Icons.add_circle_outline_rounded},
  ];

  // User created custom titles in current session
  final Set<String> _userAddedTitles = {};

  // --- QR Pay State ---
  final MobileScannerController _scannerCtrl = MobileScannerController();
  final TextEditingController _payeeVpaCtrl = TextEditingController();
  final TextEditingController _payeeNameCtrl = TextEditingController();
  final TextEditingController _qrAmountCtrl = TextEditingController();
  bool _isProcessing = false;
  bool _hasScanned = false;

  @override
  void initState() {
    super.initState();
    _activeTab = widget.initialTab;
  }

  List<Map<String, dynamic>> _getCategoriesForCurrentType() {
    switch (_type) {
      case 'income':
        return _incomeCategories;
      case 'investment':
        return _investmentCategories;
      case 'savings':
        return _savingsCategories;
      case 'expense':
      default:
        return _expenseCategories;
    }
  }

  @override
  void dispose() {
    _customTitleCtrl.dispose();
    _noteCtrl.dispose();
    _scannerCtrl.dispose();
    _payeeVpaCtrl.dispose();
    _payeeNameCtrl.dispose();
    _qrAmountCtrl.dispose();
    super.dispose();
  }

  void _onKeypadTap(String val) {
    HapticFeedback.lightImpact();
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

  void _handleSaveManual() async {
    final amount = double.tryParse(_amountStr);
    if (amount == null || amount <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter an amount greater than ₹0', style: TextStyle(fontWeight: FontWeight.w900)),
          backgroundColor: ArcadeTheme.punchPink,
          duration: Duration(seconds: 1),
        ),
      );
      return;
    }

    String title = _customTitleCtrl.text.trim();
    if (title.isEmpty) {
      title = _selectedCategory == 'Other' ? 'Miscellaneous' : _selectedCategory;
    } else {
      // User entered custom title, keep in quick chips
      _userAddedTitles.add(title);
    }

    final note = _noteCtrl.text.trim();

    setState(() => _isSaving = true);

    final success = await widget.appState.addTransaction(
      amount: amount,
      title: title,
      type: _type,
      importance: _importance,
      note: note.isNotEmpty ? note : null,
    );

    if (mounted) {
      setState(() {
        _isSaving = false;
        _amountStr = '0';
        _customTitleCtrl.clear();
        _noteCtrl.clear();
      });
      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('TRANSACTION SAVED', style: TextStyle(fontWeight: FontWeight.w900, color: ArcadeTheme.pureBlack)),
            backgroundColor: ArcadeTheme.arcadeGreen,
            duration: Duration(seconds: 1),
          ),
        );
        if (widget.isEmbedded) {
          widget.onBackOrDone?.call();
        } else {
          Navigator.pop(context);
        }
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('FAILED TO SAVE TRANSACTION', style: TextStyle(fontWeight: FontWeight.w900, color: ArcadeTheme.pureWhite)),
            backgroundColor: ArcadeTheme.punchPink,
            duration: Duration(seconds: 2),
          ),
        );
      }
    }
  }

  void _onDetect(BarcodeCapture capture) {
    if (_hasScanned) return;
    for (final barcode in capture.barcodes) {
      final code = barcode.rawValue;
      if (code != null && code.startsWith('upi://')) {
        HapticFeedback.mediumImpact();
        setState(() {
          _hasScanned = true;
          _parseUpiUri(code);
        });
        break;
      }
    }
  }

  void _parseUpiUri(String uriStr) {
    try {
      final uri = Uri.parse(uriStr);
      _payeeVpaCtrl.text = uri.queryParameters['pa'] ?? '';
      _payeeNameCtrl.text = uri.queryParameters['pn'] ?? 'UPI Merchant';
      _qrAmountCtrl.text = uri.queryParameters['am'] ?? '';
    } catch (_) {
      _payeeVpaCtrl.text = '';
      _payeeNameCtrl.text = 'UPI Merchant';
      _qrAmountCtrl.text = '';
    }
  }

  void _launchUpiIntent() async {
    final payeeVpa = _payeeVpaCtrl.text.trim();
    if (payeeVpa.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter a valid UPI VPA / ID (e.g. merchant@okaxis)', style: TextStyle(fontWeight: FontWeight.w900)),
          backgroundColor: ArcadeTheme.punchPink,
        ),
      );
      return;
    }

    final amtVal = double.tryParse(_qrAmountCtrl.text.trim()) ?? 0.0;
    if (amtVal <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter an amount greater than ₹0', style: TextStyle(fontWeight: FontWeight.w900)),
          backgroundColor: ArcadeTheme.punchPink,
        ),
      );
      return;
    }

    final payeeName = _payeeNameCtrl.text.trim().isNotEmpty
        ? _payeeNameCtrl.text.trim()
        : 'UPI Merchant';

    String title = _customTitleCtrl.text.trim();
    if (title.isEmpty) {
      title = _selectedCategory == 'Other' ? payeeName : _selectedCategory;
    } else {
      _userAddedTitles.add(title);
    }

    HapticFeedback.selectionClick();
    setState(() => _isProcessing = true);

    final paymentAttemptId = 'att_${DateTime.now().millisecondsSinceEpoch}';

    // Asynchronous non-blocking payment attempt recording
    unawaited(
      ApiService.instance.post('/api/payment-attempts', {
        'paymentAttemptId': paymentAttemptId,
        'amount': amtVal,
        'payeeVpa': payeeVpa,
        'payeeName': payeeName,
        'category': _selectedCategory,
        'title': title,
        'importance': _importance,
        'note': _noteCtrl.text.trim(),
        'status': 'PENDING',
      }).catchError((e) => <String, dynamic>{'error': e.toString()}),
    );

    // Build UPI intent URI
    final intentUri = Uri.parse(
      'upi://pay?pa=$payeeVpa&pn=${Uri.encodeComponent(payeeName)}&am=$amtVal&cu=INR&tr=$paymentAttemptId',
    );

    try {
      final launched = await launchUrl(
        intentUri,
        mode: LaunchMode.externalApplication,
      );
      if (!launched) {
        await launchUrl(intentUri);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Could not open UPI app: $e', style: const TextStyle(fontWeight: FontWeight.w900)),
            backgroundColor: ArcadeTheme.punchPink,
          ),
        );
      }
    }

    if (mounted) {
      setState(() => _isProcessing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
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
        title: Container(
          decoration: BoxDecoration(
            color: ArcadeTheme.cardWhite,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: ArcadeTheme.pureBlack, width: 2),
            boxShadow: ArcadeTheme.neoShadow(offset: const Offset(2, 2)),
          ),
          padding: const EdgeInsets.all(3),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildTopTab(1, 'SCAN & PAY', Icons.qr_code_scanner_rounded),
              _buildTopTab(0, 'MANUAL ADD', Icons.edit_note_rounded),
            ],
          ),
        ),
        centerTitle: true,
      ),
      body: SafeArea(
        child: _activeTab == 0 ? _buildManualAddView() : _buildQrPayView(),
      ),
    );
  }

  Widget _buildTopTab(int tabIndex, String label, IconData icon) {
    final isSel = _activeTab == tabIndex;
    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        setState(() => _activeTab = tabIndex);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: isSel ? ArcadeTheme.acidYellow : Colors.transparent,
          borderRadius: BorderRadius.circular(7),
          border: isSel ? Border.all(color: ArcadeTheme.pureBlack, width: 1.5) : null,
        ),
        child: Row(
          children: [
            Icon(
              icon,
              size: 15,
              color: ArcadeTheme.pureBlack,
            ),
            const SizedBox(width: 5),
            Text(
              label,
              style: TextStyle(
                color: isSel ? ArcadeTheme.pureBlack : ArcadeTheme.slateDark,
                fontWeight: FontWeight.w900,
                fontSize: 11,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // --- Manual Add Content (Neo-Brutalist Light Style) ---
  Widget _buildManualAddView() {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Type Switcher Row (Expense, Income, Investment, Savings)
          Row(
            children: [
              _buildTypeChip('expense', 'EXPENSE', ArcadeTheme.punchPink),
              const SizedBox(width: 6),
              _buildTypeChip('income', 'INCOME', ArcadeTheme.arcadeGreen),
              const SizedBox(width: 6),
              _buildTypeChip('investment', 'INVEST', ArcadeTheme.neonCyan),
              const SizedBox(width: 6),
              _buildTypeChip('savings', 'SAVINGS', const Color(0xFFC084FC)),
            ],
          ),
          const SizedBox(height: 14),

          // Amount Display Card (White Neo-Brutal Card)
          ArcadeCard(
            fillColor: ArcadeTheme.cardWhite,
            child: Column(
              children: [
                const Text(
                  'ENTER AMOUNT',
                  style: TextStyle(
                    color: ArcadeTheme.slateDark,
                    fontSize: 11,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0.8,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '₹ $_amountStr',
                  style: const TextStyle(
                    color: ArcadeTheme.punchPink,
                    fontSize: 34,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Category Quick Chips
          const Text(
            'QUICK TITLE / CATEGORY',
            style: TextStyle(
              color: ArcadeTheme.pureBlack,
              fontWeight: FontWeight.w900,
              fontSize: 12,
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 8),
          _buildCategoryGrid(_getCategoriesForCurrentType(), crossAxisCount: 4),

          // Custom Title (ONLY when "Other" is selected)
          if (_selectedCategory == 'Other') ...[
            const SizedBox(height: 8),
            TextField(
              controller: _customTitleCtrl,
              style: const TextStyle(color: ArcadeTheme.pureBlack, fontWeight: FontWeight.w900, fontSize: 13),
              decoration: InputDecoration(
                labelText: 'Custom Title *',
                labelStyle: const TextStyle(color: ArcadeTheme.punchPink, fontWeight: FontWeight.w800, fontSize: 12),
                hintText: 'e.g. Swiggy, Metro Card, Cricket Kit',
                hintStyle: const TextStyle(color: ArcadeTheme.slateMuted, fontSize: 12),
                filled: true,
                fillColor: ArcadeTheme.cardWhite,
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
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
          ],
          const SizedBox(height: 10),

          // Additional Optional Note
          TextField(
            controller: _noteCtrl,
            style: const TextStyle(color: ArcadeTheme.pureBlack, fontWeight: FontWeight.w700, fontSize: 13),
            decoration: InputDecoration(
              labelText: 'Note / Remarks (Optional)',
              labelStyle: const TextStyle(color: ArcadeTheme.slateDark, fontWeight: FontWeight.w800, fontSize: 12),
              hintText: 'e.g. Split with Aman, reimbursed later',
              hintStyle: const TextStyle(color: ArcadeTheme.slateMuted, fontSize: 12),
              filled: true,
              fillColor: ArcadeTheme.cardWhite,
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(color: ArcadeTheme.pureBlack, width: 1.5),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(color: ArcadeTheme.pureBlack, width: 1.5),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(color: ArcadeTheme.punchPink, width: 2),
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Importance Selector (if Expense)
          if (_type == 'expense') ...[
            const Text(
              'IMPORTANCE',
              style: TextStyle(
                color: ArcadeTheme.pureBlack,
                fontWeight: FontWeight.w900,
                fontSize: 12,
                letterSpacing: 0.8,
              ),
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                Expanded(child: _buildImportancePill('essential', 'ESSENTIAL', ArcadeTheme.arcadeGreen)),
                const SizedBox(width: 6),
                Expanded(child: _buildImportancePill('moderate', 'MODERATE', ArcadeTheme.acidYellow)),
                const SizedBox(width: 6),
                Expanded(child: _buildImportancePill('low_value', 'LOW VALUE', ArcadeTheme.punchPink)),
              ],
            ),
            const SizedBox(height: 14),
          ],

          // Tactile Numpad (White Neo-Brutalist Box)
          Container(
            decoration: ArcadeTheme.neoBox(fillColor: ArcadeTheme.cardWhite, radius: 10),
            padding: const EdgeInsets.all(10),
            child: Column(
              children: [
                _buildKeypadRow(['1', '2', '3']),
                const SizedBox(height: 6),
                _buildKeypadRow(['4', '5', '6']),
                const SizedBox(height: 6),
                _buildKeypadRow(['7', '8', '9']),
                const SizedBox(height: 6),
                _buildKeypadRow(['.', '0', '⌫']),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Save Button
          ArcadeButton(
            text: 'SAVE TRANSACTION',
            icon: Icons.check_circle_rounded,
            backgroundColor: ArcadeTheme.acidYellow,
            textColor: ArcadeTheme.pureBlack,
            isLoading: _isSaving,
            loadingText: 'Saving Transaction...',
            onTap: _handleSaveManual,
            width: double.infinity,
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _buildCategoryGrid(List<Map<String, dynamic>> categories, {int crossAxisCount = 4}) {
    List<Widget> rows = [];
    for (int i = 0; i < categories.length; i += crossAxisCount) {
      final chunk = categories.sublist(i, (i + crossAxisCount > categories.length) ? categories.length : i + crossAxisCount);
      rows.add(
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Row(
            children: [
              for (final c in chunk)
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 2.5),
                    child: _buildCategoryChip(c),
                  ),
                ),
              for (int j = 0; j < crossAxisCount - chunk.length; j++)
                const Expanded(child: SizedBox()),
            ],
          ),
        ),
      );
    }
    return Column(children: rows);
  }

  Widget _buildCategoryChip(Map<String, dynamic> c) {
    final name = c['name'] as String;
    final icon = c['icon'] as IconData;
    final isSel = _selectedCategory == name;
    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        setState(() {
          _selectedCategory = name;
          if (name != 'Other') {
            _customTitleCtrl.text = name;
          } else {
            _customTitleCtrl.clear();
          }
        });
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 7),
        decoration: BoxDecoration(
          color: isSel ? ArcadeTheme.acidYellow : ArcadeTheme.cardWhite,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: ArcadeTheme.pureBlack, width: 1.5),
          boxShadow: isSel ? ArcadeTheme.neoShadow(offset: const Offset(1.5, 1.5)) : null,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 15,
              color: isSel ? ArcadeTheme.pureBlack : ArcadeTheme.punchPink,
            ),
            const SizedBox(height: 3),
            Text(
              name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: ArcadeTheme.pureBlack,
                fontWeight: isSel ? FontWeight.w900 : FontWeight.w700,
                fontSize: 10,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTypeChip(String type, String label, Color color) {
    final isSel = _type == type;
    return Expanded(
      child: GestureDetector(
        onTap: () {
          HapticFeedback.selectionClick();
          setState(() {
            _type = type;
            if (type == 'expense') {
              _selectedCategory = 'Fast Food';
            } else if (type == 'income') {
              _selectedCategory = 'Salary';
            } else if (type == 'investment') {
              _selectedCategory = 'Mutual Funds';
            } else if (type == 'savings') {
              _selectedCategory = 'Emergency Fund';
            }
            _customTitleCtrl.clear();
          });
        },
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: isSel ? color : ArcadeTheme.cardWhite,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: ArcadeTheme.pureBlack, width: 1.5),
            boxShadow: isSel ? ArcadeTheme.neoShadow(offset: const Offset(2, 2)) : null,
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: TextStyle(
              color: isSel ? ArcadeTheme.pureBlack : ArcadeTheme.slateDark,
              fontWeight: FontWeight.w900,
              fontSize: 10,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildImportancePill(String val, String label, Color color) {
    final isSel = _importance == val;
    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        setState(() => _importance = val);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 7),
        decoration: BoxDecoration(
          color: isSel ? color : ArcadeTheme.cardWhite,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: ArcadeTheme.pureBlack, width: 1.5),
          boxShadow: isSel ? ArcadeTheme.neoShadow(offset: const Offset(2, 2)) : null,
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: TextStyle(
            color: ArcadeTheme.pureBlack,
            fontWeight: isSel ? FontWeight.w900 : FontWeight.w700,
            fontSize: 10,
          ),
        ),
      ),
    );
  }

  Widget _buildKeypadRow(List<String> keys) {
    return Row(
      children: keys.map((k) {
        final isSpecial = k == '⌫' || k == '.';
        return Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 3),
            child: GestureDetector(
              onTap: () => _onKeypadTap(k),
              child: Container(
                height: 44,
                decoration: BoxDecoration(
                  color: isSpecial ? ArcadeTheme.lightCanvas : ArcadeTheme.cardWhite,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: ArcadeTheme.pureBlack, width: 1.5),
                  boxShadow: ArcadeTheme.neoShadow(offset: const Offset(1.5, 1.5)),
                ),
                alignment: Alignment.center,
                child: Text(
                  k,
                  style: const TextStyle(
                    color: ArcadeTheme.pureBlack,
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

  // --- QR Pay Content (Neo-Brutalist Light Style) ---
  Widget _buildQrPayView() {
    return Column(
      children: [
        // Camera Viewfinder
        Expanded(
          flex: 4,
          child: Stack(
            alignment: Alignment.center,
            children: [
              MobileScanner(
                controller: _scannerCtrl,
                onDetect: _onDetect,
              ),
              // Viewfinder square with high-contrast Acid Yellow border (Clean, no dark shadow)
              Container(
                width: 220,
                height: 220,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: ArcadeTheme.acidYellow,
                    width: 3.5,
                  ),
                ),
              ),
              // Instructions tag
              Positioned(
                bottom: 14,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                  decoration: BoxDecoration(
                    color: ArcadeTheme.pureBlack,
                    borderRadius: BorderRadius.circular(ArcadeTheme.pillRadius),
                    border: Border.all(color: ArcadeTheme.acidYellow, width: 1.5),
                  ),
                  child: const Text(
                    'POINT CAMERA AT ANY UPI QR CODE',
                    style: TextStyle(
                      color: ArcadeTheme.acidYellow,
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 0.6,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),

        // Pay Actions with Light Canvas Background
        Expanded(
          flex: 6,
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              color: ArcadeTheme.lightCanvas,
              border: Border(top: BorderSide(color: ArcadeTheme.pureBlack, width: 2.5)),
            ),
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (!_hasScanned) ...[
                    const Center(
                      child: Text(
                        'Supports PhonePe, GPay, Paytm, or BharatQR',
                        style: TextStyle(color: ArcadeTheme.slateDark, fontSize: 12, fontWeight: FontWeight.w700),
                      ),
                    ),
                    const SizedBox(height: 12),
                    ArcadeButton(
                      text: 'ENTER MANUAL UPI VPA',
                      backgroundColor: ArcadeTheme.punchPink,
                      textColor: ArcadeTheme.pureWhite,
                      onTap: () {
                        HapticFeedback.lightImpact();
                        setState(() {
                          _hasScanned = true;
                          _payeeVpaCtrl.clear();
                          _payeeNameCtrl.clear();
                          _qrAmountCtrl.clear();
                        });
                      },
                      width: double.infinity,
                    ),
                  ] else ...[
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: ArcadeTheme.cardWhite,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: ArcadeTheme.pureBlack, width: 2),
                        boxShadow: ArcadeTheme.neoShadow(offset: const Offset(3, 3)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: ArcadeTheme.punchPink,
                                  borderRadius: BorderRadius.circular(ArcadeTheme.pillRadius),
                                  border: Border.all(color: ArcadeTheme.pureBlack, width: 1.5),
                                ),
                                child: Text(
                                  _payeeVpaCtrl.text.trim().isNotEmpty ? 'MERCHANT / VPA DETECTED' : 'ENTER UPI DETAILS',
                                  style: const TextStyle(color: ArcadeTheme.pureWhite, fontWeight: FontWeight.w900, fontSize: 10),
                                ),
                              ),
                              GestureDetector(
                                onTap: () {
                                  HapticFeedback.lightImpact();
                                  setState(() {
                                    _hasScanned = false;
                                    _payeeVpaCtrl.clear();
                                    _payeeNameCtrl.clear();
                                    _qrAmountCtrl.clear();
                                  });
                                },
                                child: const Text(
                                  'SCAN AGAIN',
                                  style: TextStyle(
                                    color: ArcadeTheme.punchPink,
                                    fontWeight: FontWeight.w900,
                                    fontSize: 11,
                                    decoration: TextDecoration.underline,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          TextField(
                            controller: _payeeVpaCtrl,
                            style: const TextStyle(color: ArcadeTheme.pureBlack, fontWeight: FontWeight.w900, fontSize: 14),
                            decoration: InputDecoration(
                              labelText: 'UPI ID / VPA *',
                              labelStyle: const TextStyle(color: ArcadeTheme.punchPink, fontWeight: FontWeight.w800, fontSize: 12),
                              hintText: 'e.g. mobile@upi or name@okaxis',
                              hintStyle: const TextStyle(color: ArcadeTheme.slateMuted, fontSize: 12),
                              filled: true,
                              fillColor: ArcadeTheme.lightCanvas,
                              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(8),
                                borderSide: const BorderSide(color: ArcadeTheme.pureBlack, width: 1.5),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(8),
                                borderSide: const BorderSide(color: ArcadeTheme.pureBlack, width: 1.5),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(8),
                                borderSide: const BorderSide(color: ArcadeTheme.punchPink, width: 2),
                              ),
                            ),
                          ),
                          const SizedBox(height: 10),
                          TextField(
                            controller: _payeeNameCtrl,
                            style: const TextStyle(color: ArcadeTheme.pureBlack, fontWeight: FontWeight.w800, fontSize: 14),
                            decoration: InputDecoration(
                              labelText: 'Payee / Merchant Name (Optional)',
                              labelStyle: const TextStyle(color: ArcadeTheme.slateDark, fontWeight: FontWeight.w800, fontSize: 12),
                              hintText: 'e.g. Grocery Store / Friend',
                              hintStyle: const TextStyle(color: ArcadeTheme.slateMuted, fontSize: 12),
                              filled: true,
                              fillColor: ArcadeTheme.lightCanvas,
                              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(8),
                                borderSide: const BorderSide(color: ArcadeTheme.pureBlack, width: 1.5),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(8),
                                borderSide: const BorderSide(color: ArcadeTheme.pureBlack, width: 1.5),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(8),
                                borderSide: const BorderSide(color: ArcadeTheme.punchPink, width: 2),
                              ),
                            ),
                          ),
                          const SizedBox(height: 10),
                          TextField(
                            controller: _qrAmountCtrl,
                            keyboardType: const TextInputType.numberWithOptions(decimal: true),
                            style: const TextStyle(color: ArcadeTheme.pureBlack, fontWeight: FontWeight.w900, fontSize: 16),
                            decoration: InputDecoration(
                              labelText: 'Amount (₹) *',
                              labelStyle: const TextStyle(color: ArcadeTheme.punchPink, fontWeight: FontWeight.w800, fontSize: 12),
                              hintText: '0.00',
                              hintStyle: const TextStyle(color: ArcadeTheme.slateMuted, fontSize: 14),
                              filled: true,
                              fillColor: ArcadeTheme.lightCanvas,
                              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(8),
                                borderSide: const BorderSide(color: ArcadeTheme.pureBlack, width: 1.5),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(8),
                                borderSide: const BorderSide(color: ArcadeTheme.pureBlack, width: 1.5),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(8),
                                borderSide: const BorderSide(color: ArcadeTheme.punchPink, width: 2),
                              ),
                            ),
                          ),
                          const SizedBox(height: 12),

                          // Category Quick Chips (Max 4 per row, 5 rows)
                          const Text(
                            'QUICK TITLE / CATEGORY',
                            style: TextStyle(
                              color: ArcadeTheme.pureBlack,
                              fontWeight: FontWeight.w900,
                              fontSize: 11,
                              letterSpacing: 0.8,
                            ),
                          ),
                          const SizedBox(height: 6),
                          _buildCategoryGrid(_expenseCategories, crossAxisCount: 4),

                          // Custom Title (ONLY when "Other" is selected)
                          if (_selectedCategory == 'Other') ...[
                            const SizedBox(height: 8),
                            TextField(
                              controller: _customTitleCtrl,
                              style: const TextStyle(color: ArcadeTheme.pureBlack, fontWeight: FontWeight.w800, fontSize: 13),
                              decoration: InputDecoration(
                                labelText: 'Custom Title *',
                                labelStyle: const TextStyle(color: ArcadeTheme.punchPink, fontWeight: FontWeight.w800, fontSize: 12),
                                hintText: 'e.g. Lunch with team / Chai',
                                hintStyle: const TextStyle(color: ArcadeTheme.slateMuted, fontSize: 12),
                                filled: true,
                                fillColor: ArcadeTheme.lightCanvas,
                                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(8),
                                  borderSide: const BorderSide(color: ArcadeTheme.pureBlack, width: 1.5),
                                ),
                                enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(8),
                                  borderSide: const BorderSide(color: ArcadeTheme.pureBlack, width: 1.5),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(8),
                                  borderSide: const BorderSide(color: ArcadeTheme.punchPink, width: 2),
                                ),
                              ),
                            ),
                          ],
                          const SizedBox(height: 10),
                          const Text(
                            'IMPORTANCE',
                            style: TextStyle(
                              color: ArcadeTheme.pureBlack,
                              fontWeight: FontWeight.w900,
                              fontSize: 11,
                              letterSpacing: 0.8,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Row(
                            children: [
                              Expanded(
                                child: _buildImportancePill('essential', 'ESSENTIAL', ArcadeTheme.arcadeGreen),
                              ),
                              const SizedBox(width: 6),
                              Expanded(
                                child: _buildImportancePill('moderate', 'MODERATE', ArcadeTheme.acidYellow),
                              ),
                              const SizedBox(width: 6),
                              Expanded(
                                child: _buildImportancePill('low_value', 'LOW VALUE', ArcadeTheme.punchPink),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          TextField(
                            controller: _noteCtrl,
                            style: const TextStyle(color: ArcadeTheme.pureBlack, fontWeight: FontWeight.w700, fontSize: 13),
                            decoration: InputDecoration(
                              labelText: 'Note / Remarks (Optional)',
                              labelStyle: const TextStyle(color: ArcadeTheme.slateDark, fontWeight: FontWeight.w800, fontSize: 12),
                              hintText: 'e.g. Paid at canteen',
                              hintStyle: const TextStyle(color: ArcadeTheme.slateMuted, fontSize: 12),
                              filled: true,
                              fillColor: ArcadeTheme.lightCanvas,
                              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(8),
                                borderSide: const BorderSide(color: ArcadeTheme.pureBlack, width: 1.5),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(8),
                                borderSide: const BorderSide(color: ArcadeTheme.pureBlack, width: 1.5),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(8),
                                borderSide: const BorderSide(color: ArcadeTheme.punchPink, width: 2),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    ArcadeButton(
                      text: 'PAY VIA UPI APP',
                      icon: Icons.flash_on_rounded,
                      backgroundColor: ArcadeTheme.acidYellow,
                      textColor: ArcadeTheme.pureBlack,
                      isLoading: _isProcessing,
                      loadingText: 'Opening UPI App...',
                      onTap: _launchUpiIntent,
                      width: double.infinity,
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}
