import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:url_launcher/url_launcher.dart';
import '../providers/app_state.dart';
import '../services/api_service.dart';
import '../theme/arcade_theme.dart';
import '../widgets/arcade_button.dart';

class QrPayScreen extends StatefulWidget {
  final AppState appState;

  const QrPayScreen({super.key, required this.appState});

  @override
  State<QrPayScreen> createState() => _QrPayScreenState();
}

class _QrPayScreenState extends State<QrPayScreen> {
  final MobileScannerController _scannerCtrl = MobileScannerController();
  String _payeeVpa = '';
  String _payeeName = '';
  String _amount = '';
  bool _isProcessing = false;
  bool _hasScanned = false;

  void _onDetect(BarcodeCapture capture) {
    if (_hasScanned) return;
    final List<Barcode> barcodes = capture.barcodes;
    for (final barcode in barcodes) {
      final code = barcode.rawValue;
      if (code != null && code.startsWith('upi://')) {
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
      _payeeVpa = uri.queryParameters['pa'] ?? '';
      _payeeName = uri.queryParameters['pn'] ?? 'UPI Merchant';
      _amount = uri.queryParameters['am'] ?? '';
    } catch (_) {
      _payeeVpa = '';
      _payeeName = 'UPI Merchant';
    }
  }

  void _launchUpiIntent() async {
    if (_payeeVpa.isEmpty) return;

    final amtVal = double.tryParse(_amount) ?? 0.0;
    if (amtVal <= 0) return;

    setState(() => _isProcessing = true);

    // 1. Record payment attempt to backend
    final paymentAttemptId = 'att_${DateTime.now().millisecondsSinceEpoch}';
    await ApiService.instance.post('/api/payment-attempts', {
      'paymentAttemptId': paymentAttemptId,
      'amount': amtVal,
      'payeeVpa': _payeeVpa,
      'payeeName': _payeeName,
      'status': 'PENDING',
    });

    // 2. Build full UPI Intent URI
    final intentUri = Uri.parse(
      'upi://pay?pa=$_payeeVpa&pn=${Uri.encodeComponent(_payeeName)}&am=$amtVal&cu=INR&tr=$paymentAttemptId',
    );

    // 3. Launch UPI App
    try {
      if (await canLaunchUrl(intentUri)) {
        await launchUrl(intentUri, mode: LaunchMode.externalApplication);
      } else {
        // Fallback generic
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
  void dispose() {
    _scannerCtrl.dispose();
    super.dispose();
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
          'SCAN & PAY',
          style: TextStyle(
            color: ArcadeTheme.acidYellow,
            fontWeight: FontWeight.w900,
            fontSize: 18,
            letterSpacing: 0.8,
          ),
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Retro Viewfinder Camera Section
            Expanded(
              flex: 5,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  MobileScanner(
                    controller: _scannerCtrl,
                    onDetect: _onDetect,
                  ),

                  // Retro Target Viewfinder Overlay (clean border only, completely unobstructed camera preview)
                  Container(
                    width: 250,
                    height: 250,
                    decoration: BoxDecoration(
                      border: Border.all(color: ArcadeTheme.acidYellow, width: 3),
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),

                  // Top Status Pill
                  Positioned(
                    top: 20,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                      decoration: BoxDecoration(
                        color: ArcadeTheme.pureBlack,
                        borderRadius: BorderRadius.circular(ArcadeTheme.pillRadius),
                        border: Border.all(color: ArcadeTheme.acidYellow, width: 2),
                      ),
                      child: const Text(
                        'ALIGN ANY UPI QR IN TARGET',
                        style: TextStyle(
                          color: ArcadeTheme.acidYellow,
                          fontWeight: FontWeight.w900,
                          fontSize: 11,
                          letterSpacing: 0.8,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Bottom Scan Details / Payment Action
            Expanded(
              flex: 4,
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: const BoxDecoration(
                  color: ArcadeTheme.darkCard,
                  border: Border(
                    top: BorderSide(color: ArcadeTheme.pureBlack, width: 2.5),
                  ),
                ),
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (!_hasScanned) ...[
                        const Center(
                          child: Text(
                            'Scan PhonePe, GPay, Paytm, or BharatQR',
                            style: TextStyle(
                              color: ArcadeTheme.slateMuted,
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                        ArcadeButton(
                          text: 'MANUAL UPI ENTRY',
                          backgroundColor: ArcadeTheme.darkCardLight,
                          textColor: ArcadeTheme.pureWhite,
                          onTap: () {
                            setState(() {
                              _hasScanned = true;
                              _payeeVpa = 'merchant@upi';
                              _payeeName = 'Manual Merchant';
                              _amount = '100';
                            });
                          },
                          width: double.infinity,
                        ),
                      ] else ...[
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text(
                              'MERCHANT DETECTED',
                              style: TextStyle(
                                color: ArcadeTheme.neonCyan,
                                fontWeight: FontWeight.w900,
                                fontSize: 12,
                                letterSpacing: 0.6,
                              ),
                            ),
                            GestureDetector(
                              onTap: () => setState(() => _hasScanned = false),
                              child: const Text(
                                'SCAN AGAIN',
                                style: TextStyle(
                                  color: ArcadeTheme.acidYellow,
                                  fontWeight: FontWeight.w900,
                                  fontSize: 11,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _payeeName,
                          style: const TextStyle(
                            color: ArcadeTheme.pureWhite,
                            fontWeight: FontWeight.w900,
                            fontSize: 18,
                          ),
                        ),
                        Text(
                          _payeeVpa,
                          style: const TextStyle(
                            color: ArcadeTheme.slateMuted,
                            fontWeight: FontWeight.w700,
                            fontSize: 12,
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          keyboardType: TextInputType.number,
                          style: const TextStyle(
                              color: ArcadeTheme.pureWhite, fontWeight: FontWeight.w900),
                          decoration: InputDecoration(
                            labelText: 'Amount (₹)',
                            labelStyle: const TextStyle(color: ArcadeTheme.acidYellow),
                            hintText: 'Enter amount',
                            hintStyle: const TextStyle(color: ArcadeTheme.slateMuted),
                            filled: true,
                            fillColor: ArcadeTheme.darkCardLight,
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                              borderSide: const BorderSide(color: ArcadeTheme.pureBlack, width: 2),
                            ),
                          ),
                          controller: TextEditingController(text: _amount)
                            ..selection = TextSelection.fromPosition(
                              TextPosition(offset: _amount.length),
                            ),
                          onChanged: (val) => _amount = val,
                        ),
                        const SizedBox(height: 16),
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
        ),
      ),
    );
  }
}
