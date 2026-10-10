import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { prisma } from '../src/lib/prisma';
import { prayerScheduleKey,travelLocationSchema,getTravelState,updateTravelLocation,acknowledgeTravelCoverage,getTravelSchedule } from '../src/services/travel.service';
import { inferTimezoneFromCoordinates } from '../src/shared/utils/prayer-location';
async function main() {
 for(const [lat,lng,zone] of [[30.0444,31.2357,'Africa/Cairo'],[40.7128,-74.006,'America/New_York'],[27.7172,85.324,'Asia/Kathmandu'],[-33.8688,151.2093,'Australia/Sydney'],[21.4225,39.8262,'Asia/Riyadh']] as const) assert.equal(inferTimezoneFromCoordinates(lat,lng),zone);
 const base:any={latitude:30,longitude:31,timezone:'Africa/Cairo',azanPreferences:{},prayerCalculationMethod:'AUTO'};
 assert.equal(prayerScheduleKey(base),prayerScheduleKey({...base,azanPreferences:{localScheduledUntil:new Date().toISOString()}}));
 assert.notEqual(prayerScheduleKey(base),prayerScheduleKey({...base,longitude:32}));
 assert.notEqual(prayerScheduleKey(base),prayerScheduleKey({...base,azanPreferences:{madhab:'HANAFI'}}));
 assert.equal(travelLocationSchema.safeParse({requestKey:randomUUID(),expectedScheduleKey:prayerScheduleKey(base),latitude:30,longitude:31,source:'GPS',mode:'FOREGROUND_AUTO'}).success,false);
 assert.equal(travelLocationSchema.safeParse({requestKey:randomUUID(),expectedScheduleKey:prayerScheduleKey(base),latitude:91,longitude:31,source:'MANUAL',mode:'MANUAL'}).success,false);
 if(process.env.TRAVEL_TEST_DB!=='true') {console.log('Travel validation, schedule fingerprints and global timezone checks passed.');return;}
 const orig={transaction:prisma.$transaction.bind(prisma),query:prisma.$queryRaw}; const rollback=new Error('TRAVEL_TEST_ROLLBACK');
 const schema='travel_test_'+randomUUID().replace(/-/g,'');
 try { await orig.transaction(async tx=>{
  await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
  await tx.$executeRawUnsafe(`CREATE TABLE users (id TEXT PRIMARY KEY, latitude DOUBLE PRECISION, longitude DOUBLE PRECISION, timezone TEXT NOT NULL DEFAULT 'Africa/Cairo', city TEXT, country TEXT, "prayerCalculationMethod" TEXT DEFAULT 'AUTO', "azanPreferences" JSONB, "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP)`);
  for(const statement of readFileSync('prisma/migrations/20261010160000_travel_mode/migration.sql','utf8').split(';').map(s=>s.trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement);
  await tx.$executeRaw`INSERT INTO users(id,"azanPreferences") VALUES ('owner','{"madhab":"HANAFI","calculationMethod":"KARACHI","localScheduledUntil":"2026-12-01T00:00:00Z"}'::jsonb),('other','{}'::jsonb)`;
  (prisma as any).$transaction=async(fn:any)=>fn(tx); (prisma as any).$queryRaw=tx.$queryRaw.bind(tx);
  const initial=await getTravelState('owner');assert.equal(initial.location,null);
  const input:any={requestKey:randomUUID(),expectedScheduleKey:initial.scheduleKey,mode:'FOREGROUND_AUTO',source:'GPS',latitude:40.7128,longitude:-74.006,observedAt:new Date(Date.now()-1000).toISOString(),accuracyMeters:30,city:'New York'};
  const saved:any=await updateTravelLocation('owner',input); assert.equal(saved.location.timezone,'America/New_York');assert.equal(saved.localScheduledUntil,null);assert.equal(saved.madhab,'HANAFI');assert.equal(saved.calculationMethod,'KARACHI');
  assert.deepEqual(await updateTravelLocation('owner',input),saved);
  await assert.rejects(updateTravelLocation('owner',{...input,longitude:2}),/Request key/);
  await assert.rejects(updateTravelLocation('owner',{...input,requestKey:randomUUID()}),/Schedule changed/);
  await assert.rejects(updateTravelLocation('owner',{...input,expectedScheduleKey:saved.scheduleKey,requestKey:randomUUID(),observedAt:new Date(Date.now()-20*60000).toISOString()}),/fresh/);
  const schedule=await getTravelSchedule('owner');assert.ok(schedule.prayers.length>=5);assert.equal(schedule.scheduleKey,saved.scheduleKey);
  const covered:any=await acknowledgeTravelCoverage('owner',{requestKey:randomUUID(),expectedScheduleKey:saved.scheduleKey,localScheduledUntil:new Date(Date.now()+3600000).toISOString()});assert.ok(covered.localScheduledUntil);
  await assert.rejects(acknowledgeTravelCoverage('owner',{requestKey:randomUUID(),expectedScheduleKey:saved.scheduleKey,localScheduledUntil:new Date(Date.now()+49*3600000).toISOString()}),/48 hours/);
  const manual:any=await updateTravelLocation('owner',{requestKey:randomUUID(),expectedScheduleKey:saved.scheduleKey,mode:'MANUAL',source:'MANUAL',latitude:27.7172,longitude:85.324});assert.equal(manual.location.timezone,'Asia/Kathmandu');assert.equal(manual.location.city,null);assert.equal(manual.localScheduledUntil,null);
  await assert.rejects(acknowledgeTravelCoverage('owner',{requestKey:randomUUID(),expectedScheduleKey:saved.scheduleKey,localScheduledUntil:null}),/Schedule changed/);
  assert.equal((await getTravelState('other')).location,null);
  await tx.$executeRaw`DELETE FROM users WHERE id='owner'`;
  const count:any[]=await tx.$queryRaw`SELECT count(*)::int n FROM travel_operations`;assert.equal(count[0].n,0);
  console.log('Travel isolated PostgreSQL checks passed: atomic location, method preservation, replay, stale GPS/key, coverage bounds, UTC schedule, ownership and account cascade. All changes rolled back.');
  throw rollback;
 },{timeout:90000}); }catch(e){if(e!==rollback)throw e;}finally{(prisma as any).$transaction=orig.transaction;(prisma as any).$queryRaw=orig.query;await prisma.$disconnect();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
