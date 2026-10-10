import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { prisma } from '../src/lib/prisma';
import { evaluateKahf,kahfPatchSchema,getKahfPreferences,updateKahfPreferences,runKahfReminders,kahfDelivery } from '../src/services/kahf-reminder.service';
async function main(){
 assert.equal(evaluateKahf(new Date('2026-10-09T06:00:00Z'),'Africa/Cairo','09:00',true).eligible,true);
 assert.equal(evaluateKahf(new Date('2026-10-08T06:00:00Z'),'Africa/Cairo','09:00',true).eligible,false);
 assert.equal(evaluateKahf(new Date('2026-10-10T06:00:00Z'),'Africa/Cairo','09:00',true).eligible,false);
 assert.equal(evaluateKahf(new Date('2026-10-09T05:59:00Z'),'Africa/Cairo','09:00',true).eligible,false);
 assert.equal(evaluateKahf(new Date('2026-10-09T06:00:00Z'),'Africa/Cairo','09:00',false).eligible,false);
 assert.equal(evaluateKahf(new Date('2026-10-08T19:00:00Z'),'Pacific/Kiritimati','09:00',true).eligible,true);
 assert.equal(evaluateKahf(new Date('2026-10-09T14:00:00Z'),'America/New_York','10:00',true).eligible,true);
 assert.equal(evaluateKahf(new Date('2026-10-09T03:15:00Z'),'Asia/Kathmandu','09:00',true).eligible,true);
 assert.equal(evaluateKahf(new Date('2027-03-12T13:00:00Z'),'America/New_York','08:00',true).eligible,true);
 assert.equal(kahfPatchSchema.safeParse({}).success,false);assert.equal(kahfPatchSchema.safeParse({time:'24:00'}).success,false);assert.equal(kahfPatchSchema.safeParse({soundEnabled:true}).success,false);
 if(process.env.KAHF_TEST_DB!=='true'){console.log('Kahf local Friday, global timezone, DST and input checks passed.');return;}
 const original={tx:prisma.$transaction.bind(prisma),query:prisma.$queryRaw,send:kahfDelivery.send,history:kahfDelivery.history};
 const rollback=new Error('KAHF_TEST_ROLLBACK');const schema='kahf_test_'+randomUUID().replace(/-/g,'');
 try{await original.tx(async tx=>{
  await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
  await tx.$executeRawUnsafe(`CREATE TABLE users(id TEXT PRIMARY KEY,timezone TEXT DEFAULT 'Africa/Cairo',"isActive" BOOLEAN DEFAULT true)`);
  await tx.$executeRawUnsafe(`CREATE TABLE device_tokens("userId" TEXT)`);
  for(const statement of readFileSync('prisma/migrations/20261010180000_kahf_reminder/migration.sql','utf8').split(';').map(s=>s.trim()).filter(Boolean))await tx.$executeRawUnsafe(statement);
  await tx.$executeRaw`INSERT INTO users(id) VALUES ('owner'),('other')`;await tx.$executeRaw`INSERT INTO device_tokens("userId") VALUES ('owner')`;
  (prisma as any).$transaction=async(fn:any)=>fn(tx);(prisma as any).$queryRaw=tx.$queryRaw.bind(tx);
  const payloads:any[]=[];kahfDelivery.send=(async(_id:any,payload:any)=>{payloads.push(payload);return {sent:1,failed:0};}) as any;kahfDelivery.history=(async()=>({})) as any;
  const initial=await getKahfPreferences('owner');assert.equal(initial.enabled,false);assert.equal(initial.time,'09:00');assert.equal(initial.soundEnabled,false);
  await updateKahfPreferences('owner',{enabled:true});const updated=await updateKahfPreferences('owner',{time:'09:00'});assert.equal(updated.enabled,true);assert.equal((await getKahfPreferences('other')).enabled,false);
  await assert.rejects(getKahfPreferences('missing'),/User not found/);
  await runKahfReminders(new Date('2026-10-08T06:00:00Z'));assert.equal(payloads.length,0);
  await runKahfReminders(new Date('2026-10-09T06:00:00Z'));await runKahfReminders(new Date('2026-10-09T06:00:00Z'));assert.equal(payloads.length,1);assert.equal(payloads[0].nativeSound,null);assert.equal(payloads[0].androidChannelId,'kahf_silent_v1');assert.equal(payloads[0].data.deepLink,'/quran/surah/18');
  await updateKahfPreferences('owner',{time:'10:00'});await runKahfReminders(new Date('2026-10-09T07:00:00Z'));assert.equal(payloads.length,1,'Time edits must not cause another Friday notification');
  await updateKahfPreferences('owner',{enabled:false});await runKahfReminders(new Date('2026-10-16T07:00:00Z'));assert.equal(payloads.length,1);
  await updateKahfPreferences('owner',{enabled:true});await runKahfReminders(new Date('2026-10-16T07:00:00Z'));assert.equal(payloads.length,2);
  await tx.$executeRaw`DELETE FROM users WHERE id='owner'`;const count:any[]=await tx.$queryRaw`SELECT count(*)::int n FROM kahf_send_logs`;assert.equal(count[0].n,0);
  console.log('Kahf isolated PostgreSQL checks passed: opt-in, partial updates, owner isolation, silent payload, Friday-only delivery, durable dedupe across time edits, disable/re-enable and deletion cascade. No real push sent; all DB changes rolled back.');throw rollback;
 },{timeout:90000});}catch(e){if(e!==rollback)throw e;}finally{(prisma as any).$transaction=original.tx;(prisma as any).$queryRaw=original.query;kahfDelivery.send=original.send;kahfDelivery.history=original.history;await prisma.$disconnect();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
