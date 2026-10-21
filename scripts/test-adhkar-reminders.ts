import { assertSafeDatabaseTarget } from '../src/lib/database-safety';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { prisma } from '../src/lib/prisma';
import { generateAccessToken } from '../src/lib/auth';
import { errorHandler } from '../src/middleware/common';
import { profileRouter } from '../src/routes/profile';
import { getSwaggerSpec } from '../src/lib/swagger';
import { adhkarReminderPatchSchema, adhkarReminderSettings, evaluateAdhkarReminder, getAdhkarReminderPreferences,
  updateAdhkarReminderPreferences, hasCompletedAdhkarReminderCategory, runAdhkarReminders, adhkarReminderDelivery } from '../src/services/adhkar-reminder.service';

async function main() {
  const defaults = adhkarReminderSettings({ timezone: 'Africa/Cairo' });
  assert.equal(defaults.morningEnabled, false); assert.equal(defaults.eveningEnabled, false); assert.equal(defaults.soundEnabled, false);
  assert.equal(defaults.bedtimeEnabled,false);assert.equal(defaults.bedtimeTime,'22:00');
  for (const body of [{ expectedRevision: 0 }, { expectedRevision: -1, morningEnabled: true }, { expectedRevision: 0, morningEnabled: 'true' },
    { expectedRevision: 0, morningTime: '24:00' }, { expectedRevision: 0, eveningTime: '7:00' }, { expectedRevision: 0, bedtimeTime: '24:00' }, {expectedRevision:0,bedtimeEnabled:'true'}, { expectedRevision: 0, enabled: true }]) assert.equal(adhkarReminderPatchSchema.safeParse(body).success, false);
  assert.deepEqual(adhkarReminderPatchSchema.parse({ expectedRevision: 1, eveningTime: '18:00' }), { expectedRevision: 1, eveningTime: '18:00' });
  for (const [timezone, timestamp] of [['Africa/Cairo','2026-10-20T04:00:00Z'],['America/New_York','2026-10-20T11:00:00Z'],['Asia/Kathmandu','2026-10-20T01:15:00Z'],['Pacific/Kiritimati','2026-10-19T17:00:00Z']] as const) {
    const now = new Date(timestamp); assert.equal(evaluateAdhkarReminder(now,timezone,'07:00',true,'MORNING').eligible,true);
    assert.equal(evaluateAdhkarReminder(new Date(now.getTime()-1000),timezone,'07:00',true,'MORNING').eligible,false);
    assert.equal(evaluateAdhkarReminder(new Date(now.getTime()+600001),timezone,'07:00',true,'MORNING').eligible,false);
    assert.equal(evaluateAdhkarReminder(now,timezone,'07:00',false,'MORNING').eligible,false);
  }
  assert.equal(evaluateAdhkarReminder(new Date('2026-11-01T05:30:00Z'),'America/New_York','01:30',true,'MORNING').occurrenceKey,
    evaluateAdhkarReminder(new Date('2026-11-01T06:30:00Z'),'America/New_York','01:30',true,'MORNING').occurrenceKey);
  assert.equal(evaluateAdhkarReminder(new Date('2027-03-14T07:30:00Z'),'America/New_York','02:30',true,'MORNING').eligible,false);
  assert.equal(evaluateAdhkarReminder(new Date('2026-10-20T21:01:00Z'),'Africa/Cairo','23:59',true,'EVENING').eligible,false);
  assert.ok(getSwaggerSpec().paths['/profile/adhkar-reminder-preferences'].patch.security);
  console.log('Adhkar reminders: defaults, strict partial edits, worldwide local clocks, DST repeated/missing hours, no midnight catch-up and OpenAPI passed.');
  if (process.env.ADHKAR_REMINDER_TEST_DB !== 'true') return;
  assertSafeDatabaseTarget(process.env.DATABASE_URL ?? '', 'test');

  const schema = 'adhkar_reminder_test_' + randomUUID().replaceAll('-','');
  const db = new PrismaClient();
  const original = { transaction: prisma.$transaction, query: prisma.$queryRaw, execute: prisma.$executeRaw, user: prisma.user.findUnique,
    send: adhkarReminderDelivery.send, history: adhkarReminderDelivery.history };
  const scoped = (fn: (tx:any)=>Promise<any>) => db.$transaction(async tx => { await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`); return fn(tx); },{timeout:30000,maxWait:15000});
  let created = false;
  try {
    await db.$transaction(async tx => {
      await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`); created = true;
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
      await tx.$executeRawUnsafe('CREATE TABLE users(id TEXT PRIMARY KEY,timezone TEXT DEFAULT \'Africa/Cairo\',"isActive" BOOLEAN DEFAULT true)');
      await tx.$executeRawUnsafe('CREATE TABLE device_tokens("userId" TEXT)');
      await tx.$executeRawUnsafe('CREATE TABLE dhikr_categories(id TEXT PRIMARY KEY,key TEXT)');
      await tx.$executeRawUnsafe('CREATE TABLE dhikr_items(id TEXT PRIMARY KEY,"categoryId" TEXT,"repeatCount" INTEGER)');
      await tx.$executeRawUnsafe('CREATE TABLE daily_dhikr_completions("userId" TEXT,date DATE,"categoryId" TEXT,"itemId" TEXT,"countDone" INTEGER)');
      for(const sql of readFileSync('prisma/migrations/20261020090000_adhkar_reminders/migration.sql','utf8').split(';').map(s=>s.trim()).filter(Boolean)) await tx.$executeRawUnsafe(sql);
      await tx.$executeRaw`INSERT INTO users(id) VALUES ('owner'),('other'),('completed'),('wirdOnly'),('partial'),('inactive'),('noToken'),('failure'),('dst')`;
      await tx.$executeRaw`INSERT INTO users(id) VALUES ('upgrade'),('bedtimeOnly'),('bedtimeDone')`;
      await tx.$executeRaw`INSERT INTO adhkar_reminder_preferences ("userId","morningEnabled","morningTime",revision) VALUES ('upgrade',true,'06:30',7)`;
      await tx.$executeRaw`INSERT INTO adhkar_reminder_send_logs ("userId",date,kind) VALUES ('upgrade','2026-10-20','MORNING')`;
      for(const sql of readFileSync('prisma/migrations/20261020093000_adhkar_bedtime_reminder/migration.sql','utf8').split(';').map(s=>s.trim()).filter(Boolean)) await tx.$executeRawUnsafe(sql);
      await tx.$executeRaw`INSERT INTO device_tokens("userId") SELECT id FROM users WHERE id NOT IN ('noToken','other','upgrade')`;
      await tx.$executeRaw`UPDATE users SET "isActive" = false WHERE id = 'inactive'`;
      await tx.$executeRaw`INSERT INTO dhikr_categories(id,key) VALUES ('m','MORNING'),('e','EVENING'),('w','GENERAL_WIRD'),('b','BEFORE_SLEEP')`;
      await tx.$executeRaw`INSERT INTO dhikr_items(id,"categoryId","repeatCount") VALUES ('m1','m',3),('m2','m',1),('e1','e',2),('w1','w',1),('b1','b',3),('b2','b',1)`;
      await tx.$executeRaw`INSERT INTO daily_dhikr_completions("userId",date,"categoryId","itemId","countDone") VALUES
        ('completed','2026-10-20','m','m1',3),('completed','2026-10-20','m','m2',1),('partial','2026-10-20','m','m1',3),('wirdOnly','2026-10-20','w','w1',1)`;
      await tx.$executeRaw`INSERT INTO daily_dhikr_completions("userId",date,"categoryId","itemId","countDone") VALUES ('bedtimeDone','2026-10-20','b','b1',3),('bedtimeDone','2026-10-20','b','b2',1)`;
    });
    (prisma as any).$transaction = (fn:any)=>scoped(fn);
    (prisma as any).$queryRaw = (...args:any[])=>scoped(tx=>tx.$queryRaw(...args));
    (prisma as any).$executeRaw = (...args:any[])=>scoped(tx=>tx.$executeRaw(...args));
    (prisma.user as any).findUnique = (args:any)=>scoped(async tx=>(await tx.$queryRaw`SELECT * FROM users WHERE id = ${args.where.id}`)[0]??null);
    assert.equal((await getAdhkarReminderPreferences('owner')).revision,0);
    const upgraded=await getAdhkarReminderPreferences('upgrade');assert.equal(upgraded.morningTime,'06:30');assert.equal(upgraded.morningEnabled,true);assert.equal(upgraded.revision,7);assert.equal(upgraded.bedtimeEnabled,false);
    await assert.rejects(getAdhkarReminderPreferences('missing'),(e:any)=>e.statusCode===404);
    await updateAdhkarReminderPreferences('owner',{expectedRevision:0,morningEnabled:true});
    const saved = await updateAdhkarReminderPreferences('owner',{expectedRevision:1,eveningEnabled:true});
    assert.equal(saved.morningEnabled,true); assert.equal(saved.eveningEnabled,true); assert.equal(saved.morningTime,'07:00');
    const races = await Promise.allSettled([updateAdhkarReminderPreferences('owner',{expectedRevision:2,soundEnabled:true}),updateAdhkarReminderPreferences('owner',{expectedRevision:2,soundEnabled:false})]);
    assert.equal(races.filter(r=>r.status==='fulfilled').length,1); assert.equal(races.filter(r=>r.status==='rejected'&&r.reason.statusCode===409).length,1);
    const latest = await getAdhkarReminderPreferences('owner');
    await updateAdhkarReminderPreferences('owner',{expectedRevision:latest.revision,soundEnabled:false});
    for(const id of ['completed','wirdOnly','partial','inactive','noToken','failure']) await updateAdhkarReminderPreferences(id,{expectedRevision:0,morningEnabled:true});
    assert.equal((await getAdhkarReminderPreferences('other')).morningEnabled,false);
    assert.equal(await scoped(tx=>hasCompletedAdhkarReminderCategory(tx,'completed','2026-10-20','MORNING')),true);
    assert.equal(await scoped(tx=>hasCompletedAdhkarReminderCategory(tx,'wirdOnly','2026-10-20','MORNING')),false);
    const payloads:any[]=[];let history=0, failures=0;
    adhkarReminderDelivery.send = async (id,payload) => { if(id==='failure'){failures++;throw new Error('Simulated provider ambiguity');} payloads.push({id,payload});return {sent:1,failed:0}; };
    adhkarReminderDelivery.history = (async()=>{history++;return {};}) as any;
    await Promise.all([runAdhkarReminders(new Date('2026-10-20T04:00:00Z')),runAdhkarReminders(new Date('2026-10-20T04:00:00Z'))]);
    assert.deepEqual(payloads.map(p=>p.id).sort(),['owner','partial','wirdOnly']); assert.equal(history,3); assert.equal(failures,1);
    assert.ok(payloads.every(p=>p.payload.nativeSound===null&&p.payload.data.categoryKey==='MORNING'&&p.payload.data.deepLink==='/adhkar/MORNING'));
    await runAdhkarReminders(new Date('2026-10-20T04:00:00Z'));assert.equal(payloads.length,3);assert.equal(failures,1);
    const p = await getAdhkarReminderPreferences('owner');await updateAdhkarReminderPreferences('owner',{expectedRevision:p.revision,morningTime:'08:00',soundEnabled:true});
    await runAdhkarReminders(new Date('2026-10-20T05:00:00Z'));assert.equal(payloads.length,3,'Time edits cannot trigger a second morning');
    await runAdhkarReminders(new Date('2026-10-20T14:00:00Z'));assert.equal(payloads.length,4);assert.equal(payloads[3].payload.data.categoryKey,'EVENING');assert.equal(payloads[3].payload.nativeSound,'default');assert.equal(payloads[3].payload.androidChannelId,'adhkar_reminders_default_v1');
    const beforeBed=await getAdhkarReminderPreferences('owner');
    await updateAdhkarReminderPreferences('owner',{expectedRevision:beforeBed.revision,bedtimeEnabled:true});
    await updateAdhkarReminderPreferences('bedtimeOnly',{expectedRevision:0,bedtimeEnabled:true});
    await updateAdhkarReminderPreferences('bedtimeDone',{expectedRevision:0,bedtimeEnabled:true});
    await Promise.all([runAdhkarReminders(new Date('2026-10-20T19:00:00Z')),runAdhkarReminders(new Date('2026-10-20T19:00:00Z'))]);
    const bedtimePayloads=payloads.filter(p=>p.payload.data.categoryKey==='BEFORE_SLEEP');
    assert.deepEqual(bedtimePayloads.map(p=>p.id).sort(),['bedtimeOnly','owner']);assert.ok(bedtimePayloads.every(p=>p.payload.data.deepLink==='/adhkar/BEFORE_SLEEP'));
    const savedBed=await getAdhkarReminderPreferences('owner');await updateAdhkarReminderPreferences('owner',{expectedRevision:savedBed.revision,morningTime:'08:30'});
    assert.equal((await getAdhkarReminderPreferences('owner')).bedtimeEnabled,true,'An older client editing only morning must preserve bedtime');
    const only=await getAdhkarReminderPreferences('bedtimeOnly');await updateAdhkarReminderPreferences('bedtimeOnly',{expectedRevision:only.revision,bedtimeTime:'00:05'});
    await runAdhkarReminders(new Date('2026-10-20T21:05:00Z'));
    assert.equal(payloads.filter(p=>p.id==='bedtimeOnly').length,2,'After-midnight bedtime belongs to the new local date');
    await scoped(tx=>tx.$executeRaw`UPDATE users SET timezone = 'America/New_York' WHERE id = 'dst'`);
    await updateAdhkarReminderPreferences('dst',{expectedRevision:0,morningEnabled:true,morningTime:'01:30'});
    await runAdhkarReminders(new Date('2026-11-01T05:30:00Z'));await runAdhkarReminders(new Date('2026-11-01T06:30:00Z'));
    assert.equal(payloads.filter(p=>p.id==='dst').length,1);
    await scoped(tx=>tx.$executeRaw`UPDATE users SET timezone = 'America/Chicago' WHERE id = 'dst'`);
    await runAdhkarReminders(new Date('2026-11-01T07:30:00Z'));assert.equal(payloads.filter(p=>p.id==='dst').length,1,'Travel cannot repeat the same local date/category');
    const app=express();app.use(express.json());app.use('/profile',profileRouter);app.use(errorHandler);
    const server=app.listen(0,'127.0.0.1');
    try {
      await new Promise<void>(r=>server.once('listening',r));const url=`http://127.0.0.1:${(server.address() as AddressInfo).port}/profile/adhkar-reminder-preferences`;
      const headers={Authorization:'Bearer '+generateAccessToken({userId:'owner',email:'test@example.invalid'}),'Content-Type':'application/json'};
      assert.equal((await fetch(url)).status,401);const result=await fetch(url,{headers});assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'private, no-store');
      assert.equal((await result.json() as any).data.eveningEnabled,true);
      assert.equal((await fetch(url,{method:'PATCH',headers,body:JSON.stringify({expectedRevision:0,morningEnabled:false})})).status,409);
      assert.equal((await fetch(url,{method:'PATCH',headers,body:JSON.stringify({expectedRevision:1,morningTime:'25:00'})})).status,400);
    } finally { await new Promise<void>((r,j)=>server.close(e=>e?j(e):r())); }
    await scoped(tx=>tx.$executeRaw`DELETE FROM users WHERE id = 'owner'`);
    for(const table of ['adhkar_reminder_preferences','adhkar_reminder_send_logs']) assert.equal((await scoped(tx=>tx.$queryRawUnsafe(`SELECT count(*)::int n FROM "${table}" WHERE "userId" = 'owner'`)))[0].n,0);
    console.log('Adhkar reminder DB/HTTP checks passed: real migration, preserved partial settings, independent-transaction CAS/cron races, actual-category suppression, partial/wird-only distinction, no-token/inactive skips, ambiguous-failure dedupe, morning/evening separation, sound channels, DST/travel dedupe, auth/private validation and cascading deletion. No real notification sent.');
  } finally {
    (prisma as any).$transaction=original.transaction;(prisma as any).$queryRaw=original.query;(prisma as any).$executeRaw=original.execute;(prisma.user as any).findUnique=original.user;
    adhkarReminderDelivery.send=original.send;adhkarReminderDelivery.history=original.history;
    if(created){if(!/^adhkar_reminder_test_[a-f0-9]{32}$/.test(schema))throw new Error('Unsafe test schema');await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);}
    await db.$disconnect();await prisma.$disconnect();
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
