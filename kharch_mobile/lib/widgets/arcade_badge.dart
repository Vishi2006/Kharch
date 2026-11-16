import 'package:flutter/material.dart';
import '../theme/arcade_theme.dart';

class ArcadeBadge extends StatelessWidget {
  final String text;
  final Color backgroundColor;
  final Color textColor;
  final double fontSize;
  final EdgeInsetsGeometry padding;

  const ArcadeBadge({
    super.key,
    required this.text,
    this.backgroundColor = ArcadeTheme.acidYellow,
    this.textColor = ArcadeTheme.pureBlack,
    this.fontSize = 11,
    this.padding = const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
  });

  factory ArcadeBadge.importance(String importance) {
    switch (importance.toLowerCase()) {
      case 'essential':
      case 'ess':
        return const ArcadeBadge(
          text: 'ESS',
          backgroundColor: ArcadeTheme.arcadeGreen,
          textColor: ArcadeTheme.pureBlack,
        );
      case 'moderate':
      case 'mod':
        return const ArcadeBadge(
          text: 'MOD',
          backgroundColor: ArcadeTheme.acidYellow,
          textColor: ArcadeTheme.pureBlack,
        );
      case 'low':
      case 'low value':
        return const ArcadeBadge(
          text: 'LOW',
          backgroundColor: ArcadeTheme.punchPink,
          textColor: ArcadeTheme.pureWhite,
        );
      default:
        return ArcadeBadge(
          text: importance.toUpperCase(),
          backgroundColor: ArcadeTheme.slateMuted,
          textColor: ArcadeTheme.pureBlack,
        );
    }
  }

  factory ArcadeBadge.transactionType(String type) {
    if (type.toUpperCase() == 'INCOME' || type.toUpperCase() == 'CREDIT') {
      return const ArcadeBadge(
        text: '+ CRED',
        backgroundColor: ArcadeTheme.arcadeGreen,
        textColor: ArcadeTheme.pureBlack,
      );
    }
    return const ArcadeBadge(
      text: '- DEBT',
      backgroundColor: ArcadeTheme.punchPink,
      textColor: ArcadeTheme.pureWhite,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: ArcadeTheme.pureBlack, width: 1.5),
        boxShadow: const [
          BoxShadow(
            color: ArcadeTheme.pureBlack,
            offset: Offset(1.5, 1.5),
            blurRadius: 0,
          ),
        ],
      ),
      child: Text(
        text,
        style: TextStyle(
          color: textColor,
          fontSize: fontSize,
          fontWeight: FontWeight.w900,
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}
