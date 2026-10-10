import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { authRouter } from '../src/routes/auth';
import { errorHandler } from '../src/middleware/common';
import { updateProfile } from '../src/services/profile.service';
import { prisma } from '../src/lib/prisma';
import { verifyPassword } from '../src/lib/auth';
import { beginEmailRegistration, resendEmailVerification, verifyEmailRegistration, verificationHash, codeMatches, registrationMail } from '../src/services/email-registration.service';
import { addEmailVerificationOpenApi } from '../src/shared/data/email-verification-openapi';
const email:any=registrationMail;
async function main() {
 const oldFind=prisma.user.findUnique;(prisma.user as any).findUnique=async()=>({email:'owner@example.com'});try{await assert.rejects(updateProfile('test-only',{email:'someone-else@example.com'}),(e:any)=>e.statusCode===409);}finally{(prisma.user as any).findUnique=oldFind;}
 const id=randomUUID();assert(codeMatches({id,codeHash:verificationHash(id,'012345')},'012345'));assert(!codeMatches({id,codeHash:verificationHash(id,'012345')},'123450'));assert(!codeMatches({id:randomUUID(),codeHash:verificationHash(id,'012345')},'012345'));
 const spec:any={paths:{},components:{schemas:{}}};addEmailVerificationOpenApi(spec);assert(spec.paths['/auth/sign-up'].post.responses[202]);assert(!spec.paths['/auth/sign-up'].post.responses[201]);assert.equal(spec.paths['/auth/verify-email'].post.requestBody.content['application/json'].schema.properties.code.pattern,'^[0-9]{6}$');
 const realTx=prisma.$transaction.bind(prisma);const oldTransaction=prisma.$transaction;const oldExecute=prisma.$executeRaw;const oldCount=prisma.user.count;const oldStatus=email.status;const oldSend=email.send;
 const schema='email_test_'+randomUUID().replaceAll('-','');const rollback=new Error('EXPECTED_ROLLBACK');let code='';let delivery=true;
 email.status=()=>({provider:'smtp',hasMailFrom:true,usesResendTestSender:false});email.send=async (c:string)=>{code=c;return delivery;};
 try {
  try { await realTx(async tx=>{
   await tx.$executeRawUnsafe('CREATE SCHEMA "'+schema+'"');await tx.$executeRawUnsafe('SET LOCAL search_path TO "'+schema+'"');
   await tx.$executeRawUnsafe('CREATE TABLE "users" ("id" TEXT PRIMARY KEY,"email" TEXT UNIQUE,"username" TEXT UNIQUE,"password" TEXT,"fullName" TEXT)');
   for(const statement of readFileSync('prisma/migrations/20261010130000_email_registration_verification/migration.sql','utf8').split(';').map(v=>v.trim()).filter(Boolean))await tx.$executeRawUnsafe(statement);
   const count=async ({where}:any)=> { const rows=where.email?await tx.$queryRaw<any[]>`SELECT COUNT(*)::int AS n FROM "users" WHERE "email"=${where.email}`:await tx.$queryRaw<any[]>`SELECT COUNT(*)::int AS n FROM "users" WHERE "username"=${where.username}`;return rows[0].n; };
   const proxy:any={$executeRaw:tx.$executeRaw.bind(tx),$queryRaw:tx.$queryRaw.bind(tx),deletedIdentity:{deleteMany:async()=>({count:0})},user:{count,create:async ({data}:any)=>{const uid=randomUUID();await tx.$executeRaw`INSERT INTO "users"("id","email","username","password","fullName") VALUES(${uid},${data.email},${data.username},${data.password},${data.fullName})`;return {id:uid};}}};
   (prisma as any).$transaction=async(fn:any)=>fn(proxy);(prisma as any).$executeRaw=proxy.$executeRaw;(prisma.user as any).count=count;
   const input={email:'Isolated@example.com',password:'StrongPass123!',username:'isolated'};
   const app=express();app.use(express.json());app.use('/api/v1/auth',authRouter);app.use(errorHandler);const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base='http://127.0.0.1:'+(server.address() as any).port+'/api/v1/auth';
   let pending:any;
   try {
    const request=await fetch(base+'/sign-up',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});assert.equal(request.status,202);assert.equal(request.headers.get('cache-control'),'private, no-store');pending=(await request.json() as any).data;assert(!('code' in pending));
    const invalidCode=await fetch(base+'/verify-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({verificationId:pending.verificationId,code:'١٢٣٤٥٦'})});assert.equal(invalidCode.status,400);
   }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
   assert.equal(pending.verificationRequired,true);assert(!('tokens' in pending));assert.equal(await count({where:{email:'isolated@example.com'}}),0);
   const row=(await tx.$queryRaw<any[]>`SELECT * FROM "pending_registrations" WHERE "id"=${pending.verificationId}`)[0];assert(!JSON.stringify(row).includes('StrongPass123!'));assert(!JSON.stringify(row).includes(code));assert(await verifyPassword(input.password,row.payload.passwordHash));
   await assert.rejects(resendEmailVerification(pending.verificationId),(e:any)=>e.statusCode===429);
   const firstCode=code;await tx.$executeRaw`UPDATE "pending_registrations" SET "lastSentAt"=CURRENT_TIMESTAMP-INTERVAL '61 seconds' WHERE "id"=${pending.verificationId}`;
   await resendEmailVerification(pending.verificationId);if(code!==firstCode)await assert.rejects(verifyEmailRegistration(pending.verificationId,firstCode),(e:any)=>e.statusCode===400);
   const verified=await verifyEmailRegistration(pending.verificationId,code);assert.equal(verified.loginRequired,true);assert(!('tokens' in verified));assert.equal(await count({where:{email:'isolated@example.com'}}),1);
   const users=await tx.$queryRaw<any[]>`SELECT "emailVerifiedAt" FROM "users"`;assert(users[0].emailVerifiedAt instanceof Date);
   await assert.rejects(verifyEmailRegistration(pending.verificationId,code),(e:any)=>e.statusCode===400);
   await assert.rejects(beginEmailRegistration(input),(e:any)=>e.statusCode===409);
   const locked=await beginEmailRegistration({...input,email:'locked@example.com',username:'locked'});
   const wrong=code==='000000'?'000001':'000000';for(let i=0;i<5;i++)await assert.rejects(verifyEmailRegistration(locked.verificationId,wrong),(e:any)=>e.statusCode===400);
   await assert.rejects(verifyEmailRegistration(locked.verificationId,code),(e:any)=>e.statusCode===400);
   assert.equal((await tx.$queryRaw<any[]>`SELECT "attempts" FROM "pending_registrations" WHERE "id"=${locked.verificationId}`)[0].attempts,5);
   const expired=await beginEmailRegistration({...input,email:'expired@example.com',username:'expired'});await tx.$executeRaw`UPDATE "pending_registrations" SET "expiresAt"=CURRENT_TIMESTAMP-INTERVAL '1 second' WHERE "id"=${expired.verificationId}`;
   await assert.rejects(verifyEmailRegistration(expired.verificationId,code),(e:any)=>e.statusCode===400);
   delivery=false;await assert.rejects(beginEmailRegistration({...input,email:'failed@example.com',username:'failed'}),(e:any)=>e.statusCode===503);assert.equal(await count({where:{email:'failed@example.com'}}),0);
   email.status=()=>({provider:'mock',hasMailFrom:false});await assert.rejects(beginEmailRegistration({...input,email:'mock@example.com',username:'mock'}),(e:any)=>e.statusCode===503);
   console.log('PostgreSQL checks passed: no account before verification, hashed password/code, resend cooldown and invalidation, persisted five-attempt lockout, expiry, replay rejection, verified timestamp, mail failure and no mock delivery. No emails sent.');
   throw rollback;
  },{timeout:60000,maxWait:10000}); }catch(e){if(e!==rollback)throw e;}
 }finally{(prisma as any).$transaction=oldTransaction;(prisma as any).$executeRaw=oldExecute;(prisma.user as any).count=oldCount;email.status=oldStatus;email.send=oldSend;}
 assert.equal((await prisma.$queryRaw<any[]>`SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname=${schema}) AS present`)[0].present,false);
 console.log('Temporary schema and test data rolled back; production tables were not accessed.');await prisma.$disconnect();
}
main().catch(async e=>{console.error(e);process.exitCode=1;await prisma.$disconnect();});
