# Noor Email Verification — Complete Flutter Handoff

Updated: 2026-10-10. Base URL: `https://noorapp-backend-production.up.railway.app/api/v1`.

## Release status

Saved locally, not deployed by this change. Coordinate backend deployment with Flutter: sign-up now returns **202 without user/tokens**, replacing immediate authentication. Existing accounts keep their current Login behavior; historical accounts are not automatically marked verified or forced to reverify. New public email/password sign-ups create an account only after verification. Pending sign-ups live outside `users`, preventing Login, refresh or password reset from activating them.

Gmail and other valid email providers are accepted. Verification proves mailbox access; it is not Google Sign-In or MFA. Do not strip Gmail dots/plus suffixes. Backend retains the existing trim/lowercase identity policy.

## 1. Start registration

`POST /auth/sign-up` (public):

```json
{"email":"person@gmail.com","password":"StrongPass123!","username":"noor_reader","fullName":"Noor Reader"}
```

Username and fullName are optional. HTTP 202 response uses the normal envelope:

```json
{
  "success":true,
  "message":"Check your email to complete registration",
  "data":{
    "verificationRequired":true,
    "verificationId":"92d6b82b-f1d9-4c3f-8bda-736508b179b9",
    "expiresAt":"2026-10-10T10:10:00.000Z",
    "resendAfterSeconds":60,
    "codeLength":6
  }
}
```

Use actual returned ID/time; examples are illustrative. Navigate to Verify Email, never Home. No account, access token, refresh token or OTP is returned. Keep the password only in transient form state; never log/store it in preferences. Username normalization retains ASCII-supported usernames; generated usernames use a random suffix. Uniqueness remains enforced at account creation.

## 2. Verify and create account

`POST /auth/verify-email` (public):

```json
{"verificationId":"92d6b82b-f1d9-4c3f-8bda-736508b179b9","code":"012345"}
```

HTTP 200:

```json
{"success":true,"message":"Email verified. Please log in.","data":{"emailVerified":true,"loginRequired":true}}
```

Then navigate to Login and use the existing `/auth/login` email/password contract. Verification does not issue a session. A successful code is single-use: if the success response was lost and retry fails, offer Login.

OTP is a STRING of six ASCII digits, preserving leading zeros. Normalize Arabic digits `٠١٢٣٤٥٦٧٨٩` and Persian digits `۰۱۲۳۴۵۶۷۸۹` to ASCII before submission. Support paste/autofill and accessible labeling. Never request mailbox/contact access or a Gmail password.

## 3. Resend

`POST /auth/resend-verification` (public):

```json
{"verificationId":"92d6b82b-f1d9-4c3f-8bda-736508b179b9"}
```

HTTP 202 returns the same pending data shape. Restart the countdown; use the latest code. Resend invalidates the old code. Disable resend for 60 seconds and during requests. Five sends per email per stored one-hour window; database limits apply across replicas, plus existing per-IP auth/sign-up limits.

Resend preserves wrong-attempt counts while the code is unexpired. Five wrong attempts block that active challenge. Expired challenges can be resent when cooldown/quota allow. Starting sign-up again can replace an older pending ID after cooldown: keep the newest returned ID. Changing email requires resubmitting the complete sign-up form, not editing the ID's email.

## Errors

- `400 VALIDATION_ERROR`: invalid body, UUID or code format.
- `400 INVALID_TOKEN`: wrong, expired, consumed or exhausted code. Valid for ten minutes; five failed guesses maximum. Offer latest-code entry, resend when allowed, or Login after a possibly completed verification.
- `409 EMAIL_ALREADY_EXISTS`: Login/Forgot Password. The existing duplicate-email disclosure behavior is retained; this flow does not claim enumeration resistance.
- `409 CONFLICT`: username/identity collision; offer another username/new attempt.
- `429 RATE_LIMIT_EXCEEDED`: cooldown, quota or IP limit. Avoid retry loops.
- `503 EMAIL_DELIVERY_UNAVAILABLE`: missing/unusable provider or failed provider submission. No account is created; retry later, never bypass verification.

Prevent concurrent/double requests; clear loading state in finally. Network timeout does not prove no email was sent or verification failed. Use `expiresAt` as a UTC instant; countdowns are presentation only. Auth responses are private/no-store.

## Profile and Google

Profile PATCH cannot change email directly. Old clients may echo the same current email; a different address receives 409. Make email read-only until a dedicated verified email-change flow is implemented. Other fields retain their contracts.

Google Sign-In remains separate. Its token response now requires a nonempty subject/email and a verified-email claim. Do not submit this registration OTP to `/auth/google`. This feature is not a full audit/replacement of existing Google token/audience handling.

## Backend deployment

New migration: `20261010130000_email_registration_verification`. Adds nullable `users.emailVerifiedAt` and `pending_registrations`.

Railway pre-deploy remains:

```sh
npx prisma migrate deploy
```

Start remains `npm start`. Do not manually replay CREATE statements or mark the migration applied without checking actual schema state.

Production SMTP credentials are present, but live Railway delivery failed with Connection timeout. Railway Free/Trial/Hobby disable SMTP. Use the new HTTPS adapter: `EMAIL_PROVIDER=brevo`, `BREVO_API_KEY` from Brevo API keys (NOT its SMTP key), and the existing verified `MAIL_FROM`. Deploy the adapter before selecting the new provider. Verification and password-reset share this HTTPS transport. Mock providers, missing senders and Resend test senders are refused. Provider acceptance is not proof of inbox delivery; run a dedicated real-mailbox test after rollout, including Spam.

Security: cryptographically random OTP; purpose-bound HMAC at rest; timing-safe comparison; hashed pending password; row locks for verification/resend; advisory lock for signup per email; transactional account creation/timestamp/code consumption. Failed attempts commit. Failed delivery invalidates only its matching code, never a newer resend. Rotating the HMAC/JWT secret invalidates pending codes.

Pending records older than 24 hours are purged on subsequent sign-ups. Cleanup is opportunistic, not periodic; expired records may remain if sign-ups stop. Keep database contents private and out of logs. Internal legacy test helpers are not public registration endpoints.

## Verification evidence

Build, Prisma validation and Swagger regression passed. Real PostgreSQL migration/service tests ran in a temporary isolated schema, then rolled back; production tables were not accessed.

Covered: HTTP 202 without tokens, no-store, malformed/localized API code rejection, no user before verification, hashes, verified timestamp, cooldown, invalidated old code, persisted five-attempt lockout, expiry, replay, duplicate account, provider failure/mock refusal, and profile email-change rejection.

Corrected regression tests stub the mail boundary and send no email. An earlier run mistakenly attempted SMTP delivery to an example test address before test isolation was fixed.

Before mobile release test: real Gmail/another inbox, Spam, leading zero, Arabic digit conversion, resend, expiry/wrong/latest code, timeout/offline, app restart, double taps, foreground countdown, confirmed Login, existing account Login, and handling of 202 by old clients. Never log passwords, OTPs or auth tokens.

