import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../providers/app_state.dart';
import '../theme/arcade_theme.dart';
import '../widgets/arcade_button.dart';
import '../widgets/arcade_card.dart';

class SpacesScreen extends StatefulWidget {
  final AppState appState;
  final bool isEmbedded;
  final VoidCallback? onSpaceSwitched;

  const SpacesScreen({
    super.key,
    required this.appState,
    this.isEmbedded = false,
    this.onSpaceSwitched,
  });

  @override
  State<SpacesScreen> createState() => _SpacesScreenState();
}

class _SpacesScreenState extends State<SpacesScreen> {
  final TextEditingController _newSpaceCtrl = TextEditingController();
  bool _isCreating = false;

  @override
  void dispose() {
    _newSpaceCtrl.dispose();
    super.dispose();
  }

  void _handleCreateSpace() async {
    final name = _newSpaceCtrl.text.trim();
    if (name.isEmpty) return;

    setState(() => _isCreating = true);
    final success = await widget.appState.createSpace(name);
    if (mounted) {
      if (success) {
        _newSpaceCtrl.clear();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'SPACE "$name" CREATED',
              style: const TextStyle(fontWeight: FontWeight.w900, color: ArcadeTheme.pureBlack),
            ),
            backgroundColor: ArcadeTheme.arcadeGreen,
            duration: const Duration(seconds: 1),
          ),
        );
      }
      setState(() => _isCreating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.appState,
      builder: (context, _) {
        final spaces = widget.appState.spaces;
        final activeSpace = widget.appState.activeSpace;

        return Scaffold(
          backgroundColor: ArcadeTheme.darkCanvas,
          appBar: AppBar(
            backgroundColor: ArcadeTheme.darkCanvas,
            elevation: 0,
            automaticallyImplyLeading: false,
            leading: widget.isEmbedded
                ? null
                : IconButton(
                    icon: const Icon(Icons.arrow_back_rounded, color: ArcadeTheme.pureBlack),
                    onPressed: () => Navigator.pop(context),
                  ),
            title: const Text(
              'BUDGET SPACES',
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
                  // Create New Space Card (Neo-Brutalist Light Style)
                  ArcadeCard(
                    fillColor: ArcadeTheme.cardWhite,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'CREATE NEW SPACE',
                          style: TextStyle(
                            color: ArcadeTheme.punchPink,
                            fontWeight: FontWeight.w900,
                            fontSize: 12,
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Expanded(
                              child: TextField(
                                controller: _newSpaceCtrl,
                                style: const TextStyle(
                                  color: ArcadeTheme.pureBlack,
                                  fontWeight: FontWeight.w800,
                                  fontSize: 14,
                                ),
                                decoration: InputDecoration(
                                  hintText: 'e.g. Side Gig / Travel',
                                  hintStyle: const TextStyle(color: ArcadeTheme.slateDark),
                                  filled: true,
                                  fillColor: ArcadeTheme.lightCanvas,
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
                              text: 'ADD',
                              height: 48,
                              backgroundColor: ArcadeTheme.acidYellow,
                              textColor: ArcadeTheme.pureBlack,
                              isLoading: _isCreating,
                              loadingText: 'Creating...',
                              onTap: _handleCreateSpace,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),

                  const Text(
                    'YOUR SPACES',
                    style: TextStyle(
                      color: ArcadeTheme.pureBlack,
                      fontWeight: FontWeight.w900,
                      fontSize: 14,
                      letterSpacing: 0.6,
                    ),
                  ),
                  const SizedBox(height: 12),

                  ListView.separated(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: spaces.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (context, idx) {
                      final sp = spaces[idx];
                      final isCurrent = sp['_id'] == activeSpace?['_id'];
                      final isDefault = sp['isDefault'] == true;

                      return ArcadeCard(
                        fillColor: isCurrent ? const Color(0xFFFEF9C3) : ArcadeTheme.cardWhite,
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        child: Row(
                          children: [
                            Icon(
                              isCurrent ? Icons.folder_special_rounded : Icons.folder_rounded,
                              color: isCurrent ? ArcadeTheme.punchPink : ArcadeTheme.slateDark,
                              size: 24,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    sp['name'] ?? 'Untitled',
                                    style: const TextStyle(
                                      color: ArcadeTheme.pureBlack,
                                      fontWeight: FontWeight.w900,
                                      fontSize: 15,
                                    ),
                                  ),
                                  if (isDefault)
                                    const Text(
                                      'DEFAULT SPACE',
                                      style: TextStyle(
                                        color: ArcadeTheme.punchPink,
                                        fontSize: 10,
                                        fontWeight: FontWeight.w900,
                                      ),
                                    ),
                                ],
                              ),
                            ),
                            if (!isCurrent)
                              GestureDetector(
                                onTap: () {
                                  HapticFeedback.lightImpact();
                                  widget.appState.switchSpace(sp);
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text(
                                        'SWITCHED TO ${sp['name']?.toString().toUpperCase() ?? 'SPACE'}',
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w900,
                                          color: ArcadeTheme.pureBlack,
                                        ),
                                      ),
                                      backgroundColor: ArcadeTheme.acidYellow,
                                      duration: const Duration(seconds: 1),
                                    ),
                                  );
                                  if (widget.onSpaceSwitched != null) {
                                    widget.onSpaceSwitched!();
                                  } else if (!widget.isEmbedded && Navigator.canPop(context)) {
                                    Navigator.pop(context);
                                  }
                                },
                                child: Container(
                                  padding:
                                      const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                  decoration: BoxDecoration(
                                    color: ArcadeTheme.punchPink,
                                    borderRadius: BorderRadius.circular(6),
                                    border: Border.all(color: ArcadeTheme.pureBlack, width: 1.5),
                                    boxShadow: ArcadeTheme.neoShadow(offset: const Offset(1.5, 1.5)),
                                  ),
                                  child: const Text(
                                    'SWITCH',
                                    style: TextStyle(
                                      color: ArcadeTheme.pureWhite,
                                      fontWeight: FontWeight.w900,
                                      fontSize: 11,
                                    ),
                                  ),
                                ),
                              )
                            else
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                decoration: BoxDecoration(
                                  color: ArcadeTheme.acidYellow,
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(color: ArcadeTheme.pureBlack, width: 1.5),
                                ),
                                child: const Text(
                                  'ACTIVE',
                                  style: TextStyle(
                                    color: ArcadeTheme.pureBlack,
                                    fontWeight: FontWeight.w900,
                                    fontSize: 11,
                                  ),
                                ),
                              ),
                            if (!isDefault && spaces.length > 1) ...[
                              const SizedBox(width: 8),
                              IconButton(
                                icon: const Icon(Icons.delete_outline_rounded,
                                    color: ArcadeTheme.punchPink, size: 20),
                                onPressed: () => widget.appState.deleteSpace(sp['_id']),
                              ),
                            ],
                          ],
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
