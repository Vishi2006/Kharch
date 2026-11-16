import 'package:flutter/material.dart';
import '../theme/arcade_theme.dart';

class ArcadeCard extends StatelessWidget {
  final Widget child;
  final Color fillColor;
  final Color borderColor;
  final Offset shadowOffset;
  final EdgeInsetsGeometry padding;
  final double radius;
  final VoidCallback? onTap;

  const ArcadeCard({
    super.key,
    required this.child,
    this.fillColor = ArcadeTheme.darkCard,
    this.borderColor = ArcadeTheme.pureBlack,
    this.shadowOffset = const Offset(4, 4),
    this.padding = const EdgeInsets.all(16),
    this.radius = ArcadeTheme.cornerRadius,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final container = Container(
      padding: padding,
      decoration: ArcadeTheme.neoBox(
        fillColor: fillColor,
        borderColor: borderColor,
        radius: radius,
        shadowOffset: shadowOffset,
      ),
      child: child,
    );

    if (onTap == null) return container;

    return GestureDetector(
      onTap: onTap,
      child: container,
    );
  }
}
