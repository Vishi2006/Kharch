import 'package:flutter/material.dart';
import '../providers/app_state.dart';
import '../theme/arcade_theme.dart';
import '../widgets/arcade_button.dart';
import '../widgets/arcade_card.dart';

class SpacesScreen extends StatefulWidget {
  final AppState appState;

  const SpacesScreen({super.key, required this.appState});

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
      }
      setState(() => _isCreating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final spaces = widget.appState.spaces;
    final activeSpace = widget.appState.activeSpace;

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
          'BUDGET SPACES',
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
              // Create New Space Card
              ArcadeCard(
                fillColor: ArcadeTheme.darkCard,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'CREATE NEW SPACE',
                      style: TextStyle(
                        color: ArcadeTheme.neonCyan,
                        fontWeight: FontWeight.w900,
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _newSpaceCtrl,
                            style: const TextStyle(
                                color: ArcadeTheme.pureWhite, fontWeight: FontWeight.w800),
                            decoration: InputDecoration(
                              hintText: 'e.g. Side Gig / Travel',
                              hintStyle: const TextStyle(color: ArcadeTheme.slateMuted),
                              filled: true,
                              fillColor: ArcadeTheme.darkCardLight,
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
              const SizedBox(height: 20),

              const Text(
                'YOUR SPACES',
                style: TextStyle(
                  color: ArcadeTheme.pureWhite,
                  fontWeight: FontWeight.w900,
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: 10),

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
                    fillColor: isCurrent ? ArcadeTheme.darkCardLight : ArcadeTheme.darkCard,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    child: Row(
                      children: [
                        Icon(
                          isCurrent ? Icons.folder_special_rounded : Icons.folder_rounded,
                          color: isCurrent ? ArcadeTheme.acidYellow : ArcadeTheme.slateMuted,
                          size: 24,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                sp['name'] ?? 'Untitled',
                                style: TextStyle(
                                  color: isCurrent
                                      ? ArcadeTheme.acidYellow
                                      : ArcadeTheme.pureWhite,
                                  fontWeight: FontWeight.w800,
                                  fontSize: 15,
                                ),
                              ),
                              if (isDefault)
                                const Text(
                                  'DEFAULT SPACE',
                                  style: TextStyle(
                                    color: ArcadeTheme.arcadeGreen,
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
                              widget.appState.switchSpace(sp);
                              Navigator.pop(context);
                            },
                            child: Container(
                              padding:
                                  const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                              decoration: BoxDecoration(
                                color: ArcadeTheme.acidYellow,
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(color: ArcadeTheme.pureBlack, width: 1.5),
                              ),
                              child: const Text(
                                'SWITCH',
                                style: TextStyle(
                                  color: ArcadeTheme.pureBlack,
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
                              color: ArcadeTheme.arcadeGreen,
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
  }
}
