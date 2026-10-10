import assert from 'node:assert/strict';
import { env } from '../src/config';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { calculateZakat, calculationSchema, zakatSettlement } from '../src/shared/utils/zakat';
import { charityReminderOccurrence, deliverCharityReminder } from '../src/services/charity-reminder.service';
import { getZakatCycle, saveZakatCycle, recordZakatPayment } from '../src/services/zakat.service';
import { zakatRouter, charityRouter } from '../src/routes/zakat';
import { generateAccessToken } from '../src/lib/auth';
import { errorHandler } from '../src/middleware/common';
import { getSwaggerSpec } from '../src/lib/swagger';
import { getDailyChallengeDefinition } from '../src/shared/data/daily-challenges';
import { isDailyChallengeCompleted } from '../src/utils/challenge';

async function main() {
  env.ZAKAT_ALLOW_MANUAL_PRICES = true; // Legacy fixtures only; runtime defaults to signed provider quotes.
  const input = calculationSchema.parse({ currency: 'EGP', asOfDate: '2026-10-10', nisabBasis: 'EGYPT_GOLD_21K_85G',
    pricePerGram: '1000', priceAsOfDate: '2026-10-10', priceSource: 'Test fixture, not a live price', hawlCompleted: true,
    assets: { cash: '100000' } });
  assert.equal(calculateZakat(input).dueAmount, '2500.00');
  assert.equal(calculateZakat({ ...input, assets: { ...input.assets, cash: '85000' } }).status, 'DUE');
  assert.equal(calculateZakat({ ...input, assets: { ...input.assets, cash: '84999.99' } }).status, 'BELOW_NISAB');
  assert.equal(calculateZakat({ ...input, hawlCompleted: false }).dueAmount, '0.00');
  assert.equal(calculateZakat({ ...input, priceAsOfDate: '2026-10-09' }).status, 'QUOTE_STALE');
  assert.equal(calculateZakat({ ...input, currency: 'KWD' }).dueAmount, '2500.000');
  assert.equal(calculateZakat({ ...input, currency: 'JPY' }).dueAmount, '2500');
  assert.equal(calculateZakat({ ...input, nisabBasis: 'GOLD_24K_85G' }).reference.metal, 'gold24k');
  assert.equal(calculateZakat({ ...input, nisabBasis: 'SILVER_999_595G', pricePerGram: '10' }).nisabAmount, '5950.00');
  assert.equal(calculationSchema.safeParse({ ...input, deductibleLiabilities: '1' }).success, false);
  assert.equal(calculationSchema.safeParse({ ...input, asOfDate: '2027-02-29' }).success, false);
  assert.equal(calculationSchema.safeParse({ ...input, pricePerGram: '-1' }).success, false);
  assert.equal(calculationSchema.safeParse({ ...input, assets: { home: '100000' } }).success, false);
  assert.deepEqual(zakatSettlement('2500','3000','EGP'), { dueAmount:'2500.00',recordedPaidAmount:'3000.00',remainingAmount:'0.00',excessRecordedAmount:'500.00',paidPercent:100,paymentVerification:'USER_REPORTED',countsTowardDailyJourney:false,awardsPoints:false });
  assert.equal(zakatSettlement('2500','625','EGP').paidPercent,25);
  assert.equal(charityReminderOccurrence(new Date('2026-10-09T09:00:01Z'),'Africa/Cairo',{localTime:'12:00',weekdays:[5]}),'CHARITY|2026-10-09');
  assert.equal(charityReminderOccurrence(new Date('2026-10-09T09:06:00Z'),'Africa/Cairo',{localTime:'12:00',weekdays:[5]}),null);
  assert.equal(charityReminderOccurrence(new Date('2026-10-09T09:00:01Z'),'Africa/Cairo',{localTime:'12:00',weekdays:[1]}),null);
  assert.equal(charityReminderOccurrence(new Date('2026-10-10T10:05:00Z'),'Pacific/Kiritimati',{localTime:'00:00',weekdays:[0]}),'CHARITY|2026-10-11');
  assert.equal(charityReminderOccurrence(new Date('2026-11-01T05:30:00Z'),'America/New_York',{localTime:'01:30',weekdays:[0]}),charityReminderOccurrence(new Date('2026-11-01T06:30:00Z'),'America/New_York',{localTime:'01:30',weekdays:[0]}));
  for (let day=1;day<=366;day++) assert.notEqual(getDailyChallengeDefinition(day).type,'SADAQAH');
  assert.equal(isDailyChallengeCompleted('SADAQAH',1,{quranPagesRead:0,adhkarCompleted:false,sadaqahAmount:100000}),false);

  const replacements: Array<() => void> = [];
  const mock = (target: any, key: string, value: any) => { const original=target[key]; target[key]=value; replacements.push(()=>target[key]=original); };
  const cycles = new Map<string, any>(), payments = new Map<string, any>(), claims = new Set<string>();
  const reminderPreferences = new Map<string, any>();
  mock(prisma.user,'findUnique',async ({where}:any)=>({id:where.id,email:'fixture@example.com',isActive:true,role:'USER',timezone:'Africa/Cairo'}));
  mock(prisma.zakatCycle,'findUnique',async ({where}:any)=>[...cycles.values()].find(row=>row.userId===where.userId_requestKey.userId&&row.requestKey===where.userId_requestKey.requestKey)||null);
  mock(prisma.zakatCycle,'findFirst',async ({where}:any)=>[...cycles.values()].find(row=>row.id===where.id&&row.userId===where.userId)||null);
  mock(prisma.zakatCycle,'create',async ({data}:any)=>{
    if([...cycles.values()].some(row=>row.userId===data.userId&&row.requestKey===data.requestKey)) throw Object.assign(new Error('duplicate'),{code:'P2002'});
    const row={...data,id:randomUUID(),createdAt:new Date(),dueAmount:new Prisma.Decimal(data.dueAmount),assessment:JSON.parse(JSON.stringify(data.assessment,Object.keys(data.assessment).sort()))};
    // Preserve nested fields, but reorder top-level JSON as PostgreSQL JSONB does.
    row.assessment=Object.fromEntries(Object.entries(data.assessment).sort(([a],[b])=>b.localeCompare(a)));
    cycles.set(row.id,row);return row;
  });
  mock(prisma.zakatPayment,'aggregate',async ({where}:any)=>({_sum:{amount:[...payments.values()].filter(row=>row.cycleId===where.cycleId).reduce((sum,row)=>sum.add(row.amount),new Prisma.Decimal(0))}}));
  mock(prisma.zakatPayment,'findUnique',async ({where}:any)=>[...payments.values()].find(row=>row.cycleId===where.cycleId_requestKey.cycleId&&row.requestKey===where.cycleId_requestKey.requestKey)||null);
  mock(prisma.zakatPayment,'create',async ({data}:any)=>{
    if([...payments.values()].some(row=>row.cycleId===data.cycleId&&row.requestKey===data.requestKey)) throw Object.assign(new Error('duplicate'),{code:'P2002'});
    const row={...data,id:randomUUID(),createdAt:new Date(),amount:new Prisma.Decimal(data.amount)};payments.set(row.id,row);return row;
  });
  mock(prisma.zakatCycle,'deleteMany',async ({where}:any)=>{
    const matching=[...cycles.values()].filter(row=>row.id===where.id&&row.userId===where.userId);
    for(const row of matching){cycles.delete(row.id);for(const payment of payments.values())if(payment.cycleId===row.id)payments.delete(payment.id);}
    return {count:matching.length};
  });
  mock(prisma.zakatPayment,'deleteMany',async ({where}:any)=>{
    const row=payments.get(where.id);if(!row||row.cycleId!==where.cycleId)return {count:0};payments.delete(row.id);return {count:1};
  });
  mock(prisma.charityReminder,'findUnique',async ({where}:any)=>reminderPreferences.get(where.userId)||null);
  mock(prisma.charityReminder,'upsert',async ({where,create,update}:any)=>{
    const result=reminderPreferences.has(where.userId)?{...reminderPreferences.get(where.userId),...update}:create;
    reminderPreferences.set(where.userId,result);return result;
  });
  mock(prisma.notification,'create',async ({data}:any)=>({...data,id:randomUUID(),readAt:null,createdAt:new Date()}));
  mock(prisma.charitySendLog,'create',async ({data}:any)=>{
    const key=`${data.userId}|${data.occurrenceKey}`;if(claims.has(key))throw Object.assign(new Error('duplicate'),{code:'P2002'});claims.add(key);return data;
  });
  let server: import('node:http').Server | undefined;
  try {
    const saved=await saveZakatCycle('owner',{requestKey:randomUUID(),dueDate:input.asOfDate,calculation:input});
    await assert.rejects(getZakatCycle('stranger',saved.id),/not found/);
    const cycleRequest={requestKey:randomUUID(),dueDate:input.asOfDate,calculation:input};
    const repeated=await Promise.all(Array.from({length:8},()=>saveZakatCycle('owner',cycleRequest)));
    assert.equal(new Set(repeated.map(row=>row.id)).size,1);
    await assert.rejects(saveZakatCycle('owner',{...cycleRequest,calculation:{...input,priceSource:'Changed source'}}),/different data/);
    await assert.rejects(saveZakatCycle('owner',{...cycleRequest,calculation:{...input,assets:{...input.assets,cash:'99999',bankBalances:'1'}}}),/different data/);
    const payment={requestKey:randomUUID(),amount:'625.00',currency:'EGP',paidOn:input.asOfDate};
    const results=await Promise.all(Array.from({length:8},()=>recordZakatPayment('owner',saved.id,payment)));
    assert.equal(new Set(results.map(row=>row.paymentId)).size,1);
    assert.equal((await getZakatCycle('owner',saved.id)).paidPercent,25);
    await assert.rejects(recordZakatPayment('owner',saved.id,{...payment,amount:'626.00'}),/different data/);
    await assert.rejects(recordZakatPayment('stranger',saved.id,payment),/not found/);
    await assert.rejects(recordZakatPayment('owner',saved.id,{...payment,currency:'USD'}),/currency/);
    await assert.rejects(recordZakatPayment('owner',saved.id,{...payment,requestKey:randomUUID(),amount:'1.001'}),/precision/);
    await assert.rejects(recordZakatPayment('owner',saved.id,{...payment,paidOn:'2099-01-01'}),/Future/);
    let sent=0;
    const sender=(async (_user:any,payload:any)=>{sent++;assert.equal(payload.data.deliveryMode,'OS_NOTIFICATION');assert.equal(payload.nativeSound,'default');assert.equal(payload.data.deepLink,'/charity-reminder');return {sent:1,failed:0};}) as any;
    await Promise.all(Array.from({length:8},()=>deliverCharityReminder('owner','CHARITY|2026-10-09','ar',sender)));
    assert.equal(sent,1);
    mock(prisma.charitySendLog,'create',async ()=>{throw new Error('mock claim unavailable');});
    assert.deepEqual(await deliverCharityReminder('owner','CHARITY|2026-10-10','en',sender),{attempted:0,sent:0});
    assert.equal(sent,1);

    const app=express();app.use(express.json());app.use('/zakat',zakatRouter);app.use('/charity',charityRouter);app.use(errorHandler);
    server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server!.once('listening',resolve));
    const base=`http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`;
    const token=generateAccessToken({userId:'stranger',email:'fixture@example.com'});
    const publicCalc=await fetch(`${base}/zakat/calculate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
    assert.equal(publicCalc.status,200);assert.match(publicCalc.headers.get('cache-control')!,/no-store/);
    assert.equal((await publicCalc.json()).data.dueAmount,'2500.00');
    assert.equal((await fetch(`${base}/zakat/summary`)).status,401);
    assert.equal((await fetch(`${base}/charity/reminder-preferences`)).status,401);
    assert.equal((await fetch(`${base}/zakat/cycles/${saved.id}`,{headers:{Authorization:`Bearer ${token}`}})).status,404);
    assert.equal((await fetch(`${base}/charity/reminder-preferences`,{method:'PATCH',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({weekdays:[5,5]})})).status,400);
    const prefResponse=await fetch(`${base}/charity/reminder-preferences`,{headers:{Authorization:`Bearer ${token}`}});
    assert.equal((await prefResponse.json()).data.enabled,false);
    const prefPatch=await fetch(`${base}/charity/reminder-preferences`,{method:'PATCH',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({enabled:true,weekdays:[1,5],localTime:'13:30'})});
    assert.equal(prefPatch.status,200);assert.equal((await prefPatch.json()).data.deliveryOwner,'BACKEND_FCM');
    const ownerToken=generateAccessToken({userId:'owner',email:'fixture@example.com'});
    const paymentId=results[0]!.paymentId;
    const wrongDelete=await fetch(`${base}/zakat/cycles/${saved.id}/payments/${paymentId}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}});
    assert.equal(wrongDelete.status,404);assert.ok(payments.has(paymentId));
    const rightDelete=await fetch(`${base}/zakat/cycles/${saved.id}/payments/${paymentId}`,{method:'DELETE',headers:{Authorization:`Bearer ${ownerToken}`}});
    assert.equal(rightDelete.status,200);assert.equal((await rightDelete.json()).data.paidPercent,0);
    const cycleDelete=await fetch(`${base}/zakat/cycles/${saved.id}`,{method:'DELETE',headers:{Authorization:`Bearer ${ownerToken}`}});
    assert.equal(cycleDelete.status,200);assert.equal((await cycleDelete.json()).data.deleted,true);
    const spec=getSwaggerSpec();assert.ok(spec.paths['/zakat/calculate'].post.requestBody);assert.ok(spec.paths['/charity/reminder-preferences'].patch);assert.equal(spec.paths['/journey/sadaqah'].patch.deprecated,true);
    console.log('Zakat/Charity checks passed: decimal/currency boundaries, lunar hawl, price freshness, private ownership, concurrent idempotency, fail-closed reminders, HTTP auth/validation and OpenAPI. Mocked database, no live push or production writes.');
  } finally {
    if(server)await new Promise<void>((resolve,reject)=>server!.close(error=>error?reject(error):resolve()));
    replacements.reverse().forEach(restore=>restore());
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
