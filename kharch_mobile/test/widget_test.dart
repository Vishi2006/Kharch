import 'package:flutter_test/flutter_test.dart';
import 'package:kharch_mobile/main.dart';
import 'package:kharch_mobile/providers/app_state.dart';
import 'package:kharch_mobile/widgets/arcade_badge.dart';
import 'package:kharch_mobile/widgets/kharch_logo.dart';

void main() {
  testWidgets('Kharch App renders with Arcade Logo', (WidgetTester tester) async {
    final appState = AppState();
    await tester.pumpWidget(KharchApp(appState: appState));

    // Verify KharchLogo is present in the tree
    expect(find.byType(KharchLogo), findsWidgets);
  });

  test('ArcadeBadge renders importance tags correctly', () {
    final ess = ArcadeBadge.importance('essential');
    expect(ess.text, 'ESS');

    final mod = ArcadeBadge.importance('moderate');
    expect(mod.text, 'MOD');

    final low = ArcadeBadge.importance('low');
    expect(low.text, 'LOW');
  });
}
