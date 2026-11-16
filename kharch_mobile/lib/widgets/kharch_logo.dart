import 'package:flutter/material.dart';
import '../theme/arcade_theme.dart';

class KharchLogo extends StatelessWidget {
  final double size;
  final bool showShadow;
  final bool isWinking;

  const KharchLogo({
    super.key,
    this.size = 56,
    this.showShadow = true,
    this.isWinking = false,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _KharchCoinPainter(
          showShadow: showShadow,
          isWinking: isWinking,
        ),
      ),
    );
  }
}

class _KharchCoinPainter extends CustomPainter {
  final bool showShadow;
  final bool isWinking;

  _KharchCoinPainter({
    required this.showShadow,
    required this.isWinking,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = (size.width - 12) / 2;

    // 1. Draw Hard Drop Shadow
    if (showShadow) {
      final shadowPaint = Paint()
        ..color = ArcadeTheme.pureBlack
        ..style = PaintingStyle.fill;
      canvas.drawCircle(center + const Offset(4, 4), radius, shadowPaint);
    }

    // 2. Draw Coin Body (Vibrant Acid/Neon Yellow)
    final bodyPaint = Paint()
      ..color = ArcadeTheme.acidYellow
      ..style = PaintingStyle.fill;
    canvas.drawCircle(center, radius, bodyPaint);

    // 3. Draw Outer Thick Black Border
    final borderPaint = Paint()
      ..color = ArcadeTheme.pureBlack
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.0;
    canvas.drawCircle(center, radius, borderPaint);

    // 4. Draw Inner Dashed or Inset Ring
    final innerRingPaint = Paint()
      ..color = ArcadeTheme.pureBlack
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;
    canvas.drawCircle(center, radius * 0.78, innerRingPaint);

    // 5. Draw Rupee Symbol or Arcade Face
    final textPainter = TextPainter(
      text: const TextSpan(
        text: '₹',
        style: TextStyle(
          color: ArcadeTheme.pureBlack,
          fontSize: 22,
          fontWeight: FontWeight.w900,
          fontFamily: 'sans-serif',
        ),
      ),
      textDirection: TextDirection.ltr,
    );
    textPainter.layout();
    textPainter.paint(
      canvas,
      Offset(center.dx - textPainter.width / 2, center.dy - textPainter.height / 2 - 2),
    );

    // 6. Draw Cute Sparkle or Star Badge on top-right
    final starCenter = Offset(center.dx + radius * 0.55, center.dy - radius * 0.55);
    final sparklePaint = Paint()
      ..color = ArcadeTheme.punchPink
      ..style = PaintingStyle.fill;
    canvas.drawCircle(starCenter, 4.0, sparklePaint);
    final sparkleBorder = Paint()
      ..color = ArcadeTheme.pureBlack
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;
    canvas.drawCircle(starCenter, 4.0, sparkleBorder);
  }

  @override
  bool shouldRepaint(covariant _KharchCoinPainter oldDelegate) {
    return oldDelegate.showShadow != showShadow || oldDelegate.isWinking != isWinking;
  }
}
