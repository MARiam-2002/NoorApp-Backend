# Noor Warsh source and font record

Text source: https://qul.tarteel.ai/resources/quran-script/qpc-warsh-script-ayah

The project owner supplied the downloaded JSON ZIP on 2026-10-10. Extracted bytes are preserved in `src/shared/data/qpc-warsh-script-ayah.json`. SHA-256: `4f1ca6245b059aafa3917e1ef06bd22e70d27f7b417f303e97dbcb5d60b77f7a`.

The source contains 6,214 records and all 114 surahs with Warsh-local numbering, no page metadata. Automated checks verify byte identity and structural continuity, not an independent scholarly review of every verse.

Font source: https://qul.tarteel.ai/resources/font/583

Matching font: `uthmanic-warsh-v21.ttf`. Its original binary is preserved. `QPC_WARSH_FONT_LICENSE.txt` preserves the embedded EULA and copyright, download URL and checksum. This is font license evidence, not separate text license evidence.

The archive and inspected text-resource page did not provide an explicit resource-specific text license. QUL's FAQ says commercial usage depends on each resource's terms: https://qul.tarteel.ai/faq . Record the actual text permission and corpus review before setting `WARSH_TEXT_APPROVED=true`. Do not treat font permission as permission for every other QUL resource.

Default release capability is disabled until that configuration is explicitly enabled. No production deployment or full device rendering test has been performed by the local implementation.
