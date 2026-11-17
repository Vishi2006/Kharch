import 'package:flutter/material.dart';

class ArcadeTheme {
  // Funky Arcade Neo-Brutal Colors (Wyb App inspired)
  static const Color acidYellow = Color(0xFFE2FD52);
  static const Color arcadeViolet = Color(0xFF8B5CF6);
  static const Color deepViolet = Color(0xFF6D28D9);
  static const Color neonCyan = Color(0xFF00F0FF);
  static const Color punchPink = Color(0xFFFF2E93); // Vibrant Neo-Brutalist Punch Pink
  static const Color punchPinkLight = Color(0xFFFFE5EE);
  static const Color arcadeGreen = Color(0xFF00E676);
  
  // Warm Beige / Off-White Canvas for authentic high-contrast Neo-Brutalism
  static const Color lightCanvas = Color(0xFFF7F4EB); // Warm off-white / light beige canvas
  static const Color darkCanvas = Color(0xFFF7F4EB);  // Primary app background
  static const Color darkCard = Color(0xFFFFFFFF);    // Pure white Neo-Brutalist card fill
  static const Color darkCardLight = Color(0xFFF7F4EB); // Warm light beige elevated container
  static const Color cardWhite = Color(0xFFFFFFFF);
  static const Color pureBlack = Color(0xFF000000);
  static const Color pureWhite = Color(0xFFFFFFFF);
  static const Color creamWhite = Color(0xFFFFFBEA);
  static const Color slateMuted = Color(0xFF94A3B8);
  static const Color slateDark = Color(0xFF475569);
  static const Color textDark = Color(0xFF0F172A);

  // Border & Shadow Specs
  static const double borderWidth = 2.5;
  static const double cornerRadius = 14.0;
  static const double pillRadius = 100.0;

  static List<BoxShadow> neoShadow({
    Offset offset = const Offset(4, 4),
    Color color = pureBlack,
  }) {
    return [
      BoxShadow(
        color: color,
        offset: offset,
        blurRadius: 0,
        spreadRadius: 0,
      ),
    ];
  }

  static BoxDecoration neoBox({
    Color fillColor = pureWhite,
    Color borderColor = pureBlack,
    double radius = cornerRadius,
    Offset shadowOffset = const Offset(4, 4),
    Color shadowColor = pureBlack,
  }) {
    return BoxDecoration(
      color: fillColor,
      borderRadius: BorderRadius.circular(radius),
      border: Border.all(color: borderColor, width: borderWidth),
      boxShadow: neoShadow(offset: shadowOffset, color: shadowColor),
    );
  }

  static TextStyle get arcadeTitle => const TextStyle(
        fontFamily: 'sans-serif',
        fontWeight: FontWeight.w900,
        fontSize: 22,
        letterSpacing: 0.5,
        color: pureWhite,
      );

  static TextStyle get arcadeScore => const TextStyle(
        fontFamily: 'sans-serif',
        fontWeight: FontWeight.w900,
        fontSize: 32,
        letterSpacing: 1.0,
        color: pureBlack,
      );

  static TextStyle get arcadeLabel => const TextStyle(
        fontFamily: 'sans-serif',
        fontWeight: FontWeight.w800,
        fontSize: 13,
        letterSpacing: 0.6,
      );

  static TextStyle get bodyBold => const TextStyle(
        fontFamily: 'sans-serif',
        fontWeight: FontWeight.w700,
        fontSize: 14,
        color: pureWhite,
      );
}
