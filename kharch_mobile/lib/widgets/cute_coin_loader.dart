import 'package:flutter/material.dart';
import '../theme/arcade_theme.dart';
import 'kharch_logo.dart';

class CuteCoinLoader extends StatefulWidget {
  final String message;
  final double coinSize;
  final bool compact;

  const CuteCoinLoader({
    super.key,
    this.message = 'Crunching coins...',
    this.coinSize = 38,
    this.compact = false,
  });

  @override
  State<CuteCoinLoader> createState() => _CuteCoinLoaderState();
}

class _CuteCoinLoaderState extends State<CuteCoinLoader>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _bounceAnimation;
  late Animation<double> _rotationAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 650),
    )..repeat(reverse: true);

    _bounceAnimation = Tween<double>(begin: 0.0, end: -8.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );

    _rotationAnimation = Tween<double>(begin: -0.06, end: 0.06).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.compact) {
      return AnimatedBuilder(
        animation: _controller,
        builder: (context, child) {
          return Transform.translate(
            offset: Offset(0, _bounceAnimation.value),
            child: Transform.rotate(
              angle: _rotationAnimation.value,
              child: KharchLogo(size: widget.coinSize, showShadow: false),
            ),
          );
        },
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: ArcadeTheme.neoBox(
        fillColor: ArcadeTheme.creamWhite,
        radius: ArcadeTheme.cornerRadius,
        shadowOffset: const Offset(3, 3),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          AnimatedBuilder(
            animation: _controller,
            builder: (context, child) {
              return Transform.translate(
                offset: Offset(0, _bounceAnimation.value),
                child: Transform.rotate(
                  angle: _rotationAnimation.value,
                  child: KharchLogo(size: widget.coinSize, showShadow: false),
                ),
              );
            },
          ),
          const SizedBox(width: 12),
          Text(
            widget.message,
            style: const TextStyle(
              color: ArcadeTheme.pureBlack,
              fontWeight: FontWeight.w900,
              fontSize: 14,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }
}
