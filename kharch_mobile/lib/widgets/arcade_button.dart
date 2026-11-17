import 'package:flutter/services.dart';
import 'package:flutter/material.dart';
import '../theme/arcade_theme.dart';
import 'cute_coin_loader.dart';

class ArcadeButton extends StatefulWidget {
  final String text;
  final VoidCallback? onTap;
  final Color backgroundColor;
  final Color textColor;
  final IconData? icon;
  final bool isLoading;
  final String loadingText;
  final double height;
  final double? width;
  final double fontSize;
  final double radius;

  const ArcadeButton({
    super.key,
    required this.text,
    this.onTap,
    this.backgroundColor = ArcadeTheme.acidYellow,
    this.textColor = ArcadeTheme.pureBlack,
    this.icon,
    this.isLoading = false,
    this.loadingText = 'Crunching...',
    this.height = 52,
    this.width,
    this.fontSize = 15,
    this.radius = ArcadeTheme.cornerRadius,
  });

  @override
  State<ArcadeButton> createState() => _ArcadeButtonState();
}

class _ArcadeButtonState extends State<ArcadeButton> {
  bool _isPressed = false;

  void _handleTap() {
    if (widget.isLoading || widget.onTap == null) return;
    widget.onTap!();
  }

  @override
  Widget build(BuildContext context) {
    final effectiveShadow = _isPressed || widget.isLoading
        ? const Offset(1, 1)
        : const Offset(4, 4);

    final effectiveTranslation = _isPressed || widget.isLoading
        ? const Offset(2, 2)
        : Offset.zero;

    return GestureDetector(
      onTapDown: (_) {
        if (!widget.isLoading && widget.onTap != null) {
          HapticFeedback.lightImpact();
          setState(() => _isPressed = true);
        }
      },
      onTapUp: (_) {
        if (_isPressed) {
          setState(() => _isPressed = false);
          _handleTap();
        }
      },
      onTapCancel: () {
        if (_isPressed) {
          setState(() => _isPressed = false);
        }
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 70),
        transform: Matrix4.translationValues(
          effectiveTranslation.dx,
          effectiveTranslation.dy,
          0,
        ),
        width: widget.width,
        height: widget.height,
        decoration: BoxDecoration(
          color: widget.onTap == null
              ? ArcadeTheme.slateMuted.withValues(alpha: 0.5)
              : widget.backgroundColor,
          borderRadius: BorderRadius.circular(widget.radius),
          border: Border.all(
            color: ArcadeTheme.pureBlack,
            width: ArcadeTheme.borderWidth,
          ),
          boxShadow: ArcadeTheme.neoShadow(offset: effectiveShadow),
        ),
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: widget.isLoading
            ? Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const CuteCoinLoader(compact: true, coinSize: 22),
                  const SizedBox(width: 8),
                  Text(
                    widget.loadingText,
                    style: TextStyle(
                      color: widget.textColor,
                      fontWeight: FontWeight.w900,
                      fontSize: widget.fontSize,
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (widget.icon != null) ...[
                    Icon(widget.icon, color: widget.textColor, size: 20),
                    const SizedBox(width: 8),
                  ],
                  Text(
                    widget.text,
                    style: TextStyle(
                      color: widget.textColor,
                      fontWeight: FontWeight.w900,
                      fontSize: widget.fontSize,
                      letterSpacing: 0.6,
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}
