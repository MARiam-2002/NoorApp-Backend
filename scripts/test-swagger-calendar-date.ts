import assert from 'node:assert/strict';
import { getPrayerSchedule } from '../src/services/prayer.service';
import { getSwaggerSpec, setupSwagger } from '../src/lib/swagger';
import express from 'express';
async function main(){
 for(const [lat,lng,tz] of [[40.7128,-74.006,'America/New_York'],[1.87,-157.4,'Pacific/Kiritimati'],[-33.8688,151.2093,'Australia/Sydney'],[30.0444,31.2357,'Africa/Cairo']] as const){
  for(const date of ['2026-10-10','2027-03-28','2027-12-31']){
   const result=await getPrayerSchedule(lat,lng,tz,date,'AUTO','SHAFI','query');
   assert.equal(result.date,date);assert.equal(result.schedule.length,5);
  }
 }
 await assert.rejects(()=>getPrayerSchedule(40,-74,'America/New_York','2027-02-30'));
 await assert.rejects(()=>getPrayerSchedule(40,-74,'America/New_York','invalid'));
 const spec=getSwaggerSpec();assert.ok(Object.keys(spec.paths).length>100,'spec building must not silently fall back');
 const refs:string[]=[];function walk(o:any){if(!o||typeof o!=='object')return;if(o.$ref)refs.push(o.$ref);Object.values(o).forEach(walk)}walk(spec);
 for(const ref of refs){if(!ref.startsWith('#/'))continue;let node:any=spec;for(const key of ref.slice(2).split('/'))node=node?.[key.replace(/~1/g,'/').replace(/~0/g,'~')];assert.notEqual(node,undefined,ref)}
 for(const [p,item] of Object.entries(spec.paths) as any[])for(const [m,op] of Object.entries(item) as any[])if(['get','post','put','patch','delete'].includes(m))assert.ok(Object.keys(op.responses||{}).length,`${m} ${p} missing responses`);
 assert.ok(spec.components.schemas.DashboardResponse.properties.dailyGoal);
 assert.deepEqual(spec.components.schemas.AzanPreferencesPatch.properties.prayerTimeSoundMode.enum,['azan','announcement']);
 const app=express();setupSwagger(app);const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 try{const address:any=server.address();const response=await fetch(`http://127.0.0.1:${address.port}/api/v1/docs`);assert.equal(response.status,200);const html=await response.text();assert.ok(html.includes('Noor Developer Portal'));assert.ok(html.includes('persistAuthorization: false'));assert.ok(!html.includes('.errors-wrapper { display: none'));assert.ok(html.includes('prefers-reduced-motion'));}finally{await new Promise<void>((r,j)=>server.close(e=>e?j(e):r()))}
 console.log('Calendar-date and Swagger contract/HTML checks passed. No production writes.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
