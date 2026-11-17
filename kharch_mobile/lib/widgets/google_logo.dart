import 'package:flutter/material.dart';

/// Official Google 'G' Logo loaded directly from authentic Google PNG asset
class GoogleLogo extends StatelessWidget {
  final double size;

  const GoogleLogo({super.key, this.size = 24});

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      'assets/google_logo.png',
      width: size,
      height: size,
      fit: BoxFit.contain,
      errorBuilder: (_, __, ___) => Icon(
        Icons.g_mobiledata_rounded,
        size: size,
        color: const Color(0xFF4285F4),
      ),
    );
  }
}
