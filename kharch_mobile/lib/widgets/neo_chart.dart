import 'package:flutter/material.dart';

class NeoChartPainter extends CustomPainter {
  final List<double> values;
  final List<String> labels;
  final Color barColor;
  final Color borderColor;

  NeoChartPainter({
    required this.values,
    required this.labels,
    this.barColor = const Color(0xFFE2FD52),
    this.borderColor = Colors.black,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (values.isEmpty) return;

    final double maxVal = values.reduce((a, b) => a > b ? a : b);
    final double safeMax = maxVal <= 0 ? 1.0 : maxVal;

    final double barWidth = (size.width / values.length) * 0.65;
    final double gap = (size.width - (barWidth * values.length)) / (values.length + 1);

    final shadowPaint = Paint()
      ..color = Colors.black
      ..style = PaintingStyle.fill;

    final fillPaint = Paint()
      ..color = barColor
      ..style = PaintingStyle.fill;

    final strokePaint = Paint()
      ..color = borderColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0;

    for (int i = 0; i < values.length; i++) {
      final double x = gap + i * (barWidth + gap);
      final double normalizedH = (values[i] / safeMax) * (size.height - 24);
      final double h = normalizedH < 4 ? 4 : normalizedH;
      final double y = size.height - 20 - h;

      final barRect = RRect.fromRectAndRadius(
        Rect.fromLTWH(x, y, barWidth, h),
        const Radius.circular(6),
      );

      // Draw hard neo-brutal drop shadow
      final shadowRect = RRect.fromRectAndRadius(
        Rect.fromLTWH(x + 2, y + 2, barWidth, h),
        const Radius.circular(6),
      );
      canvas.drawRRect(shadowRect, shadowPaint);

      // Draw Bar fill
      canvas.drawRRect(barRect, fillPaint);

      // Draw Bar stroke
      canvas.drawRRect(barRect, strokePaint);

      // Draw bottom label
      if (i < labels.length) {
        final tp = TextPainter(
          text: TextSpan(
            text: labels[i],
            style: const TextStyle(
              color: Colors.white70,
              fontSize: 10,
              fontWeight: FontWeight.w800,
            ),
          ),
          textDirection: TextDirection.ltr,
        );
        tp.layout();
        tp.paint(canvas, Offset(x + (barWidth - tp.width) / 2, size.height - 16));
      }
    }
  }

  @override
  bool shouldRepaint(covariant NeoChartPainter oldDelegate) {
    return oldDelegate.values != values || oldDelegate.barColor != barColor;
  }
}
