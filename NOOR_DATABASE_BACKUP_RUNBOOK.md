# Noor database backups — deployed runbook

Date: 2026-10-18. This backup job is independent of the Flutter client and the API deployment.

## Live setup

- Service: noor-db-backup, desirable-insight / production, Railway EU West.
- Storage: private S3-compatible bucket noor-db-backups (Amsterdam), independent of the database volume but in the same Railway account/provider.
- Schedule: 02:00 UTC daily. Cairo local time changes with daylight saving (05:00 when UTC+3, 04:00 when UTC+2). Next run verified at setup: 2026-10-19 02:00 UTC.
- Retention: 14 days. Historical encrypted objects are deleted only after a new uploaded copy downloads, authenticates and restores successfully. The small latest-success.json marker is retained separately.
- Format: PostgreSQL 18 custom pg_dump, bundled with its snapshot manifest, encrypted using AES-256-GCM with a random nonce. Both database data and the manifest are encrypted.
- Source access: restricted noor_backup_reader login, pg_read_all_data, no superuser/create-role/create-database/replication, default read-only transaction. A write attempt was rejected with SQLSTATE 42501, even after requesting a read-write transaction.
- Source snapshot: repeatable-read read-only transaction, exported to pg_dump. Manifest counts are taken from the same snapshot as the dump.
- Restore verification: the uploaded object is downloaded and authenticated, its archive checksum is checked, and it is restored into a separate ephemeral PostgreSQL instance over a private Unix socket with no TCP listener. All public-table names/counts must match the source snapshot. Restore does not use the production connection string.
- Every backup run performs the restore verification, not just the first run. Backup failures exit nonzero and do not prune historical copies.
- No Pro upgrade was performed. Job runtime, bucket storage and applicable transfer are metered Railway usage, not a guaranteed free service. The job exits when finished and has no persistent compute instance or public API route.

## Verified first run

- Completed: 2026-10-18T07:08:43.233591+00:00.
- Tables: 57; rows across public tables: 7724.
- Uploaded encrypted size: 730680 bytes.
- Runtime: 34.64 seconds.
- Real isolated restore: passed.
- Independent local download: SHA-256, authenticated decryption and inner pg_dump checksum passed.
- Encrypted SHA-256: ec4c20c5b01738df94587a2572e610177907f05d149e44862ea371d9e269c20b.

Three build-time integrity tests passed: altered ciphertext/wrong key rejection, corrupted dump rejection, and unexpected bundle entry rejection. Python syntax checks passed. Production health remained 200/database connected after setup.

## Owner actions

1. Download NOOR_DATABASE_BACKUP_RECOVERY_KEY_PRIVATE.txt and keep it outside Railway in a password manager or offline secure storage. Never commit it, share it with Flutter, or put it in public support messages. Losing the key makes these backups unusable. Keep old keys when rotating; old objects require their original key.
2. Keep the initial encrypted archive in a separate storage location as an additional copy. A Railway bucket is independent of the DB disk, but not independent of Railway account loss/provider outage. For stronger disaster recovery, periodically copy verified encrypted objects to another provider or offline storage.
3. Commit ops/database-backup/ and this non-secret runbook to GitHub. Live job was deployed directly from the small ops folder. It does not require a Flutter update or new backend endpoint. Backend code pushes do not automatically redeploy this separate uploaded service.
4. Enable appropriate Railway deployment/job failure notifications and check that the latest-success marker advances daily. No external email/webhook alert or independent missed-run watchdog was configured. Inspect if it is older than 26 hours; a silent missed run cannot be detected solely by an exit code.
5. Local drive C was full during setup. Only generated Python bytecode caches under the task's work/backup-libs directory were removed to finish downloading the encrypted copy. Free space before future local development or recovery. No user application/data files were removed.

## Monitoring

Read logs for noor-db-backup. Healthy runs show restore_verified then backup_completed. The marker noor-postgres/v1/latest-success.json contains completion time, object key, checksum, encrypted size and restoreVerified=true. Do not infer success merely from a green image build: inspect a completed job and the advancing marker. First real execution was independently verified; tomorrow's scheduled invocation has not happened yet.

Backup objective is approximately one-day recovery point at best, assuming successful daily execution. It is not zero data loss or point-in-time recovery. Copies older than 14 days are not retained automatically. Volume files, external uploaded media, Railway variables, OAuth credentials and global PostgreSQL roles are not included in pg_dump. Preserve application secrets separately.

## Manual recovery procedure

1. Prefer an object referenced by a verified success marker/log. Download it using authenticated bucket access, with no public URL. Obtain the matching encryption key from your separate secure storage.
2. Build the supplied Docker image from ops/database-backup or use the deployed backup image. The recover.py helper uses the same authenticated format and refuses to overwrite an existing output.
3. Set BACKUP_ENCRYPTION_KEY securely in the recovery environment. Run `python3 /app/recover.py downloaded.enc recovered.pgdump` inside that tooling environment. This step writes files only, never connects to PostgreSQL. Keep decrypted output private and remove it securely after recovery.
4. Check `pg_restore --list recovered.pgdump`.
5. Provision an EMPTY, ISOLATED PostgreSQL 18 target. Set PGHOST, PGPORT, PGUSER, PGPASSWORD and PGDATABASE to that target only. Do not reuse production variables. Run `pg_restore --exit-on-error --no-owner --no-acl --dbname="$PGDATABASE" recovered.pgdump`. This does not restore global roles or grant production access automatically.
6. Compare public table names/counts with recovered.pgdump.manifest.json. Verify schema/migrations, accounts, Quran data and core app flows against the isolated target.
7. Production cutover is a separate reviewed operation requiring a maintenance/write-freeze plan. Do not overwrite the live database just to test a backup. The automated daily test already restores into an isolated temporary cluster.

## Configuration and maintenance

Secrets live only in Railway backup-service variables and private recovery files: BACKUP_DATABASE_URL, BACKUP_ENCRYPTION_KEY, BACKUP_BUCKET, BACKUP_S3_ENDPOINT, BACKUP_S3_REGION, BACKUP_S3_ACCESS_KEY_ID, BACKUP_S3_SECRET_ACCESS_KEY. BACKUP_RETENTION_DAYS=14. Do not copy these into frontend configuration.

Client image is postgres:18-bookworm; source must remain PostgreSQL 18 until client compatibility is reviewed. Rebuild periodically for PostgreSQL/Debian security fixes. Archive limit defaults to 256 MiB as a memory safety bound; larger databases require sizing/review. The source sanity check expects 6,236 Quran ayahs; intentional Quran schema/data changes require reviewing that check, not disabling integrity validation blindly.

Manual source redeploy command from repository root:
`railway up ./ops/database-backup --path-as-root --service noor-db-backup --environment production --detach`

Keep the daily cron configuration and restart policy NEVER. A cron job should exit; do not change it into a constantly running server. Avoid using an old deployment redeploy to apply new settings, because it can reuse the old deployment manifest; confirm current schedule and next run after changes.
