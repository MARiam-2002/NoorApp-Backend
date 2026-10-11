import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { prisma } from '../src/lib/prisma';
import { generateRefreshToken } from '../src/lib/auth';
import { refreshToken } from '../src/services/auth.service';

const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const user={id:'refresh-test',email:'refresh@example.com',username:'refresh',fullName:null,role:'USER',provider:'EMAIL',providerId:null,googleId:null,createdAt:new Date(),isActive:true};
let rows=new Map<string,any>();let failCreate=false;let creates=0;let queue=Promise.resolve();
const original=prisma.$transaction;
(prisma as any).$transaction=async (fn:any)=>{
 let release!:()=>void;const previous=queue;queue=new Promise<void>(r=>release=r);await previous;
 const snapshot=new Map([...rows].map(([k,v])=>[k,{...v}]));
 try{return await fn({
  refreshToken:{updateMany:async({where,data}:any)=>{
   const row=rows.get(where.tokenHash);
   if(!row||row.userId!==where.userId||row.revokedAt!==null||row.expiresAt<=where.expiresAt.gt)return {count:0};
   row.revokedAt=data.revokedAt;return {count:1};
  },create:async({data}:any)=>{if(failCreate)throw new Error('simulated storage failure');creates++;rows.set(data.tokenHash,{...data,revokedAt:null});return data;}},
  user:{findUnique:async()=>user},
 });}catch(e){rows=snapshot;throw e;}finally{release();}
};
function seed(){const token=generateRefreshToken({userId:user.id,email:user.email});rows.set(hash(token),{userId:user.id,revokedAt:null,expiresAt:new Date(Date.now()+60000)});return token;}
(async()=>{try{
 const token=seed();failCreate=true;
 await assert.rejects(refreshToken({refreshToken:token}),/simulated storage failure/);
 assert.equal(rows.get(hash(token)).revokedAt,null,'failed replacement must roll back revocation');
 failCreate=false;const result=await refreshToken({refreshToken:token});
 assert.deepEqual(Object.keys(result).sort(),['tokens','user']);
 assert.deepEqual(Object.keys(result.tokens).sort(),['accessToken','expiresIn','refreshToken']);
 assert.notEqual(result.tokens.refreshToken,token);assert(rows.get(hash(token)).revokedAt);
 await assert.rejects(refreshToken({refreshToken:token}),(e:any)=>e.statusCode===401);
 await refreshToken({refreshToken:result.tokens.refreshToken});
 const concurrent=seed();const before=creates;
 const outcomes=await Promise.allSettled([refreshToken({refreshToken:concurrent}),refreshToken({refreshToken:concurrent})]);
 assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(creates-before,1);
 const invalid=seed();user.isActive=false;
 await assert.rejects(refreshToken({refreshToken:invalid}),(e:any)=>e.statusCode===401);
 assert.equal(rows.get(hash(invalid)).revokedAt,null);user.isActive=true;
 const expired=seed();rows.get(hash(expired)).expiresAt=new Date(0);
 await assert.rejects(refreshToken({refreshToken:expired}),(e:any)=>e.statusCode===401);
 console.log('Refresh regression passed: rollback, rotation, replay, serialized concurrent claims, inactive/expired session, unchanged response contract. Mock DB; no production data changed.');
}finally{(prisma as any).$transaction=original;await prisma.$disconnect();}})().catch(e=>{console.error(e);process.exitCode=1});
