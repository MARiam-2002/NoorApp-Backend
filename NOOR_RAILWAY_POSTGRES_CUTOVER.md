# Noor Railway PostgreSQL cutover — 2026-10-18

## Completed

Owner explicitly accepted a fresh database and loss of old test accounts/progress. No Neon data was migrated and the Neon project was not deleted.

Created Railway Postgres (PostgreSQL 18.6) in desirable-insight / production with persistent storage. Backend DATABASE_URL and DIRECT_URL now use the Railway private connection. The local ignored .env uses the password-protected public TCP connection with sslmode=require; TLS was verified. Never copy connection strings into Flutter, Git, screenshots or support messages.

Applied 39 migrations, including two new schema-reconciliation migrations saved in the repository. Prisma migrate diff against the current schema returned no differences. A schema generation step refreshed the local Prisma client.

Seeded existing reviewed local content: 114 surahs, 6,236 ayahs, 366 daily verses, 366 daily hadith entries, 366 challenge templates, 14 adhkar categories / 93 items, and 80 stance situations. Daily-content entries are a year schedule; these counts do not imply 366 unique source passages. Restored the previously authorized noor@example.com test account with its previously agreed password. Old users must register again; old sessions are not migrated.

## Live verification

Login 200; refresh 200; old refresh reuse 401; concurrent refresh produced exactly one 200 and one 401. Successful API GETs: health (database connected), dashboard, journey/dashboard, travel, travel/schedule, reading/goal, profile/azan-preferences, content/verse-of-day, content/hadith-of-day, stances/today and azan/sounds. Root, docs, privacy and terms returned 200. Local checks also passed actual PostgreSQL rotation/concurrency and TypeScript checking.

The successful deployment is 89e0c291-f48c-47a8-bcdb-97a7e3497770, using existing GitHub commit c626be36397ccbe046277369c92c81780874ea34. Deployed auth, travel and profile source matches local source. A separate local archive upload timed out and is FAILED; it did not replace the successful deployment.

## Save these repository changes to GitHub

- prisma/migrations/20261018061000_missing_enum_values/migration.sql
- prisma/migrations/20261018061100_schema_reconciliation/migration.sql
- prisma/migrations/migration_lock.toml

These are already applied to Railway. Commit them to retain the database history for future deployments. Do not reset the database, mark failed migrations applied without verification, or replace DATABASE_URL with the old Neon URL. Retain npx prisma migrate deploy as pre-deploy.

## Flutter

API base URL, routes, request/response format and token fields are unchanged. This cutover does not require a networking contract change. Existing test users need new accounts. Clear account-specific cached content when switching accounts; do not submit cached progress under a new account automatically. Keep the single-flight refresh/persist-both-tokens requirements from FLUTTER_NOOR_REFRESH_TOKEN_RELIABILITY.md.

## Required owner actions and limits

1. If Google Play App access uses different reviewer credentials, recreate that account or update Play Console before review. Do not assume the old review account survived.
2. Complete real Android/iOS end-to-end testing, including registration/email, reminders/audio, location refresh, app restart and expired access-token recovery. HTTP smoke tests are not physical-device certification.
3. Railway rejected built-in manual and scheduled volume backups with: Manual backups and backup schedules are only available for Pro workspaces. No Pro upgrade was performed. A private initial JSON table export (57 tables, repeatable-read snapshot, SHA-256 recorded in the work log) was retained locally; it is not pg_dump, has not been restore-tested and is not recurring disaster recovery. Configure an independent scheduled PostgreSQL backup plus restore testing, or select an appropriate managed backup plan before public launch.
4. Hobby is usage billed with a minimum plan charge, not a fixed database bill. Monitor actual DB and backend usage; earlier cost scenarios were estimates.
5. Keep Neon intact for potential recovery after its allowance resets. Its old users/progress are not present in Railway.

The public TCP proxy remains for authenticated local development. Production backend traffic uses the private host. Keep credentials secret and only open public database access where needed.
