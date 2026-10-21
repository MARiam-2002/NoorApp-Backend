# Noor live reminder recovery — 21 October 2026

## Verified live evidence

- API health returned HTTP 200 and `data.database=connected`.
- The in-process minute scheduler is enabled by production defaults. The latest retrieved delivery summaries included 35 attempted / 35 accepted by FCM at 16:36:02 UTC. FCM acceptance does not prove device display or audio playback.
- The external ten-minute safety-net trigger failed at 09:41:55 UTC with `UND_ERR_CONNECT_TIMEOUT` against the public HTTPS endpoint. Its previous invocation succeeded. This is a network connection failure, not evidence of incorrect prayer calculation.
- The 21 October backup completed at 02:02:06 UTC with `restoreVerified=true`, 64 tables, and 826,284 encrypted bytes. This is a real isolated restore, not merely a successful image build.
- Railway refused a new manual backup deployment with `Deploys have been paused temporarily`. Its official status page reports builds/deployments paused. Do not describe new code as deployed while this persists.
- The current live `/api/v1/devices/notification-channels` returns 404. The schema-v2 contract exists in the pending source, not in the currently running image.

## Prepared fix

`scripts/run-reminder-cron.cjs` replaces the inline one-shot fetch:

- Four attempts maximum; each fetch/body has a 20-second abort deadline, with 1/3/7-second backoff. Network errors, HTTP 429 and HTTP 5xx can retry. Authentication/other permanent errors fail immediately.
- Uses POST and the `x-cron-secret` header. Never puts credentials in the URL or logs response bodies/fetch exceptions. Redirects are rejected to prevent credential forwarding.
- Requires an explicit successful JSON envelope. Exits nonzero on exhaustion; an outage is not reported as success.
- Optional `REMINDER_CRON_URL` and `REMINDER_CRON_FALLBACK_URL` allow verified Railway private networking plus public HTTPS fallback. Keep the public default until private DNS/port connectivity has actually been checked from the cron service.
- The existing per-minute scheduler, in-flight gate and persisted notification claims remain authoritative. This runner never invents or replays old prayer occurrences.

`railway.cron.json` documents a separate configuration for **refreshing-endurance only**: every ten minutes, restart policy NEVER. Do not apply this file to the API service. Do not run database migrations from the cron service. Railway rejected selecting a new JSON configuration file because it now requires Infrastructure as Code for that operation. The existing cron service's start command was instead successfully updated through the supported API to `node scripts/run-reminder-cron.cjs`; its current schedule was already `*/10 * * * *`. This setting needs a new source deployment before it can take effect. The running API configuration was not changed.

## Activation after Railway recovers

1. Verify a sufficiently recent completed backup and its restore result; run a fresh backup before the API migrations if data changed materially.
2. Push the tested commits and require the Backend checks workflow to pass, including the disposable PostgreSQL migration/concurrency tests.
3. Verify the cron service's already-saved start command is `node scripts/run-reminder-cron.cjs` (service ID `4d0a11b0-45db-4508-a65c-c60b8fb4bb30`, production environment), schedule is every ten minutes, and restart policy NEVER. Inspect the resolved deployment manifest: it must run this script, not the API server, and must not inherit the API health check or database migration command. Do not attempt to select a new JSON config file through the API; that operation is rejected. Keep the API's existing configuration unchanged. A future IaC migration should be separately scoped and reviewed.
4. Deploy the API and confirm migrations, connected health and channel manifest schema version 2. Deploy the cron from the latest source; redeploying an old image cannot include the new script.
5. Confirm `reminder_trigger_completed` from a real scheduled invocation, then another invocation. Inspect API reminder summaries as well. Avoid repeatedly invoking the authenticated reminder route for testing: it sends genuinely due notifications.
6. Test Google login and notification audio on the actual published Flutter build. This operational change does not bundle missing native sound files or repair channels on old clients; the existing Flutter handoff remains required.

## Validation and remaining limits

The runner's deterministic offline tests exercise network recovery, HTTP 503 retry, authorization fail-fast, bounded exhaustion, secret-safe logging, invalid responses and private/public fallback. The prayer/FCM/audio contract regression suite also passed. These tests send no production push.

Production changes remain subject to Railway availability. Dependency audit still reports 12 findings (4 high / 8 moderate); the suggested Prisma, Firebase and Nodemailer fixes involve major-version changes and require separate compatibility validation, not `npm audit fix --force` on a live application. No 100% availability, real-device audio or full security certification is implied.
