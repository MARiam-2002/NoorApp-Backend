import { confirmReadingUnits, readingConfirmationSchema } from '../src/services/reading-progress.service';
import express from 'express';
import { env } from '../src/config';
import { readingRouter } from '../src/routes/reading';
import { errorHandler } from '../src/middleware/common';
import { generateAccessToken } from '../src/lib/auth';
import { getReadingGoal } from '../src/services/reading-goal.service';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { prisma } from '../src/lib/prisma';
import { readingGoalReader, portionGoal } from '../src/services/reading-goal.service';
import { localMidnight, startReadingPlan, previewReadingAdjustment, applyReadingAdjustment } from '../src/services/reading-plan.service';
import { readingContent, sessionStartSchema, sessionUpdateSchema, startReadingSession, updateReadingSession, getReadingSession, listReadingSessions } from '../src/services/reading-session.service';
import { addReadingOpenApi } from '../src/shared/data/reading-openapi';
import { dateOnlyFromDayKey, localDayKeyForTimezone } from '../src/shared/utils/user-local-date';
async function main() {
    assert.equal(portionGoal(600, 4, 30).target, 21);
    assert.equal(portionGoal(600, 4, 0).target, 604);
    assert.equal(portionGoal(0, 21, 1).done, true);
    for (const zone of ['Africa/Cairo', 'America/Los_Angeles', 'Pacific/Kiritimati', 'Pacific/Pago_Pago', 'Asia/Kathmandu'])
        assert.equal(localDayKeyForTimezone(zone, localMidnight('2026-10-11', zone)), '2026-10-11');
    assert.equal(sessionStartSchema.safeParse({ editionId: 'indopak-hafs', minutes: 7, requestKey: randomUUID() }).success, false);
    assert.equal(sessionUpdateSchema.safeParse({ requestKey: randomUUID(), revision: 0, completedUnits: ['1', '1'] }).success, false);
    assert.equal(sessionUpdateSchema.safeParse({ requestKey: randomUUID(), revision: 0, skippedTasks: ['quran'] }).success, false);
    assert.equal(localDayKeyForTimezone('America/Santiago', localMidnight('2026-09-06', 'America/Santiago')), '2026-09-06');
    assert.equal(localDayKeyForTimezone('Africa/Cairo', localMidnight('2026-04-24', 'Africa/Cairo')), '2026-04-24');
    const spec: any = { components: { schemas: {} }, paths: {}, tags: [] };
    addReadingOpenApi(spec);
    assert.equal(Object.keys(spec.paths).length, 7);
    assert.equal(spec.paths['/reading/sessions/{id}'].patch.security[0].bearerAuth.length, 0);
    if (process.env.READING_TEST_DB !== 'true') {
        console.log('Reading goal math, worldwide calendar deadlines, validation and OpenAPI checks passed. Set READING_TEST_DB=true for isolated rollback DB checks.');
        return;
    }
    const originals = { transaction: prisma.$transaction.bind(prisma), query: prisma.$queryRaw, execute: prisma.$executeRaw, goal: readingGoalReader.get, page: readingContent.page, dhikr: readingContent.dhikr, userFind: prisma.user.findUnique, khatmahFind: prisma.khatmah.findUnique, dailyFind: prisma.dailyProgress.findUnique, qfId: env.QF_CLIENT_ID, qfSecret: env.QF_CLIENT_SECRET, warsh: env.WARSH_TEXT_APPROVED };
    const schema = 'reading_test_' + randomUUID().replaceAll('-', '');
    const rollback = new Error('EXPECTED_ROLLBACK');
    try {
        await originals.transaction(async (tx) => {
            await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
            await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
            await tx.$executeRawUnsafe('CREATE TABLE "users"("id" TEXT PRIMARY KEY,"timezone" TEXT NOT NULL DEFAULT \'Africa/Cairo\')');
            await tx.$executeRawUnsafe('CREATE TABLE "daily_progress"("id" TEXT PRIMARY KEY,"userId" TEXT,"date" DATE,"quranPagesRead" INTEGER NOT NULL DEFAULT 0,"morningAdhkarCompleted" BOOLEAN NOT NULL DEFAULT false,"eveningAdhkarCompleted" BOOLEAN NOT NULL DEFAULT false,"adhkarCompleted" BOOLEAN NOT NULL DEFAULT false,"updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,UNIQUE("userId","date"))');
            await tx.$executeRawUnsafe('CREATE TABLE "khatmah"("id" TEXT,"userId" TEXT PRIMARY KEY,"totalPagesRead" INTEGER NOT NULL DEFAULT 0,"planMode" TEXT,"planJuzPerMonth" INTEGER,"planStartedAt" TIMESTAMP(3),"planPagesAtStart" INTEGER,"planTargetEndAt" TIMESTAMP(3),"planDurationDays" INTEGER,"dailyWardPages" INTEGER,"updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP)');
            await tx.$executeRaw `INSERT INTO "users"("id") VALUES('owner'),('other')`;
            for (const statement of readFileSync('prisma/migrations/20261010140000_reading_experience/migration.sql', 'utf8').split(';').map(s => s.trim()).filter(Boolean))
                await tx.$executeRawUnsafe(statement);
            for (const statement of readFileSync('prisma/migrations/20261019090000_noor_continuity/migration.sql', 'utf8').split(';').map(s => s.trim()).filter(Boolean))
                await tx.$executeRawUnsafe(statement);
            (prisma as any).$queryRaw = tx.$queryRaw.bind(tx);
            (prisma as any).$executeRaw = tx.$executeRaw.bind(tx);
            (prisma as any).$transaction = async (fn: any) => fn(tx);
            let day = localDayKeyForTimezone('Africa/Cairo');
            let unavailable = false;
            readingGoalReader.get = async (userId: string, edition: any = 'indopak-hafs'): Promise<any> => {
                const plans: any[] = await tx.$queryRaw `SELECT * FROM "reading_plans" WHERE "userId"=${userId} AND "editionId"=${edition} AND "active"=true`;
                const p = plans[0];
                const scope = p?.id ?? `free:${day}`;
                const c: any[] = await tx.$queryRaw `SELECT COUNT(*)::int AS total,COUNT(*) FILTER(WHERE "completedOn"=${dateOnlyFromDayKey(day)}::date)::int AS today FROM "reading_units" WHERE "userId"=${userId} AND "editionId"=${edition} AND "scope"=${scope}`;
                const remaining = 604 - c[0].total;
                const g = p ? portionGoal(remaining, c[0].today, Math.round((p.targetEndOn.getTime() - dateOnlyFromDayKey(day).getTime()) / 86400000) + 1) : { target: 5, completed: c[0].today, remaining: Math.max(0, 5 - c[0].today), percent: c[0].today * 20, done: c[0].today >= 5 };
                return { editionId: edition, contentVersion: 'test-v1', date: day, timezone: 'Africa/Cairo', unit: 'PAGE', available: !unavailable, source: p ? 'EDITION_PLAN' : 'DEFAULT', ...g, plan: p ? { id: p.id, status: 'ACTIVE', total: 604, completed: c[0].total, remaining, startedOn: p.startedOn.toISOString().slice(0, 10), targetEndDate: p.targetEndOn.toISOString().slice(0, 10) } : null, resume: { page: 1, verseKey: null } };
            };
            readingContent.page = async (_id: any, page: number) => ({ page, verses: [{ key: '1:1' }] });
            readingContent.dhikr = async () => ({ items: [{ id: 'dhikr', textAr: 'الحمد لله', textEn: 'Praise be to Allah', repeatCount: 1, referenceAr: 'Reference' }] } as any);
            const planInput = { editionId: 'indopak-hafs' as const, durationDays: 30, expectedPlanId: null, requestKey: randomUUID() };
            const plan = await startReadingPlan('owner', planInput);
            assert.equal((await startReadingPlan('owner', planInput)).planId, plan.planId);
            await assert.rejects(startReadingPlan('owner', { ...planInput, requestKey: randomUUID() }), (e: any) => e.statusCode === 409);
            const input = sessionStartSchema.parse({ editionId: 'indopak-hafs', minutes: 10, requestKey: randomUUID() });
            const session = await startReadingSession('owner', input);
            assert.equal(session.confirmedUnits.length, 0);
            assert.equal((await readingGoalReader.get('owner')).completed, 0);
            assert.equal(session.tasks.length, 3);
            unavailable = true;
            assert.equal((await startReadingSession('owner', input)).sessionId, session.sessionId);
            unavailable = false;
            await assert.rejects(startReadingSession('owner', { ...input, minutes: 5 }), (e: any) => e.statusCode === 409);
            await assert.rejects(getReadingSession('other', session.sessionId), (e: any) => e.statusCode === 404);
            const paused = await updateReadingSession('owner', session.sessionId, sessionUpdateSchema.parse({ requestKey: randomUUID(), revision: 0, status: 'PAUSED' }));
            assert.equal(paused.status, 'PAUSED');
            assert.equal((await readingGoalReader.get('owner')).completed, 0);
            await assert.rejects(updateReadingSession('owner', session.sessionId, sessionUpdateSchema.parse({ requestKey: randomUUID(), revision: 0 })), (e: any) => e.statusCode === 409);
            await assert.rejects(updateReadingSession('owner', session.sessionId, sessionUpdateSchema.parse({ requestKey: randomUUID(), revision: 1, completedUnits: ['604'] })), (e: any) => e.statusCode === 400);
            const units = session.tasks.find((t: any) => t.kind === 'QURAN').units;
            const confirm = sessionUpdateSchema.parse({ requestKey: randomUUID(), revision: 1, completedUnits: units, doneTasks: ['adhkar'], skippedTasks: ['reflection'] });
            const result = await updateReadingSession('owner', session.sessionId, confirm);
            assert.equal(result.status, 'COMPLETED');
            assert.equal(result.revision, 2);
            assert.equal((await updateReadingSession('owner', session.sessionId, confirm)).revision, 2);
            const count = (await readingGoalReader.get('owner')).completed;
            assert.equal(count, units.length);
            await updateReadingSession('owner', session.sessionId, { ...confirm, requestKey: randomUUID(), revision: 2 });
            assert.equal((await readingGoalReader.get('owner')).completed, count);
            const oldEnd = (await readingGoalReader.get('owner')).plan!.targetEndDate;
            const newEnd = new Date(dateOnlyFromDayKey(oldEnd).getTime() + 86400000).toISOString().slice(0, 10);
            const preview = await previewReadingAdjustment('owner', { editionId: 'indopak-hafs', mode: 'EXTEND', targetEndDate: newEnd });
            assert.equal((await readingGoalReader.get('owner')).plan!.targetEndDate, oldEnd);
            const another = await startReadingSession('owner', sessionStartSchema.parse({ ...input, requestKey: randomUUID() }));
            const first = another.tasks.find((t: any) => t.kind === 'QURAN').units[0];
            assert.ok(!units.includes(first));
            await updateReadingSession('owner', another.sessionId, sessionUpdateSchema.parse({ requestKey: randomUUID(), revision: 0, completedUnits: [first] }));
            await assert.rejects(applyReadingAdjustment('owner', { editionId: 'indopak-hafs', mode: 'EXTEND', targetEndDate: newEnd, previewToken: preview.previewToken, requestKey: randomUUID() }), (e: any) => e.statusCode === 409);
            const fresh = await previewReadingAdjustment('owner', { editionId: 'indopak-hafs', mode: 'EXTEND', targetEndDate: newEnd });
            await applyReadingAdjustment('owner', { editionId: 'indopak-hafs', mode: 'EXTEND', targetEndDate: newEnd, previewToken: fresh.previewToken, requestKey: randomUUID() });
            assert.equal((await readingGoalReader.get('owner')).completed, count + 1);
            assert.equal((await readingGoalReader.get('owner')).plan!.targetEndDate, newEnd);
            const offline = await startReadingSession('owner', sessionStartSchema.parse({ ...input, requestKey: randomUUID() }));
            const offlineUnit = offline.tasks[0].units[0];
            const originalDay = day;
            day = new Date(dateOnlyFromDayKey(day).getTime() + 86400000).toISOString().slice(0, 10);
            await updateReadingSession('owner', offline.sessionId, sessionUpdateSchema.parse({ requestKey: randomUUID(), revision: 0, completedUnits: [offlineUnit] }));
            const dated: any[] = await tx.$queryRaw `SELECT "completedOn" FROM "reading_units" WHERE "userId"='owner' AND "unitKey"=${offlineUnit}`;
            assert.equal(dated[0].completedOn.toISOString().slice(0, 10), originalDay);
            assert.equal((await readingGoalReader.get('owner')).completed, 0);
            await tx.$executeRaw `UPDATE "reading_sessions" SET "expiresAt"=CURRENT_TIMESTAMP-INTERVAL '1 second' WHERE "id"=${offline.sessionId}`;
            await assert.rejects(updateReadingSession('owner', offline.sessionId, sessionUpdateSchema.parse({ requestKey: randomUUID(), revision: 1 })), (e: any) => e.statusCode === 409);
            const beforeRestart = (await readingGoalReader.get('owner')).plan!.id;
            const pending = await startReadingSession('owner', sessionStartSchema.parse({ ...input, requestKey: randomUUID() }));
            await startReadingPlan('owner', { ...planInput, expectedPlanId: beforeRestart, requestKey: randomUUID() });
            await assert.rejects(updateReadingSession('owner', pending.sessionId, sessionUpdateSchema.parse({ requestKey: randomUUID(), revision: 0, completedUnits: [pending.tasks[0].units[0]] })), (e: any) => e.statusCode === 409);
            assert.equal((await readingGoalReader.get('owner')).completed, 0);
            assert.ok((await listReadingSessions('owner')).items.length > 0);
            assert.equal((await listReadingSessions('other')).items.length, 0);
            await tx.$executeRaw `DELETE FROM "users" WHERE "id"='owner'`;
            assert.equal((await listReadingSessions('owner')).items.length, 0);
            console.log('Reading sessions: isolated PostgreSQL rollback checks passed: ownership, retry replay, unique credit, revisions, pause, task skip, stale preview, progress-preserving extension, original-day offline sync, expiry, plan replacement and account cascade. No public tables or users changed.');
            for (const file of ['20261010110000_mushaf_reader_states', '20261010120000_warsh_verse_reader'])
                for (const statement of readFileSync('prisma/migrations/' + file + '/migration.sql', 'utf8').split(';').map(x => x.trim()).filter(Boolean))
                    await tx.$executeRawUnsafe(statement);
            (prisma.user as any).findUnique = async () => ({ id: 'other', timezone: 'Africa/Cairo', isActive: true, email: 'isolated@example.test' });
            (prisma.khatmah as any).findUnique = async () => null;
            (prisma.dailyProgress as any).findUnique = async () => null;
            env.QF_CLIENT_ID = 'test-only';
            env.QF_CLIENT_SECRET = 'test-only';
            env.WARSH_TEXT_APPROVED = true;
            readingGoalReader.get = getReadingGoal;
            assert.equal((await getReadingGoal('other', 'madani-hafs')).target, 5);
            assert.equal((await getReadingGoal('other', 'indopak-hafs')).target, 5);
            const actualPlan = await startReadingPlan('other', { editionId: 'indopak-hafs', durationDays: 30, expectedPlanId: null, requestKey: randomUUID() });
            assert.equal((await getReadingGoal('other', 'indopak-hafs')).target, 21);
            for (const minutes of [5, 10, 20] as const) {
                const portion = await startReadingSession('other', sessionStartSchema.parse({ editionId: 'indopak-hafs', minutes, requestKey: randomUUID() }));
                assert.ok(portion.estimatedMinutes <= minutes);
                assert.equal(portion.tasks.length, 3);
            }
            const warp = await startReadingPlan('other', { editionId: 'warsh-nafi', durationDays: 30, expectedPlanId: null, requestKey: randomUUID() });
            const warpSession = await startReadingSession('other', sessionStartSchema.parse({ editionId: 'warsh-nafi', minutes: 20, requestKey: randomUUID() }));
            assert.equal(warpSession.unit, 'VERSE');
            assert.ok(!warpSession.tasks.some((t: any) => t.kind === 'REFLECTION'));
            const warpUnit = warpSession.tasks[0].units[0];
            assert.equal(warpUnit, '1:1');
            await updateReadingSession('other', warpSession.sessionId, sessionUpdateSchema.parse({ requestKey: randomUUID(), revision: 0, completedUnits: [warpUnit] }));
            assert.equal((await getReadingGoal('other', 'warsh-nafi')).completed, 1);
            assert.equal((await getReadingGoal('other', 'indopak-hafs')).completed, 0);
            await tx.$executeRaw `INSERT INTO "mushaf_preferences"("userId","editionId") VALUES('other','warsh-nafi')`;
            assert.equal((await getReadingGoal('other')).editionId, 'warsh-nafi');
            const warpPreview = await previewReadingAdjustment('other', { editionId: 'warsh-nafi', mode: 'EXTEND', targetEndDate: new Date(dateOnlyFromDayKey(warp.targetEndDate).getTime() + 86400000).toISOString().slice(0, 10) });
            await applyReadingAdjustment('other', { editionId: 'warsh-nafi', mode: 'EXTEND', targetEndDate: warpPreview.targetEndDate, previewToken: warpPreview.previewToken, requestKey: randomUUID() });
            assert.equal((await getReadingGoal('other')).completed, 1);
            env.WARSH_TEXT_APPROVED = false;
            assert.equal((await getReadingGoal('other')).source, 'UNAVAILABLE');
            env.WARSH_TEXT_APPROVED = true;
            await tx.$executeRaw `INSERT INTO "khatmah"("id","userId") VALUES('legacy-other','other')`;
            (prisma.khatmah as any).findUnique = async (args: any) => { const rows: any[] = await tx.$queryRaw `SELECT * FROM "khatmah" WHERE "userId"=${args.where.userId}`; return rows[0] ?? null; };
            (prisma.dailyProgress as any).findUnique = async (args: any) => { const rows: any[] = await tx.$queryRaw `SELECT * FROM "daily_progress" WHERE "userId"=${args.where.userId_date.userId} AND "date"=${args.where.userId_date.date}::date`; return rows[0] ?? null; };
            const madani = await startReadingSession('other', sessionStartSchema.parse({ editionId: 'madani-hafs', minutes: 5, includeAdhkar: false, includeReflection: false, requestKey: randomUUID() }));
            const madaniInput = sessionUpdateSchema.parse({ requestKey: randomUUID(), revision: 0, completedUnits: madani.tasks[0].units });
            await updateReadingSession('other', madani.sessionId, madaniInput);
            assert.equal((await getReadingGoal('other', 'madani-hafs')).completed, 2);
            await updateReadingSession('other', madani.sessionId, { ...madaniInput, requestKey: randomUUID(), revision: 1 });
            assert.equal((await getReadingGoal('other', 'madani-hafs')).completed, 2);
            const legacyDay = (await getReadingGoal('other', 'madani-hafs')).date;
            const endAt = new Date(dateOnlyFromDayKey(legacyDay).getTime() + 30 * 86400000);
            await tx.$executeRaw `UPDATE "khatmah" SET "planMode"='DURATION_DAYS',"planStartedAt"=${dateOnlyFromDayKey(legacyDay)},"planPagesAtStart"=0,"planTargetEndAt"=${endAt},"planDurationDays"=30 WHERE "userId"='other'`;
            const legacyGoal = await getReadingGoal('other', 'madani-hafs');
            assert.ok(legacyGoal.plan!.id.startsWith('legacy:'));
            const legacyEnd = new Date(dateOnlyFromDayKey(legacyGoal.plan!.targetEndDate).getTime() + 86400000).toISOString().slice(0, 10);
            const legacyPreview = await previewReadingAdjustment('other', { editionId: 'madani-hafs', mode: 'EXTEND', targetEndDate: legacyEnd });
            await applyReadingAdjustment('other', { editionId: 'madani-hafs', mode: 'EXTEND', targetEndDate: legacyEnd, previewToken: legacyPreview.previewToken, requestKey: randomUUID() });
            assert.equal((await getReadingGoal('other', 'madani-hafs')).plan!.targetEndDate, legacyEnd);
            assert.equal((await getReadingGoal('other', 'madani-hafs')).completed, 2);
            const directGoal = await getReadingGoal('other', 'indopak-hafs');
            const direct = readingConfirmationSchema.parse({ editionId: 'indopak-hafs', contentVersion: directGoal.contentVersion, expectedPlanId: directGoal.plan!.id, date: directGoal.date, unitKeys: ['604'], requestKey: randomUUID() });
            assert.equal((await confirmReadingUnits('other', direct)).addedUnits, 1);
            assert.equal((await confirmReadingUnits('other', direct)).addedUnits, 1);
            assert.equal((await confirmReadingUnits('other', { ...direct, requestKey: randomUUID() })).addedUnits, 0);
            assert.equal((await getReadingGoal('other', 'indopak-hafs')).completed, 1);
            await assert.rejects(confirmReadingUnits('other', { ...direct, date: '2000-01-01', requestKey: randomUUID() }), (e: any) => e.statusCode === 409);
            await assert.rejects(confirmReadingUnits('other', { ...direct, unitKeys: ['605'], requestKey: randomUUID() }), (e: any) => e.statusCode === 400);
            const overlap = await startReadingSession('other', sessionStartSchema.parse({ editionId: 'indopak-hafs', minutes: 5, includeAdhkar: false, includeReflection: false, requestKey: randomUUID() }));
            const overlapUnit = overlap.tasks[0].units[0];
            await confirmReadingUnits('other', { ...direct, unitKeys: [overlapUnit], requestKey: randomUUID() });
            await updateReadingSession('other', overlap.sessionId, sessionUpdateSchema.parse({ revision: 0, completedUnits: [overlapUnit], requestKey: randomUUID() }));
            assert.equal((await getReadingGoal('other', 'indopak-hafs')).completed, 2);
            const wGoal = await getReadingGoal('other', 'warsh-nafi');
            await confirmReadingUnits('other', { editionId: 'warsh-nafi', contentVersion: wGoal.contentVersion, expectedPlanId: wGoal.plan!.id, date: wGoal.date, unitKeys: ['1:2'], requestKey: randomUUID() });
            assert.equal((await getReadingGoal('other', 'warsh-nafi')).completed, 2);
            console.log('Ordinary reader and guided sessions share unique credit; duplicate/replayed confirmations, invalid pages and stale-day guards passed.');
            if (process.env.READING_TEST_HTTP === 'true') {
                const app = express();
                app.use(express.json());
                app.use('/api/v1/reading', readingRouter);
                app.use(errorHandler);
                const server = app.listen(0, '127.0.0.1');
                await new Promise<void>(resolve => server.once('listening', resolve));
                try {
                    const base = 'http://127.0.0.1:' + (server.address() as any).port + '/api/v1/reading';
                    const anonymous = await fetch(base + '/goal');
                    assert.equal(anonymous.status, 401);
                    assert.equal(anonymous.headers.get('cache-control'), 'private, no-store');
                    const headers = { Authorization: 'Bearer ' + generateAccessToken({ userId: 'other', email: 'isolated@example.test' }), 'Content-Type': 'application/json' };
                    const response = await fetch(base + '/goal', { headers });
                    assert.equal(response.status, 200);
                    assert.equal((await response.json() as any).data.editionId, 'warsh-nafi');
                    assert.equal((await fetch(base + '/sessions', { method: 'POST', headers, body: JSON.stringify({ editionId: 'warsh-nafi', minutes: 7, requestKey: randomUUID() }) })).status, 400);
                    const prepared = await fetch(base + '/sessions', { method: 'POST', headers, body: JSON.stringify({ editionId: 'warsh-nafi', minutes: 5, requestKey: randomUUID() }) });
                    assert.equal(prepared.status, 201);
                    const session = (await prepared.json() as any).data;
                    assert.equal(session.confirmedUnits.length, 0);
                    assert.equal((await fetch(base + '/sessions/' + randomUUID(), { headers })).status, 404);
                    console.log('Reading HTTP authentication, envelopes, private caching, validation and owned-session checks passed.');
                }
                finally {
                    await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
                }
            }
            console.log('Actual selected-edition goal adapters and Warsh unique-verse integration passed; no Hafs/Warsh cross-credit. Provider page requests remain mocked.');
            throw rollback;
        }, { timeout: 180000, maxWait: 20000 });
    }
    catch (e) {
        if (e !== rollback)
            throw e;
    }
    finally {
        (prisma as any).$queryRaw = originals.query;
        (prisma as any).$executeRaw = originals.execute;
        (prisma as any).$transaction = originals.transaction;
        readingGoalReader.get = originals.goal;
        readingContent.page = originals.page;
        readingContent.dhikr = originals.dhikr;
        (prisma.user as any).findUnique = originals.userFind;
        (prisma.khatmah as any).findUnique = originals.khatmahFind;
        (prisma.dailyProgress as any).findUnique = originals.dailyFind;
        env.QF_CLIENT_ID = originals.qfId;
        env.QF_CLIENT_SECRET = originals.qfSecret;
        env.WARSH_TEXT_APPROVED = originals.warsh;
    }
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
