import { createHash } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { ErrorCodes } from '../config';
import { AZAN_PREFERENCES_USER_SELECT, buildAzanPreferencesFromUser } from './azan.service';
import { inferTimezoneFromCoordinates, getZonedYmd } from '../shared/utils/prayer-location';
import { computePrayerInstantsAround } from './prayer.service';

export const travelLocationSchema = z.object({
 requestKey: z.string().uuid(), expectedScheduleKey: z.string().regex(/^[a-f0-9]{64}$/),
 mode: z.enum(['MANUAL', 'FOREGROUND_AUTO']),
 latitude: z.number().finite().min(-90).max(90), longitude: z.number().finite().min(-180).max(180),
 source: z.enum(['GPS', 'MANUAL']), observedAt: z.string().datetime({ offset: true }).optional(),
 accuracyMeters: z.number().finite().min(0).max(5000).optional(),
 city: z.string().trim().min(1).max(120).nullable().optional(),
 country: z.string().trim().min(1).max(120).nullable().optional(),
}).strict().superRefine((v, ctx) => {
 if (v.source === 'GPS' && (!v.observedAt || v.accuracyMeters === undefined)) ctx.addIssue({ code: 'custom', message: 'GPS requires observedAt and accuracyMeters' });
 if (v.source === 'GPS' && v.mode !== 'FOREGROUND_AUTO') ctx.addIssue({ code: 'custom', message: 'GPS updates require foreground automatic mode' });
});
export const travelCoverageSchema = z.object({ requestKey: z.string().uuid(), expectedScheduleKey: z.string().regex(/^[a-f0-9]{64}$/), localScheduledUntil: z.string().datetime({offset:true}).nullable() }).strict();
type Row = { id: string; latitude: number | null; longitude: number | null; timezone: string; city: string | null; country: string | null; prayerCalculationMethod: string; azanPreferences: any; travelPreferences: any };
const fail = (message: string) => new AppError(message, 409, ErrorCodes.CONFLICT);
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
// Hash effective scheduling inputs, never local coverage or translated labels.
export function prayerScheduleKey(user: any): string {
 const p = buildAzanPreferencesFromUser(user);
 return hash([user.latitude ?? null, user.longitude ?? null, user.timezone, p.lastLat, p.lastLng, p.calculationMethod, p.madhab,
  p.azanEnabled, p.soundEnabled, p.vibrationEnabled, p.azanSoundId ?? p.voiceId, p.notificationSoundId,
  p.prayerTimeSoundMode, p.takbirSoundId, ...['fajr','dhuhr','asr','maghrib','isha'].map(k => (p.prayerTimeSoundOverrides as any)[k] ?? null), p.preReminderEnabled, p.preReminderMinutes,
  ...['fajr','dhuhr','asr','maghrib','isha'].map(k => (p.prayers as any)[k]), p.fcmPrayerBackupEnabled]);
}
async function row(db: any, userId: string, lock = false): Promise<Row> {
 const rows = lock
  ? await db.$queryRaw`SELECT "id","latitude","longitude","timezone","city","country","prayerCalculationMethod","azanPreferences","travelPreferences" FROM "users" WHERE "id"=${userId} FOR UPDATE`
  : await db.$queryRaw`SELECT "id","latitude","longitude","timezone","city","country","prayerCalculationMethod","azanPreferences","travelPreferences" FROM "users" WHERE "id"=${userId}`;
 if (!rows[0]) throw new AppError('User not found',404,ErrorCodes.NOT_FOUND);
 return rows[0];
}
export function travelState(u: Row) {
 const prefs = buildAzanPreferencesFromUser(u);
 const hasLocation = u.latitude !== null && u.longitude !== null;
 const timezone = hasLocation ? inferTimezoneFromCoordinates(u.latitude!,u.longitude!,u.timezone) : u.timezone;
 return { mode: u.travelPreferences?.mode ?? 'MANUAL', scheduleKey: prayerScheduleKey(u),
  location: hasLocation ? { latitude:u.latitude, longitude:u.longitude, timezone:u.timezone, city:u.city, country:u.country } : null,
  observedAt:u.travelPreferences?.observedAt ?? null, accuracyMeters:u.travelPreferences?.accuracyMeters ?? null,
  source:u.travelPreferences?.source ?? (hasLocation ? 'SAVED' : 'UNSET'),
  updatedAt:u.travelPreferences?.updatedAt ?? null, timezoneMatchesCoordinates: !hasLocation || timezone === u.timezone,
  calculationMethod:prefs.calculationMethod, madhab:prefs.madhab, localScheduledUntil:prefs.localScheduledUntil ?? null,
  foregroundOnly:true, backgroundTracking:false, serverTime:new Date().toISOString() };
}
export async function getTravelState(userId:string) { return travelState(await row(prisma,userId)); }
export async function getTravelSchedule(userId:string) {
 const u=await row(prisma,userId); const state=travelState(u);
 if (!state.location) throw new AppError('Choose a location first',400,ErrorCodes.VALIDATION_ERROR);
 const prefs=buildAzanPreferencesFromUser(u); const now=new Date();
 const schedule=computePrayerInstantsAround({latitude:u.latitude!,longitude:u.longitude!,timezone:u.timezone,method:prefs.calculationMethod,madhab:prefs.madhab,locationSource:'profile',now});
 return {...state, timezone:schedule.timezone, date:getZonedYmd(now,schedule.timezone).dateStr,
  prayers:schedule.instants.filter(v=>v.timestamp.getTime()>now.getTime()).map(v=>({prayerKey:v.key,date:v.date,time:v.time,prayerAtUtc:v.timestamp.toISOString()})),
  notificationPreferences:prefs, refreshAfterUtc:new Date(now.getTime()+6*3600000).toISOString(),
  calculationIsEstimate:true };
}
async function mutate(userId:string, kind:string, input:any, apply:(db:any,u:Row)=>Promise<void>) {
 const fingerprint=hash([kind,input]);
 return prisma.$transaction(async db=>{
  const u=await row(db,userId,true);
  const old:any[]=await db.$queryRaw`SELECT "fingerprint","result" FROM "travel_operations" WHERE "userId"=${userId} AND "requestKey"=${input.requestKey}`;
  if(old.length) { if(old[0].fingerprint!==fingerprint) throw fail('Request key already used with different input'); return old[0].result; }
  if(prayerScheduleKey(u)!==input.expectedScheduleKey) throw fail('Schedule changed; refresh travel state before retrying');
  await apply(db,u); const result=travelState(await row(db,userId));
  await db.$executeRaw`INSERT INTO "travel_operations" ("userId","requestKey","fingerprint","result") VALUES (${userId},${input.requestKey},${fingerprint},${JSON.stringify(result)}::jsonb)`;
  return result;
 },{timeout:15000});
}
export async function updateTravelLocation(userId:string, raw:unknown) {
 const input=travelLocationSchema.parse(raw);
 return mutate(userId,'LOCATION',input,async(db,u)=>{
  const now=Date.now();
  if(input.source==='GPS') {
   const observed=Date.parse(input.observedAt!);
   if(observed>now+60000 || observed<now-10*60000) throw fail('GPS observation must be fresh (10 minutes, 1 minute future tolerance)');
   if(u.travelPreferences?.observedAt && observed<=Date.parse(u.travelPreferences.observedAt)) throw fail('GPS observation is older than the saved observation');
  }
  const timezone=inferTimezoneFromCoordinates(input.latitude,input.longitude,'');
  if(!timezone) throw new AppError('Timezone unavailable for these coordinates',400,ErrorCodes.VALIDATION_ERROR);
  const prefs={...(u.azanPreferences??{}),lastLat:input.latitude,lastLng:input.longitude,lastLocationLabel:input.city??null,localScheduledUntil:null};
  const travel={mode:input.mode,source:input.source,observedAt:input.source==='GPS'?input.observedAt:new Date().toISOString(),accuracyMeters:input.source==='GPS'?input.accuracyMeters:null,updatedAt:new Date().toISOString()};
  await db.$executeRaw`UPDATE "users" SET "latitude"=${input.latitude}, "longitude"=${input.longitude}, "timezone"=${timezone}, "city"=${input.city??null}, "country"=${input.country??null}, "azanPreferences"=${JSON.stringify(prefs)}::jsonb, "travelPreferences"=${JSON.stringify(travel)}::jsonb, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${userId}`;
 });
}
export async function acknowledgeTravelCoverage(userId:string,raw:unknown) {
 const input=travelCoverageSchema.parse(raw);
 return mutate(userId,'COVERAGE',input,async(db,u)=>{
  if(input.localScheduledUntil) {
   const delta=Date.parse(input.localScheduledUntil)-Date.now();
   if(delta<=0 || delta>48*3600000) throw new AppError('Coverage must end within the next 48 hours',400,ErrorCodes.VALIDATION_ERROR);
  }
  const prefs={...(u.azanPreferences??{}),localScheduledUntil:input.localScheduledUntil};
  await db.$executeRaw`UPDATE "users" SET "azanPreferences"=${JSON.stringify(prefs)}::jsonb,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${userId}`;
 });
}
export async function isPrayerSnapshotCurrent(userId:string,key:string) {
 const current=await prisma.user.findUnique({where:{id:userId},select:{...AZAN_PREFERENCES_USER_SELECT,timezone:true}});
 return current!==null && prayerScheduleKey(current)===key;
}
