import 'package:flutter/material.dart';

class KharchLogo extends StatelessWidget {
  final double size;
  final bool showShadow;

  const KharchLogo({
    super.key,
    this.size = 56,
    this.showShadow = true,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: const Color(0xFFE2FD52),
        borderRadius: BorderRadius.circular(size * 0.28),
        border: Border.all(color: Colors.black, width: size > 40 ? 2.5 : 2.0),
        boxShadow: showShadow
            ? [
                BoxShadow(
                  color: Colors.black,
                  offset: Offset(size > 40 ? 3.5 : 2.0, size > 40 ? 3.5 : 2.0),
                  blurRadius: 0,
                ),
              ]
            : null,
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(size * 0.28),
        child: Image.asset(
          'assets/logo.png',
          width: size,
          height: size,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => Center(
            child: Text(
              '₹',
              style: TextStyle(
                fontSize: size * 0.58,
                fontWeight: FontWeight.w900,
                color: Colors.black,
                height: 1.0,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
