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

  const AddPayScreen({super.key, required this.appState, this.initialTab = 1});

  @override
  State<AddPayScreen> createState() => _AddPayScreenState();
}

class _AddPayScreenState extends State<AddPayScreen> {
  late int _activeTab; // 0: Add, 1: QR Pay

  // --- Manual Add State ---
  String _amountStr = '0';
  String _type = 'expense'; // 'expense' | 'income' | 'investment' | 'savings'
  String _importance = 'essential'; // 'essential' | 'moderate' | 'low_value'
  String _selectedCategory = 'Food';
  final TextEditingController _customTitleCtrl = TextEditingController();
  final TextEditingController _noteCtrl = TextEditingController();
  bool _isSaving = false;

  final List<Map<String, dynamic>> _categories = [
    {'name': 'Food', 'icon': Icons.restaurant_rounded},
    {'name': 'Transit', 'icon': Icons.directions_car_rounded},
    {'name': 'Groceries', 'icon': Icons.shopping_cart_rounded},
    {'name': 'Chai Pani', 'icon': Icons.local_cafe_rounded},
    {'name': 'Shopping', 'icon': Icons.shopping_bag_rounded},
    {'name': 'Home', 'icon': Icons.home_rounded},
    {'name': 'Salary', 'icon': Icons.account_balance_wallet_rounded},
    {'name': 'Tech', 'icon': Icons.devices_rounded},
  ];

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
    widget.appState.fetchTitles();
  }

  List<Map<String, dynamic>> _getAllCategories() {
    final defaultNames = _categories.map((c) => c['name'] as String).toSet();
    final list = List<Map<String, dynamic>>.from(_categories);
    for (final t in widget.appState.titles) {
      final name = (t['displayName'] ?? t['normalizedName'] ?? '').toString().trim();
      if (name.isNotEmpty && !defaultNames.contains(name)) {
        defaultNames.add(name);
        list.add({
          'name': name,
          'icon': Icons.label_important_outline_rounded,
        });
      }
    }
    return list;
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
          content: Text('Please enter a valid UPI VPA / ID (e.g. merchant@okaxis)'),
          backgroundColor: ArcadeTheme.punchPink,
        ),
      );
      return;
    }

    final amtVal = double.tryParse(_qrAmountCtrl.text.trim()) ?? 0.0;
    if (amtVal <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter an amount greater than ₹0'),
          backgroundColor: ArcadeTheme.punchPink,
        ),
      );
      return;
    }

    final payeeName = _payeeNameCtrl.text.trim().isNotEmpty
        ? _payeeNameCtrl.text.trim()
        : 'UPI Merchant';

    HapticFeedback.selectionClick();
    setState(() => _isProcessing = true);

    final paymentAttemptId = 'att_${DateTime.now().millisecondsSinceEpoch}';

    // 1. Asynchronous non-blocking payment attempt recording (zero UI/app delay)
    unawaited(
      ApiService.instance.post('/api/payment-attempts', {
        'paymentAttemptId': paymentAttemptId,
        'amount': amtVal,
        'payeeVpa': payeeVpa,
        'payeeName': payeeName,
        'status': 'PENDING',
      }).catchError((e) => <String, dynamic>{'error': e.toString()}),
    );

    // 2. Build UPI intent URI
    final intentUri = Uri.parse(
      'upi://pay?pa=$payeeVpa&pn=${Uri.encodeComponent(payeeName)}&am=$amtVal&cu=INR&tr=$paymentAttemptId',
    );

    // 3. Launch UPI App immediately
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
            content: Text('Could not open UPI app: $e'),
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
      backgroundColor: ArcadeTheme.darkCanvas,
      appBar: AppBar(
        backgroundColor: ArcadeTheme.darkCanvas,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: ArcadeTheme.pureBlack),
          onPressed: () => Navigator.pop(context),
        ),
        title: Container(
          decoration: BoxDecoration(
            color: ArcadeTheme.darkCard,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: ArcadeTheme.pureBlack, width: 2),
          ),
          padding: const EdgeInsets.all(3),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildTopTab(0, 'ADD EXPENSE', Icons.edit_note_rounded),
              _buildTopTab(1, 'SCAN & PAY', Icons.qr_code_scanner_rounded),
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
      onTap: () => setState(() => _activeTab = tabIndex),
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
              color: isSel ? ArcadeTheme.pureBlack : ArcadeTheme.slateMuted,
            ),
            const SizedBox(width: 5),
            Text(
              label,
              style: TextStyle(
                color: isSel ? ArcadeTheme.pureBlack : ArcadeTheme.slateMuted,
                fontWeight: FontWeight.w900,
                fontSize: 11,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // --- Manual Add Content ---
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

          // Amount Display
          ArcadeCard(
            fillColor: ArcadeTheme.darkCard,
            child: Column(
              children: [
                const Text(
                  'ENTER AMOUNT',
                  style: TextStyle(
                    color: ArcadeTheme.slateMuted,
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0.8,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '₹ $_amountStr',
                  style: const TextStyle(
                    color: ArcadeTheme.acidYellow,
                    fontSize: 34,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Category Quick Chips
          const Text(
            'CATEGORY / TITLE',
            style: TextStyle(
              color: ArcadeTheme.punchPink,
              fontWeight: FontWeight.w900,
              fontSize: 11,
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 6),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: _getAllCategories().map((c) {
              final isSel = _selectedCategory == c['name'];
              final icon = c['icon'] as IconData;
              return GestureDetector(
                onTap: () => setState(() => _selectedCategory = c['name'] as String),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: isSel ? ArcadeTheme.acidYellow : ArcadeTheme.darkCard,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: ArcadeTheme.pureBlack, width: 1.5),
                    boxShadow: isSel ? ArcadeTheme.neoShadow(offset: const Offset(2, 2)) : null,
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
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 10),

          // Custom Note
          TextField(
            controller: _customTitleCtrl,
            style: const TextStyle(color: ArcadeTheme.pureWhite, fontWeight: FontWeight.w700, fontSize: 13),
            decoration: InputDecoration(
              hintText: 'Custom Title / Note (optional)',
              hintStyle: const TextStyle(color: ArcadeTheme.slateMuted, fontSize: 12),
              filled: true,
              fillColor: ArcadeTheme.darkCard,
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(color: ArcadeTheme.pureBlack, width: 2),
              ),
            ),
          ),
          const SizedBox(height: 10),

          // Importance Selector (if Expense)
          if (_type == 'expense') ...[
            Row(
              children: [
                Expanded(child: _buildImportancePill('essential', 'ESSENTIAL', ArcadeTheme.arcadeGreen)),
                const SizedBox(width: 6),
                Expanded(child: _buildImportancePill('moderate', 'MODERATE', ArcadeTheme.acidYellow)),
                const SizedBox(width: 6),
                Expanded(child: _buildImportancePill('low_value', 'LOW VALUE', ArcadeTheme.punchPink)),
              ],
            ),
            const SizedBox(height: 12),
          ],

          // Tactile Numpad
          Container(
            decoration: ArcadeTheme.neoBox(fillColor: ArcadeTheme.darkCard, radius: 10),
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
          const SizedBox(height: 14),

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
          const SizedBox(height: 20),
        ],
      ),
    );
  }

  Widget _buildTypeChip(String type, String label, Color color) {
    final isSel = _type == type;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _type = type),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: isSel ? color : ArcadeTheme.darkCard,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: ArcadeTheme.pureBlack, width: 1.5),
            boxShadow: isSel ? ArcadeTheme.neoShadow(offset: const Offset(2, 2)) : null,
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: TextStyle(
              color: isSel ? ArcadeTheme.pureBlack : ArcadeTheme.slateMuted,
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
      onTap: () => setState(() => _importance = val),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 7),
        decoration: BoxDecoration(
          color: isSel ? color : ArcadeTheme.darkCard,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: ArcadeTheme.pureBlack, width: 1.5),
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
            padding: const EdgeInsets.symmetric(horizontal: 3),
            child: GestureDetector(
              onTap: () => _onKeypadTap(k),
              child: Container(
                height: 42,
                decoration: BoxDecoration(
                  color: ArcadeTheme.darkCardLight,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: ArcadeTheme.pureBlack, width: 1.5),
                  boxShadow: ArcadeTheme.neoShadow(offset: const Offset(1.5, 1.5)),
                ),
                alignment: Alignment.center,
                child: Text(
                  k,
                  style: const TextStyle(
                    color: ArcadeTheme.pureWhite,
                    fontWeight: FontWeight.w900,
                    fontSize: 16,
                  ),
                ),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }

  // --- QR Pay Content ---
  Widget _buildQrPayView() {
    return Column(
      children: [
        // Camera Viewfinder
        Expanded(
          flex: 5,
          child: Stack(
            alignment: Alignment.center,
            children: [
              MobileScanner(
                controller: _scannerCtrl,
                onDetect: _onDetect,
              ),
              // Clean Viewfinder Overlay (hollow interior with sharp yellow border for maximum scan clarity)
              Container(
                width: 250,
                height: 250,
                decoration: BoxDecoration(
                  border: Border.all(color: ArcadeTheme.acidYellow, width: 3),
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
              Positioned(
                top: 16,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                  decoration: BoxDecoration(
                    color: ArcadeTheme.pureBlack,
                    borderRadius: BorderRadius.circular(ArcadeTheme.pillRadius),
                    border: Border.all(color: ArcadeTheme.acidYellow, width: 1.5),
                  ),
                  child: const Text(
                    'ALIGN ANY UPI QR CODE',
                    style: TextStyle(
                      color: ArcadeTheme.acidYellow,
                      fontWeight: FontWeight.w900,
                      fontSize: 10,
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
          flex: 4,
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
                        color: ArcadeTheme.pureWhite,
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
