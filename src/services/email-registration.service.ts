import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { env, ErrorCodes } from '../config';
import { AppError } from '../lib/errors';
import { hashPassword } from '../lib/auth';
import { getEmailProviderStatus, sendVerificationEmail } from '../lib/email';

// Injectable mail boundary for isolated regression tests; production always uses the real provider.
export const registrationMail = { status: getEmailProviderStatus, send: sendVerificationEmail };

type Input = { email: string; password: string; username?: string; fullName?: string | null };
type Pending = { id: string; email: string; payload: { passwordHash: string; username: string; fullName: string | null }; codeHash: string; expiresAt: Date; attempts: number; sentCount: number; windowStartedAt: Date; lastSentAt: Date };
export const verificationHash = (id: string, code: string) => createHmac('sha256', env.JWT_SECRET).update('noor-email-verification:'+id+':'+code).digest('hex');
export function codeMatches(row: Pick<Pending,'id'|'codeHash'>, code: string) {
  const expected = Buffer.from(row.codeHash,'hex'); const actual = Buffer.from(verificationHash(row.id,code),'hex');
  return expected.length === actual.length && timingSafeEqual(expected,actual);
}
function invalid() { return new AppError('Invalid, expired or exhausted verification code',400,ErrorCodes.INVALID_TOKEN); }
function rateLimited() { return new AppError('Please wait before requesting another verification email',429,ErrorCodes.RATE_LIMIT_EXCEEDED); }
function deliveryUnavailable() { return new AppError('Email verification delivery is unavailable. Please retry later.',503,ErrorCodes.EMAIL_DELIVERY_UNAVAILABLE); }
function checkProvider() { const status=registrationMail.status(); if(status.provider==='mock' || !status.hasMailFrom || status.usesResendTestSender) throw deliveryUnavailable(); }
const response = (row: Pick<Pending,'id'|'expiresAt'>) => ({ verificationRequired:true, verificationId:row.id, expiresAt:row.expiresAt.toISOString(), resendAfterSeconds:60, codeLength:6 });
async function deliver(row: Pending, code: string) {
  const sent=await registrationMail.send(code,row.email);
  if(!sent) {
    // Invalidate only this failed delivery, never a newer concurrent resend.
    await prisma.$executeRaw`UPDATE "pending_registrations" SET "expiresAt"=CURRENT_TIMESTAMP WHERE "id"=${row.id} AND "codeHash"=${row.codeHash}`;
    throw deliveryUnavailable();
  }
  return response(row);
}
export async function beginEmailRegistration(input: Input) {
  checkProvider();
  const email=input.email.trim().toLowerCase();
  if(await prisma.user.count({where:{email}})) throw new AppError('Email already exists',409,ErrorCodes.EMAIL_ALREADY_EXISTS);
  const passwordHash=await hashPassword(input.password);
  const username=input.username?.trim() ? input.username.trim().replace(/[^a-zA-Z0-9_]/g,'_').slice(0,30) : (email.split('@')[0] || 'user').replace(/[^a-zA-Z0-9_]/g,'_').slice(0,20)+'_'+randomUUID().slice(0,8);
  if(await prisma.user.count({where:{username}})) throw new AppError('Username already exists',409,ErrorCodes.CONFLICT);
  const payload={passwordHash,username,fullName:input.fullName?.trim() || null};
  const id=randomUUID(); const code=String(randomInt(0,1000000)).padStart(6,'0');
  const digest=verificationHash(id,code); const expiresAt=new Date(Date.now()+600000);
  const row=await prisma.$transaction(async tx=>{
    // Serialize by email across replicas; no account or session exists yet.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${email}, 9813))`;
    const rows=await tx.$queryRaw<Pending[]>`SELECT * FROM "pending_registrations" WHERE "email"=${email} FOR UPDATE`;
    const old=rows[0]; const now=Date.now();
    if(old && (now-old.lastSentAt.getTime()<60000 || (now-old.windowStartedAt.getTime()<3600000 && old.sentCount>=5) || (old.attempts>=5 && old.expiresAt.getTime()>now))) throw rateLimited();
    const sameWindow=old && now-old.windowStartedAt.getTime()<3600000;
    const sentCount=sameWindow ? old.sentCount+1 : 1; const windowStartedAt=sameWindow ? old.windowStartedAt : new Date();
    await tx.$executeRaw`INSERT INTO "pending_registrations" ("id","email","payload","codeHash","expiresAt","sentCount","windowStartedAt") VALUES (${id},${email},${JSON.stringify(payload)}::jsonb,${digest},${expiresAt},${sentCount},${windowStartedAt}) ON CONFLICT ("email") DO UPDATE SET "id"=EXCLUDED."id","payload"=EXCLUDED."payload","codeHash"=EXCLUDED."codeHash","expiresAt"=EXCLUDED."expiresAt","attempts"=0,"sentCount"=EXCLUDED."sentCount","windowStartedAt"=EXCLUDED."windowStartedAt","lastSentAt"=CURRENT_TIMESTAMP,"createdAt"=CURRENT_TIMESTAMP`;
    return {id,email,payload,codeHash:digest,expiresAt,attempts:0,sentCount,windowStartedAt,lastSentAt:new Date()};
  });
  await prisma.$executeRaw`DELETE FROM "pending_registrations" WHERE "createdAt" < CURRENT_TIMESTAMP - INTERVAL '24 hours'`;
  return deliver(row,code);
}
export async function resendEmailVerification(id: string) {
  checkProvider();
  const code=String(randomInt(0,1000000)).padStart(6,'0');
  const row=await prisma.$transaction(async tx=>{
    const rows=await tx.$queryRaw<Pending[]>`SELECT * FROM "pending_registrations" WHERE "id"=${id} FOR UPDATE`;
    const old=rows[0]; if(!old) throw invalid();
    const now=Date.now(); if(now-old.lastSentAt.getTime()<60000 || (now-old.windowStartedAt.getTime()<3600000 && old.sentCount>=5) || (old.attempts>=5 && old.expiresAt.getTime()>now)) throw rateLimited();
    const sameWindow=now-old.windowStartedAt.getTime()<3600000; const attempts=old.expiresAt.getTime()>now ? old.attempts : 0;
    const expiresAt=new Date(now+600000); const codeHash=verificationHash(id,code);
    await tx.$executeRaw`UPDATE "pending_registrations" SET "codeHash"=${codeHash},"expiresAt"=${expiresAt},"lastSentAt"=CURRENT_TIMESTAMP,"attempts"=${attempts},"sentCount"=${sameWindow ? old.sentCount+1 : 1},"windowStartedAt"=${sameWindow ? old.windowStartedAt : new Date()} WHERE "id"=${id}`;
    return {...old,codeHash,expiresAt,attempts};
  });
  return deliver(row,code);
}
export async function verifyEmailRegistration(id: string, code: string) {
  const outcome=await prisma.$transaction(async tx=>{
    const rows=await tx.$queryRaw<Pending[]>`SELECT * FROM "pending_registrations" WHERE "id"=${id} FOR UPDATE`;
    const row=rows[0]; if(!row || row.expiresAt.getTime()<=Date.now() || row.attempts>=5) return null;
    if(!codeMatches(row,code)) { await tx.$executeRaw`UPDATE "pending_registrations" SET "attempts"="attempts"+1 WHERE "id"=${id}`; return null; }
    if(await tx.user.count({where:{email:row.email}})) { await tx.$executeRaw`DELETE FROM "pending_registrations" WHERE "id"=${id}`; return null; }
    await tx.deletedIdentity.deleteMany({where:{email:row.email}});
    const user=await tx.user.create({data:{email:row.email,username:row.payload.username,fullName:row.payload.fullName,password:row.payload.passwordHash,provider:'LOCAL',role:UserRole.USER},select:{id:true}});
    await tx.$executeRaw`UPDATE "users" SET "emailVerifiedAt"=CURRENT_TIMESTAMP WHERE "id"=${user.id}`;
    await tx.$executeRaw`DELETE FROM "pending_registrations" WHERE "id"=${id}`;
    return {emailVerified:true,loginRequired:true};
  });
  if(!outcome) throw invalid(); return outcome;
}
