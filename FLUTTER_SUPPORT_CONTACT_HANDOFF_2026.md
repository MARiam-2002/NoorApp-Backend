# Noor Help & Contact — Flutter handoff

Date: 23 October 2026. This is a contact/FAQ page, not an in-app chat, ticket system or WhatsApp automation. No support message is sent or stored by this API.

## Public API

`GET https://noorapp-backend-production.up.railway.app/api/v1/support`

Works for guests and signed-in users, standard `{success,data,message,...}` envelope. Cache-Control: public, max-age=300. Read `data.schemaVersion` (currently 1), titleAr/titleEn, responseMessageAr/En, businessHours, whatsapp, email, privacyNoteAr/En and faqs[]. Version is a schema version, not a reason to skip future content refreshes.

Configured contacts:

- WhatsApp: `<configured international number>` (the supplied `<supplied phone>`), direct URL `https://wa.me/<international digits>`.
- Email: `<configured support email>`.
- Approved Arabic text: **ابعتلنا رسالتك، وهنرد عليك في أقرب وقت ممكن.**
- English: **Send us your message and we will get back to you as soon as possible.**
- `businessHours` is null. Do not invent hours, a 24/7 service, an online/offline operator status or a guaranteed response deadline.

WhatsApp fields: enabled, phoneE164, displayPhone, url, urlAr, urlEn, labelAr, labelEn. The localized URLs prefill an editable greeting using proper percent encoding. Email fields: enabled, address, urlAr/urlEn (mailto links with encoded localized subject/body), labelAr/En. FAQ fields: id, questionAr/En, answerAr/En.

Use returned links; never concatenate user text into an unencoded URL. Validate expected schemes/hosts before opening: WhatsApp https://wa.me only; email mailto only. A disabled channel or null URL must not become an active button. A valid configured phone format does not establish that WhatsApp is installed or that an operator is currently available.

## Screen design

Add **الدعم والتواصل / Help & contact** to the Account/Settings menu; available without sign-in.

1. App bar with localized title and existing back behavior.
2. Short welcome/approved response message with no availability badge.
3. Primary WhatsApp contact card, icon, localized label and readable phone number; secondary accessible copy-phone action. Keep the phone number left-to-right inside the Arabic layout.
4. Secondary email card showing the address, open-mail action and copy-address fallback.
5. **الأسئلة الشائعة / Frequently asked questions** as an accessible accordion. Backend currently supplies four topics: sound, prayer location, progress and content corrections. Display the supplied answers as plain text. Do not rewrite the FAQ into guaranteed fixes.
6. Small privacy note below the contact actions: do not send a password or verification code.

Match Noor's existing typography, cream/navy/gold palette, light/dark theme and spacing. Respect RTL, larger text, screen readers, 48dp targets and long email wrapping. Do not put implementation/API details on the user-facing screen.

## Launch and failure behavior

- Open WhatsApp through the returned HTTPS link in an external application/browser. Do not require contacts permission, phone permission or permission to read WhatsApp messages.
- Opening a prefilled message is not sending it: leave the final send/edit decision to the user. Never report “message sent” or “ticket created” after opening a link.
- If the launcher fails, show a localized explanation and offer copy number/email and the other channel. No redirect loop or unsupported automatic deep-link fallback.
- Open mailto using an external mail app. If no handler exists, retain a working copy-email action.
- Do not silently attach account emails, tokens, user IDs, diagnostics, screenshots or religious activity. Optionally offer **Copy technical details** with app version, platform and phone model after a deliberate user action; the user reviews what they paste. Never include credentials or verification codes.
- Cache only this public response for offline access. Refresh on opening the page when online. If refresh fails, use the last valid public cache with a retry action. First-ever offline open: show an honest loading/offline state and retry; do not falsely display missing contacts as an operator outage.
- Keep support configuration independent of private account caches; logging out should not make this public page inaccessible.

## Backend maintenance

Contact details are never hardcoded in the public repository. Railway variables `SUPPORT_WHATSAPP_NUMBER` and `SUPPORT_EMAIL` configure them; update variables/apply deployment to change contacts without a new Flutter release. Unset, empty or invalid values disable that channel rather than creating an unsafe URL. The phone override must use international country code; formatting spaces, parentheses, + and hyphens are normalized. Do not supply a domestic leading-zero number.

FAQ copy and response wording are served by the backend; editing them requires a backend content/code deployment, not a mobile release. There is no admin editor in this change. No fixed response hours were configured.

## Acceptance checks

- Guest/signed-in, Arabic/English, light/dark theme and large text.
- Exact contact number and email; Arabic WhatsApp greeting decodes correctly.
- WhatsApp installed/not installed, mail handler absent, launcher error, copy feedback.
- Offline with/without a valid public cache; online refresh after contact changes.
- Null businessHours, disabled channel and unknown additive API fields.
- Opening a contact does not send a message, create a ticket, request contacts access or leak user data.

Backend checks cover pure configuration, contact normalization, invalid-link/header-injection rejection and a real local HTTP request with no authentication or database dependency. Actual mobile external-app launching still requires Flutter device tests.
