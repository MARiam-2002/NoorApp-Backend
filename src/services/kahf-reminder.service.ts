import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { ErrorCodes } from '../config';
import { logger } from '../lib/logger';
import { getLocalClock, resolveTimezone } from './salawat-reminder.service';
import { isDueAtLocalMinute, REMINDER_LATE_TOLERANCE_MINUTES, PUSH_TTL_SECONDS } from '../shared/utils/reminder-timing';
import { sendPushToUser } from './device.service';
import { createNotification } from './notification.service';
export const kahfPatchSchema=z.object({enabled:z.boolean().optional(),time:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional()}).strict().refine(v=>v.enabled!==undefined||v.time!==undefined,'At least one field is required');
export const KAHF_COPY={titleAr:'سورة الكهف',titleEn:'Surah Al-Kahf',bodyAr:'تذكير بقراءة سورة الكهف اليوم',bodyEn:'A reminder to read Surah Al-Kahf today'};
function dto(row:any){return {enabled:row.enabled??false,time:row.time??'09:00',timezone:resolveTimezone(row.timezone),weekday:'FRIDAY',surahId:18,deepLink:'/quran/surah/18',soundEnabled:false,vibrationEnabled:false,deliveryMode:'SERVER_ONLY',...KAHF_COPY};}
export async function getKahfPreferences(userId:string){
 const rows:any[]=await prisma.$queryRaw`SELECT u."timezone",p."enabled",p."time" FROM "users" u LEFT JOIN "kahf_preferences" p ON p."userId"=u."id" WHERE u."id"=${userId}`;
 if(!rows.length)throw new AppError('User not found',404,ErrorCodes.NOT_FOUND);return dto(rows[0]);
}
export async function updateKahfPreferences(userId:string,raw:unknown){
 const v=kahfPatchSchema.parse(raw);
 return prisma.$transaction(async db=>{
  const users:any[]=await db.$queryRaw`SELECT "id","timezone" FROM "users" WHERE "id"=${userId} FOR UPDATE`;
  if(!users.length)throw new AppError('User not found',404,ErrorCodes.NOT_FOUND);
  await db.$executeRaw`INSERT INTO "kahf_preferences" ("userId","enabled","time") VALUES (${userId},${v.enabled??false},${v.time??'09:00'}) ON CONFLICT ("userId") DO UPDATE SET "enabled"=COALESCE(${v.enabled??null}::boolean,"kahf_preferences"."enabled"),"time"=COALESCE(${v.time??null}::text,"kahf_preferences"."time"),"updatedAt"=CURRENT_TIMESTAMP`;
  const rows:any[]=await db.$queryRaw`SELECT "enabled","time" FROM "kahf_preferences" WHERE "userId"=${userId}`;
  return dto({...rows[0],timezone:users[0].timezone});
 });
}
export function evaluateKahf(now:Date,timezone:string,time:string,enabled:boolean){
 const c=getLocalClock(now,timezone);const day=new Date(c.dayKey+'T12:00:00Z').getUTCDay();
 const target=Number(time.slice(0,2))*60+Number(time.slice(3));
 return {eligible:enabled&&day===5&&isDueAtLocalMinute(c.hour*60+c.minute-target,REMINDER_LATE_TOLERANCE_MINUTES),dayKey:c.dayKey,occurrenceKey:c.dayKey+'|KAHF'};
}
// Test seam: no real notifications are sent by the regression suite.
export const kahfDelivery={send:sendPushToUser,history:createNotification};
export async function runKahfReminders(now=new Date()){
 let cursor='';let sent=0,claimed=0;
 for(;;){
  const users:any[]=await prisma.$queryRaw`SELECT u."id",u."timezone",p."time" FROM "users" u JOIN "kahf_preferences" p ON p."userId"=u."id" WHERE u."isActive"=true AND p."enabled"=true AND u."id">${cursor} AND EXISTS (SELECT 1 FROM "device_tokens" d WHERE d."userId"=u."id") ORDER BY u."id" LIMIT 200`;
  if(!users.length)break;cursor=users[users.length-1].id;
  for(const u of users){try{
   const zone=resolveTimezone(u.timezone),decision=evaluateKahf(now,zone,u.time,true);if(!decision.eligible)continue;
   // Recheck preferences under row lock before claiming. Time edits cannot produce a second Friday send.
   const acquired=await prisma.$transaction(async db=>{
    const current:any[]=await db.$queryRaw`SELECT u."timezone",u."isActive",p."enabled",p."time" FROM "users" u JOIN "kahf_preferences" p ON p."userId"=u."id" WHERE u."id"=${u.id} FOR UPDATE OF u,p`;
    if(!current.length||!current[0].isActive||current[0].timezone!==u.timezone||current[0].time!==u.time||!current[0].enabled)return false;
    return (await db.$executeRaw`INSERT INTO "kahf_send_logs" ("userId","occurrenceKey") VALUES (${u.id},${decision.occurrenceKey}) ON CONFLICT DO NOTHING`)===1;
   });if(!acquired)continue;claimed++;
   const dedupeKey=decision.dayKey+'|'+u.id+'|KAHF';const data={type:'KAHF',eventType:'KAHF',eventKey:'KAHF',kind:'kahf_reminder',surahId:'18',deepLink:'/quran/surah/18',timezone:zone,dayKey:decision.dayKey,occurrenceKey:decision.occurrenceKey,idempotencyKey:decision.occurrenceKey,dedupeKey,soundEnabled:'false',vibrationEnabled:'false',androidChannelId:'kahf_silent_v1',source:'SERVER',deliveryMode:'OS_NOTIFICATION',scheduledAtUtc:now.toISOString(),expiresAtUtc:new Date(now.getTime()+PUSH_TTL_SECONDS.SCHEDULED_REMINDER*1000).toISOString(),...KAHF_COPY};
   const result=await kahfDelivery.send(u.id,{title:KAHF_COPY.titleAr,body:KAHF_COPY.bodyAr,titleAr:KAHF_COPY.titleAr,bodyAr:KAHF_COPY.bodyAr,data,nativeSound:null,androidChannelId:'kahf_silent_v1',ttlSeconds:PUSH_TTL_SECONDS.SCHEDULED_REMINDER});sent+=result.sent;
   await kahfDelivery.history({userId:u.id,...KAHF_COPY,type:'GENERAL',deepLink:'/quran/surah/18',payload:{...data,surahId:18}}).catch(()=>null);
  }catch(e){logger.warn('[KahfReminder] User delivery failed',{userId:u.id,message:e instanceof Error?e.message:'unknown'});}}
  if(users.length<200)break;
 }
 if(claimed)logger.info('[KahfReminder] Pass completed',{claimed,sent});
 return {claimed,sent};
}
