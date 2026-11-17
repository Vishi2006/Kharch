import 'package:flutter/services.dart';
import 'package:flutter/material.dart';
import '../providers/app_state.dart';
import '../theme/arcade_theme.dart';
import '../widgets/arcade_badge.dart';
import '../widgets/arcade_button.dart';
import '../widgets/arcade_card.dart';

class InboxScreen extends StatefulWidget {
  final AppState appState;
  final bool isEmbedded;

  const InboxScreen({super.key, required this.appState, this.isEmbedded = false});

  @override
  State<InboxScreen> createState() => _InboxScreenState();
}

class _InboxScreenState extends State<InboxScreen> {
  String _activeTab = 'matches'; // 'matches' | 'unmatched'
  String? _actioningKey;

  final List<Map<String, dynamic>> _defaultCategories = [
    {'name': 'Food', 'icon': Icons.restaurant_rounded},
    {'name': 'Transit', 'icon': Icons.directions_car_rounded},
    {'name': 'Groceries', 'icon': Icons.shopping_cart_rounded},
    {'name': 'Chai Pani', 'icon': Icons.local_cafe_rounded},
    {'name': 'Shopping', 'icon': Icons.shopping_bag_rounded},
    {'name': 'Home', 'icon': Icons.home_rounded},
    {'name': 'Salary', 'icon': Icons.account_balance_wallet_rounded},
    {'name': 'Tech', 'icon': Icons.devices_rounded},
  ];

  @override
  void initState() {
    super.initState();
    widget.appState.fetchTitles();
  }

  List<Map<String, dynamic>> _getAllCategories() {
    final defaultNames = _defaultCategories.map((c) => c['name'] as String).toSet();
    final list = List<Map<String, dynamic>>.from(_defaultCategories);
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

  void _executeAcceptMatch({
    required Map<String, dynamic> match,
    required String title,
    required String importance,
    required String note,
  }) async {
    final eventId = (match['event']?['_id'] ?? match['event']?['notificationId'] ?? '').toString();
    final attemptId = (match['suggestedAttempt']?['paymentAttemptId'] ?? match['suggestedAttempt']?['_id'] ?? '').toString();
    HapticFeedback.lightImpact();
    setState(() => _actioningKey = 'accept_$eventId');

    final success = await widget.appState.acceptInboxMatch(
      eventId: eventId,
      attemptId: attemptId,
      title: title,
      importance: importance,
      note: note,
    );

    if (mounted) {
      setState(() => _actioningKey = null);
      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('MATCH ACCEPTED & CONVERTED TO EXPENSE', style: TextStyle(fontWeight: FontWeight.w900, color: ArcadeTheme.pureBlack)),
            backgroundColor: ArcadeTheme.arcadeGreen,
            duration: Duration(seconds: 1),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('FAILED TO ACCEPT MATCH', style: TextStyle(fontWeight: FontWeight.w900, color: ArcadeTheme.pureWhite)),
            backgroundColor: ArcadeTheme.punchPink,
            duration: Duration(seconds: 2),
          ),
        );
      }
    }
  }

  void _executeConvertUnmatched({
    required Map<String, dynamic> item,
    required String title,
    required String category,
    required String importance,
    required String note,
  }) async {
    final itemId = (item['paymentAttemptId'] ?? item['_id'] ?? '').toString();
    final mongoId = (item['_id'] ?? '').toString();
    HapticFeedback.lightImpact();
    setState(() => _actioningKey = 'convert_$mongoId');

    final success = await widget.appState.convertInboxItem(
      itemId: itemId.isNotEmpty ? itemId : mongoId,
      itemType: item['counterparty'] != null ? 'notification' : 'attempt',
      title: title,
      category: category,
      importance: importance,
      note: note,
    );

    if (mounted) {
      setState(() => _actioningKey = null);
      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('CONVERTED TO EXPENSE', style: TextStyle(fontWeight: FontWeight.w900, color: ArcadeTheme.pureBlack)),
            backgroundColor: ArcadeTheme.arcadeGreen,
            duration: Duration(seconds: 1),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('FAILED TO CONVERT TO EXPENSE', style: TextStyle(fontWeight: FontWeight.w900, color: ArcadeTheme.pureWhite)),
            backgroundColor: ArcadeTheme.punchPink,
            duration: Duration(seconds: 2),
          ),
        );
      }
    }
  }

  void _openReviewBottomSheet(
    BuildContext context, {
    required Map<String, dynamic> item,
    bool isMatch = false,
    Map<String, dynamic>? match,
  }) {
    HapticFeedback.lightImpact();

    final amountNum = (item['amount'] as num?)?.toDouble() ??
        (match?['event']?['amount'] as num?)?.toDouble() ??
        (match?['suggestedAttempt']?['amount'] as num?)?.toDouble() ??
        0.0;

    final payeeName = (item['payeeName'] ??
            item['counterparty'] ??
            match?['event']?['counterparty'] ??
            match?['suggestedAttempt']?['payeeName'] ??
            'UPI Transaction')
        .toString();

    final payeeVpa = (item['payeeVpa'] ??
            match?['suggestedAttempt']?['payeeVpa'] ??
            '')
        .toString();

    final initialCategory = (item['category'] ??
            item['title'] ??
            item['suggestedTitle'] ??
            'Food')
        .toString();

    final initialTitle = (item['title'] ??
            item['category'] ??
            item['suggestedTitle'] ??
            payeeName)
        .toString();

    final initialImportance = (item['importance'] ??
            item['suggestedImportance'] ??
            'moderate')
        .toString();

    final initialNote = (item['note'] ?? '').toString();

    final titleController = TextEditingController(text: initialTitle);
    final noteController = TextEditingController(text: initialNote);
    String selectedCategory = initialCategory;
    String selectedImportance = initialImportance;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (modalContext, setModalState) {
            return Container(
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(modalContext).viewInsets.bottom + 20,
                left: 16,
                right: 16,
                top: 16,
              ),
              decoration: const BoxDecoration(
                color: ArcadeTheme.lightCanvas,
                borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
                border: Border(
                  top: BorderSide(color: ArcadeTheme.pureBlack, width: 2.5),
                  left: BorderSide(color: ArcadeTheme.pureBlack, width: 2.5),
                  right: BorderSide(color: ArcadeTheme.pureBlack, width: 2.5),
                ),
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Handle bar
                    Center(
                      child: Container(
                        width: 44,
                        height: 5,
                        decoration: BoxDecoration(
                          color: ArcadeTheme.pureBlack,
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),

                    // Header row
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'REVIEW & CONVERT',
                          style: TextStyle(
                            color: ArcadeTheme.punchPink,
                            fontWeight: FontWeight.w900,
                            fontSize: 16,
                            letterSpacing: 0.8,
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close_rounded, color: ArcadeTheme.pureBlack),
                          onPressed: () => Navigator.pop(modalContext),
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),

                    // Summary Card
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: ArcadeTheme.pureWhite,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: ArcadeTheme.pureBlack, width: 2),
                        boxShadow: ArcadeTheme.neoShadow(offset: const Offset(3, 3)),
                      ),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: ArcadeTheme.acidYellow,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: ArcadeTheme.pureBlack, width: 1.5),
                            ),
                            child: const Icon(Icons.receipt_long_rounded, color: ArcadeTheme.pureBlack, size: 24),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  payeeName,
                                  style: const TextStyle(
                                    color: ArcadeTheme.pureBlack,
                                    fontWeight: FontWeight.w900,
                                    fontSize: 15,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                if (payeeVpa.isNotEmpty)
                                  Text(
                                    payeeVpa,
                                    style: const TextStyle(
                                      color: ArcadeTheme.slateDark,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 11,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                              ],
                            ),
                          ),
                          Text(
                            '₹${amountNum.toStringAsFixed(amountNum.truncateToDouble() == amountNum ? 0 : 2)}',
                            style: const TextStyle(
                              color: ArcadeTheme.punchPink,
                              fontWeight: FontWeight.w900,
                              fontSize: 18,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),

                    // Category Selector
                    const Text(
                      'CATEGORY',
                      style: TextStyle(
                        color: ArcadeTheme.pureBlack,
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
                        final catName = c['name'] as String;
                        final isSel = selectedCategory == catName;
                        final icon = c['icon'] as IconData;
                        return GestureDetector(
                          onTap: () {
                            HapticFeedback.selectionClick();
                            setModalState(() {
                              selectedCategory = catName;
                              titleController.text = catName;
                            });
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                            decoration: BoxDecoration(
                              color: isSel ? ArcadeTheme.acidYellow : ArcadeTheme.pureWhite,
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: ArcadeTheme.pureBlack, width: 1.5),
                              boxShadow: isSel ? ArcadeTheme.neoShadow(offset: const Offset(2, 2)) : null,
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  icon,
                                  size: 13,
                                  color: isSel ? ArcadeTheme.pureBlack : ArcadeTheme.punchPink,
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  catName,
                                  style: TextStyle(
                                    color: ArcadeTheme.pureBlack,
                                    fontWeight: isSel ? FontWeight.w900 : FontWeight.w700,
                                    fontSize: 11,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 12),

                    // Title Field
                    TextField(
                      controller: titleController,
                      style: const TextStyle(color: ArcadeTheme.pureBlack, fontWeight: FontWeight.w900, fontSize: 14),
                      decoration: InputDecoration(
                        labelText: 'Expense Title *',
                        labelStyle: const TextStyle(color: ArcadeTheme.punchPink, fontWeight: FontWeight.w800, fontSize: 12),
                        hintText: 'e.g. Lunch at Cafe',
                        filled: true,
                        fillColor: ArcadeTheme.pureWhite,
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

                    // Importance
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
                        _buildModalImportancePill('essential', 'ESSENTIAL', ArcadeTheme.arcadeGreen, selectedImportance, (v) {
                          setModalState(() => selectedImportance = v);
                        }),
                        const SizedBox(width: 6),
                        _buildModalImportancePill('moderate', 'MODERATE', ArcadeTheme.acidYellow, selectedImportance, (v) {
                          setModalState(() => selectedImportance = v);
                        }),
                        const SizedBox(width: 6),
                        _buildModalImportancePill('low_value', 'LOW VALUE', ArcadeTheme.punchPink, selectedImportance, (v) {
                          setModalState(() => selectedImportance = v);
                        }),
                      ],
                    ),
                    const SizedBox(height: 12),

                    // Note Field
                    TextField(
                      controller: noteController,
                      style: const TextStyle(color: ArcadeTheme.pureBlack, fontWeight: FontWeight.w700, fontSize: 13),
                      decoration: InputDecoration(
                        labelText: 'Note / Remarks (Optional)',
                        labelStyle: const TextStyle(color: ArcadeTheme.slateDark, fontWeight: FontWeight.w800, fontSize: 12),
                        hintText: 'e.g. Paid via UPI QR',
                        filled: true,
                        fillColor: ArcadeTheme.pureWhite,
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
                    const SizedBox(height: 16),

                    // Confirm CTA
                    ArcadeButton(
                      text: 'CONFIRM & SAVE AS EXPENSE',
                      icon: Icons.check_circle_rounded,
                      backgroundColor: ArcadeTheme.acidYellow,
                      textColor: ArcadeTheme.pureBlack,
                      width: double.infinity,
                      onTap: () {
                        Navigator.pop(modalContext);
                        final chosenTitle = titleController.text.trim().isNotEmpty
                            ? titleController.text.trim()
                            : selectedCategory;
                        if (isMatch && match != null) {
                          _executeAcceptMatch(
                            match: match,
                            title: chosenTitle,
                            importance: selectedImportance,
                            note: noteController.text.trim(),
                          );
                        } else {
                          _executeConvertUnmatched(
                            item: item,
                            title: chosenTitle,
                            category: selectedCategory,
                            importance: selectedImportance,
                            note: noteController.text.trim(),
                          );
                        }
                      },
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildModalImportancePill(
    String val,
    String label,
    Color color,
    String selectedVal,
    ValueChanged<String> onSelect,
  ) {
    final isSel = selectedVal == val;
    return Expanded(
      child: GestureDetector(
        onTap: () {
          HapticFeedback.selectionClick();
          onSelect(val);
        },
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 7),
          decoration: BoxDecoration(
            color: isSel ? color : ArcadeTheme.pureWhite,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: ArcadeTheme.pureBlack, width: 1.5),
            boxShadow: isSel ? ArcadeTheme.neoShadow(offset: const Offset(2, 2)) : null,
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: const TextStyle(
              color: ArcadeTheme.pureBlack,
              fontWeight: FontWeight.w900,
              fontSize: 10,
            ),
          ),
        ),
      ),
    );
  }

  void _handleDismiss(String itemId, String itemType) async {
    HapticFeedback.lightImpact();
    setState(() => _actioningKey = 'dismiss_$itemId');
    final success = await widget.appState.dismissInboxItem(itemId, itemType);
    if (mounted) {
      setState(() => _actioningKey = null);
      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('ITEM IGNORED', style: TextStyle(fontWeight: FontWeight.w900, color: ArcadeTheme.pureBlack)),
            backgroundColor: ArcadeTheme.acidYellow,
            duration: Duration(seconds: 1),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('FAILED TO IGNORE ITEM', style: TextStyle(fontWeight: FontWeight.w900, color: ArcadeTheme.pureWhite)),
            backgroundColor: ArcadeTheme.punchPink,
            duration: Duration(seconds: 2),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.appState,
      builder: (context, _) {
        final inbox = widget.appState.inboxData;
        final mediumMatches = (inbox?['mediumMatches'] as List?) ?? [];
        final unmatchedEvents = (inbox?['unmatchedEvents'] as List?) ?? [];
        final unknownAttempts = (inbox?['unknownAttempts'] as List?) ?? [];

        final allUnmatched = [...unmatchedEvents, ...unknownAttempts];

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
          'INBOX',
          style: TextStyle(
            color: ArcadeTheme.pureBlack,
            fontWeight: FontWeight.w900,
            fontSize: 18,
            letterSpacing: 0.8,
          ),
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Tab Selector
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  Expanded(
                    child: GestureDetector(
                      onTap: () => setState(() => _activeTab = 'matches'),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        decoration: BoxDecoration(
                          color: _activeTab == 'matches'
                              ? ArcadeTheme.acidYellow
                              : ArcadeTheme.cardWhite,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: ArcadeTheme.pureBlack, width: 2),
                          boxShadow: ArcadeTheme.neoShadow(offset: const Offset(2, 2)),
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          'POSSIBLE MATCHES (${mediumMatches.length})',
                          style: TextStyle(
                            color: _activeTab == 'matches'
                                ? ArcadeTheme.pureBlack
                                : ArcadeTheme.pureBlack,
                            fontWeight: FontWeight.w900,
                            fontSize: 11,
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: GestureDetector(
                      onTap: () => setState(() => _activeTab = 'unmatched'),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        decoration: BoxDecoration(
                          color: _activeTab == 'unmatched'
                              ? ArcadeTheme.acidYellow
                              : ArcadeTheme.cardWhite,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: ArcadeTheme.pureBlack, width: 2),
                          boxShadow: ArcadeTheme.neoShadow(offset: const Offset(2, 2)),
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          'STANDALONE (${allUnmatched.length})',
                          style: TextStyle(
                            color: _activeTab == 'unmatched'
                                ? ArcadeTheme.pureBlack
                                : ArcadeTheme.pureBlack,
                            fontWeight: FontWeight.w900,
                            fontSize: 11,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Content List
            Expanded(
              child: RefreshIndicator(
                onRefresh: () => widget.appState.refreshInbox(),
                color: ArcadeTheme.acidYellow,
                backgroundColor: ArcadeTheme.darkCard,
                child: _activeTab == 'matches'
                    ? _buildMatchesList(mediumMatches)
                    : _buildUnmatchedList(allUnmatched),
              ),
            ),
          ],
        ),
      ),
    );
      },
    );
  }

  Widget _buildMatchesList(List matches) {
    if (matches.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.mark_email_read_rounded, color: ArcadeTheme.arcadeGreen, size: 52),
            SizedBox(height: 12),
            Text(
              'INBOX IS CLEAR',
              style: const TextStyle(
                color: ArcadeTheme.punchPink,
                fontWeight: FontWeight.w900,
                fontSize: 18,
              ),
            ),
            SizedBox(height: 4),
            Text(
              'All background UPI captures are matched!',
              style: TextStyle(color: ArcadeTheme.slateMuted, fontSize: 13),
            ),
          ],
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: matches.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, idx) {
        final match = matches[idx];
        final event = match['event'] ?? {};
        final attempt = match['suggestedAttempt'] ?? {};
        final amt = (event['amount'] ?? attempt['amount'] ?? 0.0).toDouble();

        return ArcadeCard(
          fillColor: ArcadeTheme.creamWhite,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const ArcadeBadge(
                    text: 'UPI MATCH CANDIDATE',
                    backgroundColor: ArcadeTheme.arcadeViolet,
                    textColor: ArcadeTheme.pureWhite,
                  ),
                  Text(
                    '₹ ${amt.toStringAsFixed(2)}',
                    style: const TextStyle(
                      color: ArcadeTheme.punchPink,
                      fontWeight: FontWeight.w900,
                      fontSize: 18,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              // Side-by-side comparison
              Row(
                children: [
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: ArcadeTheme.pureWhite,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: ArcadeTheme.pureBlack, width: 1.5),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('NOTIFICATION',
                              style: TextStyle(
                                  color: ArcadeTheme.punchPink,
                                  fontWeight: FontWeight.w900,
                                  fontSize: 10)),
                          const SizedBox(height: 4),
                          Text(
                            event['counterparty'] ?? 'Bank Alert',
                            style: const TextStyle(
                                color: ArcadeTheme.pureBlack,
                                fontWeight: FontWeight.w900,
                                fontSize: 12),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          Text(
                            event['sourceApp'] ?? 'SMS',
                            style: const TextStyle(
                                color: ArcadeTheme.slateDark, fontSize: 10, fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: ArcadeTheme.pureWhite,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: ArcadeTheme.pureBlack, width: 1.5),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('QR ATTEMPT',
                              style: TextStyle(
                                  color: ArcadeTheme.arcadeGreen,
                                  fontWeight: FontWeight.w900,
                                  fontSize: 10)),
                          const SizedBox(height: 4),
                          Text(
                            attempt['payeeName'] ?? 'QR Payee',
                            style: const TextStyle(
                                color: ArcadeTheme.pureBlack,
                                fontWeight: FontWeight.w900,
                                fontSize: 12),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          Text(
                            attempt['payeeVpa'] ?? 'vpa',
                            style: const TextStyle(
                                color: ArcadeTheme.slateDark, fontSize: 10, fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: ArcadeButton(
                      text: 'ACCEPT MATCH',
                      height: 42,
                      fontSize: 12,
                      backgroundColor: ArcadeTheme.arcadeGreen,
                      textColor: ArcadeTheme.pureBlack,
                      isLoading: _actioningKey == 'accept_${event['_id']}',
                      loadingText: 'Merging...',
                      onTap: () => _openReviewBottomSheet(
                        context,
                        item: (match['event'] ?? match['suggestedAttempt'] ?? {}) as Map<String, dynamic>,
                        isMatch: true,
                        match: match,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  ArcadeButton(
                    text: 'DISMISS',
                    height: 42,
                    fontSize: 12,
                    backgroundColor: ArcadeTheme.pureWhite,
                    textColor: ArcadeTheme.pureBlack,
                    isLoading: _actioningKey == 'dismiss_${event['_id']}',
                    loadingText: 'Dismissing...',
                    onTap: () {
                      final eventId = (event['_id'] ?? event['notificationId'] ?? '').toString();
                      final attemptId = (attempt['paymentAttemptId'] ?? attempt['_id'] ?? '').toString();
                      if (eventId.isNotEmpty) _handleDismiss(eventId, 'notification');
                      if (attemptId.isNotEmpty) _handleDismiss(attemptId, 'payment_attempt');
                    },
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildUnmatchedList(List unmatched) {
    if (unmatched.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.check_circle_outline_rounded,
                color: ArcadeTheme.arcadeGreen, size: 52),
            SizedBox(height: 12),
            Text(
              'NO UNRESOLVED ITEMS',
              style: const TextStyle(
                color: ArcadeTheme.punchPink,
                fontWeight: FontWeight.w900,
                fontSize: 18,
              ),
            ),
          ],
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: unmatched.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, idx) {
        final item = unmatched[idx];
        final amt = (item['amount'] ?? 0.0).toDouble();
        final title = item['counterparty'] ?? item['payeeName'] ?? 'Unknown UPI';
        final type = item['type'] ?? 'DEBIT';

        return ArcadeCard(
          fillColor: ArcadeTheme.creamWhite,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      title,
                      style: const TextStyle(
                        color: ArcadeTheme.pureBlack,
                        fontWeight: FontWeight.w900,
                        fontSize: 15,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '₹ ${amt.toStringAsFixed(2)}',
                    style: const TextStyle(
                      color: ArcadeTheme.punchPink,
                      fontWeight: FontWeight.w900,
                      fontSize: 16,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              ArcadeBadge.transactionType(type),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: ArcadeButton(
                      text: 'CONVERT TO EXPENSE',
                      height: 40,
                      fontSize: 11,
                      backgroundColor: ArcadeTheme.acidYellow,
                      textColor: ArcadeTheme.pureBlack,
                      isLoading: _actioningKey == 'convert_${item['_id']}',
                      loadingText: 'Recording...',
                      onTap: () => _openReviewBottomSheet(
                        context,
                        item: item,
                        isMatch: false,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  ArcadeButton(
                    text: 'IGNORE',
                    height: 40,
                    fontSize: 11,
                    backgroundColor: ArcadeTheme.pureWhite,
                    textColor: ArcadeTheme.pureBlack,
                    isLoading: _actioningKey == 'dismiss_${item['_id']}',
                    loadingText: 'Ignoring...',
                    onTap: () {
                      final itemId = (item['paymentAttemptId'] ?? item['_id'] ?? '').toString();
                      _handleDismiss(
                        itemId,
                        item['counterparty'] != null ? 'notification' : 'payment_attempt',
                      );
                    },
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }
}
