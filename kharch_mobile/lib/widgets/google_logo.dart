import 'dart:math' as math;
import 'package:flutter/material.dart';

/// Authentic Google 4-color 'G' logo drawn using CustomPainter
class GoogleLogo extends StatelessWidget {
  final double size;

  const GoogleLogo({super.key, this.size = 24});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        size: Size(size, size),
        painter: _GoogleLogoPainter(),
      ),
    );
  }
}

class _GoogleLogoPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final double w = size.width;
    final double h = size.height;
    final double stroke = w * 0.22;
    final double radius = (w - stroke) / 2;
    final Offset center = Offset(w / 2, h / 2);
    final Rect rect = Rect.fromCircle(center: center, radius: radius);

    final Paint bluePaint = Paint()
      ..color = const Color(0xFF4285F4)
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.butt;

    final Paint greenPaint = Paint()
      ..color = const Color(0xFF34A853)
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.butt;

    final Paint yellowPaint = Paint()
      ..color = const Color(0xFFFBBC05)
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.butt;

    final Paint redPaint = Paint()
      ..color = const Color(0xFFEA4335)
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.butt;

    // Draw the 4 colored arcs of Google's 'G'
    // Red arc: Top-left to top-right
    canvas.drawArc(rect, -math.pi * 0.75, math.pi * 0.58, false, redPaint);

    // Yellow arc: Left bottom
    canvas.drawArc(rect, -math.pi * 1.25, math.pi * 0.50, false, yellowPaint);

    // Green arc: Bottom to bottom-right
    canvas.drawArc(rect, math.pi * 0.25, math.pi * 0.50, false, greenPaint);

    // Blue arc: Right side connecting to crossbar
    canvas.drawArc(rect, -math.pi * 0.17, math.pi * 0.42, false, bluePaint);

    // Blue horizontal crossbar
    final Paint barPaint = Paint()
      ..color = const Color(0xFF4285F4)
      ..style = PaintingStyle.fill;

    final double barHeight = stroke;
    final double barY = center.dy - barHeight / 2;
    final Rect barRect = Rect.fromLTWH(
      center.dx - w * 0.04,
      barY,
      w * 0.54,
      barHeight,
    );
    canvas.drawRect(barRect, barPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
