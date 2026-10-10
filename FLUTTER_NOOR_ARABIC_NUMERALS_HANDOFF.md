# Noor — Arabic Numerals and Locale Formatting

## Product decision

When the user selects Arabic in Noor, display Arabic-Indic digits `٠١٢٣٤٥٦٧٨٩` in user-facing quantities. When English is selected, display `0123456789`. Follow Noor's selected language, not the device language. This is an explicit Noor product rule, not a universal rule for every Arabic-speaking country. Do not claim this is a Google Play requirement or a guaranteed 2027 industry standard.

This change primarily belongs to Flutter's presentation layer. Keep backend JSON numbers, canonical decimal strings, dates, IDs and request payloads unchanged. No new database migration is required.

The backend already formats prayer notification clocks with Arabic digits. A small backend adjustment also formats pre-reminder minute counts with Arabic digits (`١٥ دقيقة`). That source change needs deployment to affect backend-generated notifications. Flutter must continue to use the existing notification ownership rules and must not generate a second notification to localize its text.

## Scope

Apply the same policy to Home, Quran, Khatmah, prayer schedules, countdowns, badges, unread counts, points, tasbih, ayah/surah/page numbers, journey progress, percentages, Zakat, reports, charts, settings and accessible labels.

| English | Arabic display |
| --- | --- |
| `300 points` | `٣٠٠ نقطة` |
| `4 notifications` | badge `٤` |
| `04:16:39` | `٠٤:١٦:٣٩` |
| `12:42 PM` | `١٢:٤٢ م` |
| `42` | `٤٢` |
| `25%` | `٢٥٪` |
| `1,234.50 EGP` | `١٬٢٣٤٫٥٠` with a localized currency label |

Use localized calendar text too: Arabic day/month labels and `ص` / `م`. The screenshot's `Current location` must come from the Arabic translation resource (`الموقع الحالي`). Do not hard-code that English label in Arabic mode.

Do not convert email addresses, URLs, UUIDs, access tokens, quote tokens, API codes, ISO currency codes, versions or diagnostic text. Keep OTP/phone machine values canonical; localized visual entry may be supported only if input is normalized before submission.

## Locale setup

Integrate with the app's existing localization and state management. Do not replace its localization framework just for digits. Use `flutter_localizations`, ARB/generated translations where already configured, and a Flutter-compatible `intl` dependency. Avoid pinning an unverified package version in this handoff.

```dart
MaterialApp(
  locale: selectedLocale, // persisted Noor language preference
  supportedLocales: const [Locale('ar'), Locale('en')],
  localizationsDelegates: const [
    // Include the application's generated AppLocalizations.delegate here.
    GlobalMaterialLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
  ],
  // Existing routes/theme/home...
);
```

Imports: `package:flutter/material.dart`, `package:flutter_localizations/flutter_localizations.dart`, `package:intl/intl.dart`. Initialize date symbols for formatting locales if the existing startup flow has not already initialized them (`initializeDateFormatting` from `package:intl/date_symbol_data_local.dart`).

Use `ar_EG` for number/date formatting when Noor Arabic mode requires these digits, while keeping the actual chosen language locale for translations. A selected country/timezone/currency is independent of the UI language. Arabic does not mean every user is in Egypt or uses EGP.

## Centralized display helper

Keep formatting in one shared helper rather than hundreds of `.toString()` calls. The final digit shaping below makes the explicit Noor digit policy deterministic even if a locale's default numeral choice differs.

```dart
class NoorNumbers {
  NoorNumbers(this.arabic);
  final bool arabic;
  String get formatLocale => arabic ? 'ar_EG' : 'en_US';

  String shape(String formattedDisplayText) {
    const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
    if (!arabic) return formattedDisplayText;
    return formattedDisplayText.replaceAllMapped(
      RegExp(r'[0-9]'),
      (match) => arabicDigits[int.parse(match.group(0)!)],
    );
  }

  String count(int value, {bool grouping = true}) {
    final formatter = NumberFormat.decimalPattern(formatLocale);
    if (!grouping) formatter.turnOffGrouping();
    return shape(formatter.format(value));
  }

  String countdown(Duration remaining) {
    final seconds = remaining.inSeconds < 0 ? 0 : remaining.inSeconds;
    final hours = seconds ~/ 3600; // do not wrap at 24 hours
    final minutes = (seconds % 3600) ~/ 60;
    final lastSeconds = seconds % 60;
    String pad(int value) => value.toString().padLeft(2, '0');
    return shape('${pad(hours)}:${pad(minutes)}:${pad(lastSeconds)}');
  }

  String ratio(int completed, int target) =>
      '${count(completed, grouping: false)}/${count(target, grouping: false)}';

  String percentage(num value) {
    // Use this for numeric percentages from the API, e.g. 25 means 25%.
    // NumberFormat.percentPattern expects a fraction, so convert only here.
    final formatter = NumberFormat.percentPattern(formatLocale)
      ..maximumFractionDigits = 2;
    return shape(formatter.format(value / 100));
  }

  String prayerClock(DateTime alreadyInPrayerTimezone,
      {required bool use24HourClock}) {
    final pattern = use24HourClock ? 'HH:mm' : 'h:mm a';
    return shape(DateFormat(pattern, formatLocale)
        .format(alreadyInPrayerTimezone));
  }

  String gregorianDateOnly(String isoDate) {
    final match = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$').firstMatch(isoDate);
    if (match == null) throw FormatException('Expected YYYY-MM-DD');
    final year = int.parse(match.group(1)!);
    final month = int.parse(match.group(2)!);
    final day = int.parse(match.group(3)!);
    final date = DateTime(year, month, day);
    if (date.year != year || date.month != month || date.day != day) {
      throw FormatException('Invalid calendar date');
    }
    return shape(DateFormat.yMMMMd(formatLocale).format(date));
  }

  String canonicalMoney(String value, {required int minorUnitDigits}) {
    // Display an already-rounded backend decimal without double conversion.
    // This method never computes liability, payment amounts or exchange rates.
    if (minorUnitDigits < 0 || minorUnitDigits > 6 ||
        !RegExp(r'^\d+(\.\d+)?$').hasMatch(value)) {
      throw FormatException('Invalid canonical money');
    }
    final parts = value.split('.');
    var integer = parts[0].replaceFirst(RegExp(r'^0+(?=\d)'), '');
    var fraction = parts.length == 2 ? parts[1] : '';
    if (fraction.length > minorUnitDigits) {
      final discarded = fraction.substring(minorUnitDigits);
      if (discarded.contains(RegExp(r'[1-9]'))) {
        throw FormatException('Backend amount requires additional precision');
      }
      fraction = fraction.substring(0, minorUnitDigits);
    }
    fraction = fraction.padRight(minorUnitDigits, '0');
    final group = arabic ? '٬' : ',';
    final decimal = arabic ? '٫' : '.';
    integer = integer.replaceAllMapped(
      RegExp(r'(\d)(?=(\d{3})+(?!\d))'),
      (match) => '${match.group(1)}$group',
    );
    return shape(minorUnitDigits == 0
        ? integer : '$integer$decimal$fraction');
  }
}
```

Use `canonicalMoney` with the backend's currency minor-unit precision, not a hard-coded two decimals. For example, JPY=0, EGP/USD=2, KWD=3. Saved Zakat assessments expose `minorUnitDigits`; retain that metadata. Reference metal prices have six decimal places and may be displayed separately at that precision without changing the signed price string. Add translated currency names in a separate label; keep `currency: "EGP"` unchanged in requests. Financial values remain strings and never pass through `double.parse` for computation or round-trips.

The snippets are integration guidance, not compiled Flutter code: the actual Flutter repository has not been supplied. Adapt and run analyzer/tests in that repository.

## Dates, timezones and Hijri dates

- Treat `YYYY-MM-DD` as a calendar date. Do not turn it into UTC midnight and call `.toLocal()`: that can change the day.
- For UTC instants, convert using the relevant account/prayer IANA timezone before formatting. Dart `DateTime.toLocal()` uses the device timezone and cannot represent arbitrary cities. Use the existing timezone integration for remote prayer locations.
- Digit shaping never changes an instant, prayer time, DST rule, calculation method or lunar anniversary.
- Gregorian `intl.DateFormat` does not calculate Hijri dates. Use the existing approved Hijri source/logic and localize its numbers/month names. Do not label a Gregorian date as Hijri.
- Calculate countdowns from prayer UTC instants, refresh on resume and clamp elapsed values at zero. Formatting only controls display.

## RTL and accessibility

The page remains RTL in Arabic and LTR in English. A countdown/time/ratio is a left-to-right numeric sequence even inside Arabic UI. Keep its numeric span in a localized `Directionality(textDirection: TextDirection.ltr, ...)` and place Arabic labels separately. Confirm the numerator/denominator semantics: `٤/٥` must mean four completed of five, not five of four.

For numeric spans embedded in a sentence, prefer separate text widgets or bidi isolation rather than reversing strings. Avoid storing invisible bidi marks in form values or API payloads. The font must support Arabic-Indic digits with comparable weight and legible small sizes; verify real devices and large text scaling. Countdown widths should not jump between digits. Confirm tabular-number support in the selected font before relying on it.

Use localized `Semantics` labels such as completed-of-total and remaining time. Do not announce a countdown every second to screen readers. Announce important state changes, not every animation frame.

## Numeric inputs

Display policy and input protocol are separate. Accept Arabic-Indic and Persian typed digits, normalize locally, validate, then send ASCII canonical values. Passwords, tokens, URLs and free text must never go through numeric normalization.

```dart
String normalizeNumericInput(String input) {
  const arabic = '٠١٢٣٤٥٦٧٨٩';
  const persian = '۰۱۲۳۴۵۶۷۸۹';
  var result = input.trim();
  for (var i = 0; i < 10; i++) {
    result = result.replaceAll(arabic[i], '$i')
        .replaceAll(persian[i], '$i');
  }
  return result.replaceAll('٫', '.');
}
```

For money entry, avoid grouping separators while editing and reject ambiguous commas/thousands separators rather than silently stripping them. Apply the backend's decimal-string regex, maximum size and precision rules after normalization. For payment entries, validate the currency's minor-unit precision. Preserve caret/composing behavior with a proper `TextInputFormatter` if transforming visible input; do not mutate the controller on every build. Reformat only at safe interaction boundaries such as blur/confirmation. Do not send Arabic display digits in API payloads.

## Runtime language switch

Persist the user's language, rebuild visible numeric text immediately after a switch, invalidate formatter caches keyed by locale, and refresh screen-reader labels. Changing Noor language must not change country, timezone, currency, underlying amounts or existing Zakat records. For backend notifications, synchronize the existing language preference endpoints. Already-delivered OS notifications do not automatically change when the app language changes.

## Backend responsibilities

No changes are needed to API numeric fields, decimal strings, date contracts, database columns or calculation algorithms. No new endpoint is required for digit formatting. Existing Arabic prayer clock copy remains Arabic; the new pre-reminder minute display adjustment is the only backend source change for this handoff. Deploy it normally. Flutter should use notification text in its selected language and must not reschedule backend-owned notifications.

Do not broadly translate digits in stored Quran text, citations or server response blobs. Use trusted Quran text as provided, and format separately-rendered ayah/page labels. Backend-authored Arabic display text may already contain Arabic digits: the display shaper is idempotent for those digits.

## Acceptance checks

1. Arabic app + English device: all scoped display numbers remain Arabic-Indic. English app + Arabic device: display numbers are Latin.
2. Switch languages on an open Home/calculator screen; values stay the same and formatting changes immediately. Relaunch preserves choice.
3. Check screenshot fields: points `٣٠٠`, unread badge `٤`, countdown `٠٤:١٦:٣٩`, prayer clock `١٢:٤٢ م`, verse label `٤٢`, localized Gregorian date and Arabic location label.
4. Check 0, leading zero countdowns, 100%, large counters, completed/target order, 0/0 empty states and long durations. Never derive a division by zero for a progress bar.
5. Validate exact EGP/KWD/JPY money formatting and a large decimal string without precision loss. Signed quotes and payment payloads remain byte-for-byte canonical where required.
6. Enter `١٢٣٫٤٥` and `۱۲۳٫۴۵`: both normalize to `123.45`. Reject malformed separators, negatives where disallowed, excessive decimals and invalid dates.
7. Check date-only values in positive/negative timezone offsets and DST. Hijri calendar values must retain their original semantics.
8. Check RTL layout, numeric bidi isolation, TalkBack/VoiceOver, large text, different keyboards, foreground/background/resume and Arabic font support.
9. Verify backend notifications after deploying the minute display change, without enabling duplicate Flutter scheduling.
10. Confirm no converted digits appear in requests, IDs, tokens, URLs, email values or diagnostic logs.

## Official references

- [Flutter internationalization](https://docs.flutter.dev/ui/internationalization)
- [Flutter Material localizations](https://api.flutter.dev/flutter/flutter_localizations/GlobalMaterialLocalizations-class.html)
- [intl NumberFormat](https://pub.dev/documentation/intl/latest/intl/NumberFormat-class.html)
- [intl DateFormat](https://api.flutter.dev/flutter/package-intl_intl/DateFormat-class.html)
