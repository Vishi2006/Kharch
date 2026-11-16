import 'package:flutter/material.dart';
import '../providers/app_state.dart';
import '../theme/arcade_theme.dart';
import '../widgets/arcade_badge.dart';
import '../widgets/arcade_button.dart';
import '../widgets/arcade_card.dart';

class InboxScreen extends StatefulWidget {
  final AppState appState;

  const InboxScreen({super.key, required this.appState});

  @override
  State<InboxScreen> createState() => _InboxScreenState();
}

class _InboxScreenState extends State<InboxScreen> {
  String _activeTab = 'matches'; // 'matches' | 'unmatched'
  bool _isActioning = false;

  void _handleAcceptMatch(Map<String, dynamic> match) async {
    setState(() => _isActioning = true);

    final eventId = match['event']?['_id'] ?? '';
    final attemptId = match['suggestedAttempt']?['_id'] ?? '';
    final title = match['event']?['counterparty'] ??
        match['suggestedAttempt']?['payeeName'] ??
        'UPI Payment';

    await widget.appState.acceptInboxMatch(
      eventId: eventId,
      attemptId: attemptId,
      title: title,
      importance: 'moderate',
    );

    if (mounted) {
      setState(() => _isActioning = false);
    }
  }

  void _handleConvertUnmatched(Map<String, dynamic> item) async {
    setState(() => _isActioning = true);

    final itemId = item['_id'] ?? '';
    final title = item['counterparty'] ?? item['payeeName'] ?? 'UPI Transaction';

    await widget.appState.convertInboxItem(
      itemId: itemId,
      itemType: item['counterparty'] != null ? 'notification' : 'attempt',
      title: title,
      importance: 'moderate',
    );

    if (mounted) {
      setState(() => _isActioning = false);
    }
  }

  void _handleDismiss(String itemId, String itemType) async {
    setState(() => _isActioning = true);
    await widget.appState.dismissInboxItem(itemId, itemType);
    if (mounted) {
      setState(() => _isActioning = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final inbox = widget.appState.inboxData;
    final mediumMatches = (inbox?['mediumMatches'] as List?) ?? [];
    final unmatchedEvents = (inbox?['unmatchedEvents'] as List?) ?? [];
    final unknownAttempts = (inbox?['unknownAttempts'] as List?) ?? [];

    final allUnmatched = [...unmatchedEvents, ...unknownAttempts];

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
          'ARCADE INBOX',
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
                              : ArcadeTheme.darkCard,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: ArcadeTheme.pureBlack, width: 2),
                          boxShadow: _activeTab == 'matches'
                              ? ArcadeTheme.neoShadow(offset: const Offset(2, 2))
                              : null,
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          'POSSIBLE MATCHES (${mediumMatches.length})',
                          style: TextStyle(
                            color: _activeTab == 'matches'
                                ? ArcadeTheme.pureBlack
                                : ArcadeTheme.slateMuted,
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
                              : ArcadeTheme.darkCard,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: ArcadeTheme.pureBlack, width: 2),
                          boxShadow: _activeTab == 'unmatched'
                              ? ArcadeTheme.neoShadow(offset: const Offset(2, 2))
                              : null,
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          'STANDALONE (${allUnmatched.length})',
                          style: TextStyle(
                            color: _activeTab == 'unmatched'
                                ? ArcadeTheme.pureBlack
                                : ArcadeTheme.slateMuted,
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
  }

  Widget _buildMatchesList(List matches) {
    if (matches.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: const [
            Icon(Icons.mark_email_read_rounded, color: ArcadeTheme.arcadeGreen, size: 52),
            SizedBox(height: 12),
            Text(
              'INBOX ZERO 🎉',
              style: TextStyle(
                color: ArcadeTheme.pureWhite,
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
          fillColor: ArcadeTheme.darkCard,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const ArcadeBadge(
                    text: '★ UPI MATCH CANDIDATE',
                    backgroundColor: ArcadeTheme.arcadeViolet,
                    textColor: ArcadeTheme.pureWhite,
                  ),
                  Text(
                    '₹ ${amt.toStringAsFixed(2)}',
                    style: const TextStyle(
                      color: ArcadeTheme.acidYellow,
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
                        color: ArcadeTheme.darkCardLight,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: ArcadeTheme.pureBlack, width: 1.5),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('NOTIFICATION',
                              style: TextStyle(
                                  color: ArcadeTheme.neonCyan,
                                  fontWeight: FontWeight.w900,
                                  fontSize: 10)),
                          const SizedBox(height: 4),
                          Text(
                            event['counterparty'] ?? 'Bank Alert',
                            style: const TextStyle(
                                color: ArcadeTheme.pureWhite,
                                fontWeight: FontWeight.w800,
                                fontSize: 12),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          Text(
                            event['sourceApp'] ?? 'SMS',
                            style: const TextStyle(
                                color: ArcadeTheme.slateMuted, fontSize: 10),
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
                        color: ArcadeTheme.darkCardLight,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: ArcadeTheme.pureBlack, width: 1.5),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('QR ATTEMPT',
                              style: TextStyle(
                                  color: ArcadeTheme.punchPink,
                                  fontWeight: FontWeight.w900,
                                  fontSize: 10)),
                          const SizedBox(height: 4),
                          Text(
                            attempt['payeeName'] ?? 'QR Payee',
                            style: const TextStyle(
                                color: ArcadeTheme.pureWhite,
                                fontWeight: FontWeight.w800,
                                fontSize: 12),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          Text(
                            attempt['payeeVpa'] ?? 'vpa',
                            style: const TextStyle(
                                color: ArcadeTheme.slateMuted, fontSize: 10),
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
                      isLoading: _isActioning,
                      loadingText: 'Merging...',
                      onTap: () => _handleAcceptMatch(match),
                    ),
                  ),
                  const SizedBox(width: 8),
                  ArcadeButton(
                    text: 'DISMISS',
                    height: 42,
                    fontSize: 12,
                    backgroundColor: ArcadeTheme.darkCardLight,
                    textColor: ArcadeTheme.pureWhite,
                    isLoading: _isActioning,
                    onTap: () => _handleDismiss(event['_id'], 'notification'),
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
          children: const [
            Icon(Icons.check_circle_outline_rounded,
                color: ArcadeTheme.arcadeGreen, size: 52),
            SizedBox(height: 12),
            Text(
              'NO UNRESOLVED ITEMS',
              style: TextStyle(
                color: ArcadeTheme.pureWhite,
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
          fillColor: ArcadeTheme.darkCard,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      color: ArcadeTheme.pureWhite,
                      fontWeight: FontWeight.w900,
                      fontSize: 15,
                    ),
                  ),
                  Text(
                    '₹ ${amt.toStringAsFixed(2)}',
                    style: const TextStyle(
                      color: ArcadeTheme.acidYellow,
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
                      isLoading: _isActioning,
                      loadingText: 'Recording...',
                      onTap: () => _handleConvertUnmatched(item),
                    ),
                  ),
                  const SizedBox(width: 8),
                  ArcadeButton(
                    text: 'IGNORE',
                    height: 40,
                    fontSize: 11,
                    backgroundColor: ArcadeTheme.darkCardLight,
                    textColor: ArcadeTheme.slateMuted,
                    isLoading: _isActioning,
                    onTap: () => _handleDismiss(
                      item['_id'],
                      item['counterparty'] != null ? 'notification' : 'attempt',
                    ),
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
