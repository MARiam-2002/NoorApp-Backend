import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { warshRouter } from '../src/routes/warsh';
import { errorHandler } from '../src/middleware/common';
import { addWarshOpenApi } from '../src/shared/data/warsh-openapi';
import { env } from '../src/config';
import { prisma } from '../src/lib/prisma';
import { getWarshCapability, requireWarsh, warshChapter, warshVerse, validateWarshSource, WARSH_CONTENT_VERSION } from '../src/services/warsh-content.service';
import { buildWarshGoal, getWarshCycle, startWarshCycle, setWarshCompletions, getWarshPosition, setWarshPosition, setWarshBookmark, getWarshBookmarks, warshCompletionInputSchema } from '../src/services/warsh-reader.service';

async function main() {
  const approval = env.WARSH_TEXT_APPROVED;
  try {
    env.WARSH_TEXT_APPROVED = false;
    assert.equal(getWarshCapability().available,false);
    assert.throws(requireWarsh,(e:any)=>e.statusCode===503);
    env.WARSH_TEXT_APPROVED = true; // Test-only; never writes deployment configuration.
    assert.equal(requireWarsh().length,6214);
    assert.equal(warshChapter(1,1,100).totalAyahs,7);
    assert.equal(warshChapter(2,1,2).verses.length,2);
    assert.equal(warshChapter(114,1,100).nextFromAyah,null);
    assert.equal(warshVerse('1:1').ordinal,1);
    assert.throws(()=>warshVerse('1:8'),(e:any)=>e.statusCode===400);
    assert.throws(()=>warshChapter(1,8,50),(e:any)=>e.statusCode===400);
    const bytes = readFileSync('src/shared/data/qpc-warsh-script-ayah.json');
    assert.equal(validateWarshSource(bytes).at(-1)!.key,'114:6');
    assert.throws(()=>validateWarshSource(Buffer.concat([bytes,Buffer.from(' ')])),/checksum/);
    assert.equal(warshCompletionInputSchema.safeParse({contentVersion:WARSH_CONTENT_VERSION,verseKeys:['1:1','1:1'],completed:true,date:'2026-10-10'}).success,false);
    const cycle = {id:randomUUID(),contentVersion:WARSH_CONTENT_VERSION,durationDays:30,startedOn:new Date('2026-10-10Z'),active:true,requestKey:randomUUID(),expectedCycleId:null};
    assert.equal(buildWarshGoal(cycle,0,0,'2026-10-10','Africa/Cairo').dailyGoal.targetVerses,208);
    assert.equal(buildWarshGoal(cycle,10,10,'2026-10-10','Africa/Cairo').dailyGoal.targetVerses,208);
    assert.equal(buildWarshGoal(cycle,6214,208,'2026-11-08','Africa/Cairo').status,'COMPLETED');
    assert.equal(buildWarshGoal(cycle,1,0,'2026-11-09','Africa/Cairo').status,'OVERDUE');
    const spec:any={components:{schemas:{}},paths:{}}; addWarshOpenApi(spec);
    assert.equal(spec.paths['/quran/warsh/cycles/{cycleId}/completions'].put.security[0].bearerAuth.length,0);
    assert.equal(spec.components.schemas.WarshCompletionInput.properties.verseKeys.maxItems,100);
    if (process.env.WARSH_TEST_HTTP==='true') {
      const app=express();app.use(express.json());app.use('/api/v1/quran/warsh',warshRouter);app.use(errorHandler);
      const server=app.listen(0,'127.0.0.1'); await new Promise<void>(resolve=>server.once('listening',resolve));
      const port=(server.address() as {port:number}).port;const base=`http://127.0.0.1:${port}/api/v1/quran/warsh`;
      try {
        const publicResult=await fetch(base+'/chapters/1?limit=2');assert.equal(publicResult.status,200);
        const body=await publicResult.json() as any;assert.equal(body.data.verses.length,2);assert.equal(body.data.verses[0].text,warshVerse('1:1').text);
        assert.equal((await fetch(base+'/chapters/115')).status,400);
        const privateResult=await fetch(base+'/reader-state');assert.equal(privateResult.status,401);assert.equal(privateResult.headers.get('cache-control'),'private, no-store');
        env.WARSH_TEXT_APPROVED=false;assert.equal((await fetch(base+'/chapters')).status,503);env.WARSH_TEXT_APPROVED=true;
        console.log('Warsh HTTP text fidelity, pagination, validation, authentication, private caching and release-gate checks passed.');
      } finally {await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
    }
    console.log('Warsh source, release gate, numbering and goal checks passed.');
    if (process.env.WARSH_TEST_DB !== 'true') return;
    const transaction = prisma.$transaction.bind(prisma);
    const oldQuery = prisma.$queryRaw; const oldExecute = prisma.$executeRaw; const oldFind = prisma.user.findUnique;
    const schema = `warsh_test_${randomUUID().replaceAll('-','')}`;
    const rollback = new Error('EXPECTED_TEST_ROLLBACK');
    const userId='isolated-owner'; const otherId='isolated-other';
    try {
      await transaction(async tx => {
        // Identifier is exclusively a locally generated UUID, never user input.
        await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
        await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
        await tx.$executeRawUnsafe('CREATE TABLE "users" ("id" TEXT PRIMARY KEY)');
        await tx.$executeRaw`INSERT INTO "users" ("id") VALUES (${userId}),(${otherId})`;
        const sql = readFileSync('prisma/migrations/20261010120000_warsh_verse_reader/migration.sql','utf8');
        for (const statement of sql.split(';').map(v=>v.trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement);
        (prisma as any).$queryRaw=tx.$queryRaw.bind(tx);
        (prisma as any).$executeRaw=tx.$executeRaw.bind(tx);
        (prisma as any).$transaction=async (fn:any)=>fn(tx);
        (prisma.user as any).findUnique=async()=>({timezone:'Africa/Cairo'});
        const initial=await getWarshPosition(userId); assert.equal(initial.revision,0);
        const position={contentVersion:WARSH_CONTENT_VERSION,verseKey:'1:2',revision:0};
        assert.equal((await setWarshPosition(userId,position)).revision,1);
        assert.equal((await setWarshPosition(userId,position)).revision,1);
        await assert.rejects(setWarshPosition(userId,{...position,verseKey:'1:3'}),(e:any)=>e.statusCode===409);
        assert.equal((await getWarshPosition(otherId)).revision,0);
        const mark={contentVersion:WARSH_CONTENT_VERSION,verseKey:'1:1',note:'private',saved:true};
        await setWarshBookmark(userId,mark); await setWarshBookmark(userId,mark);
        assert.equal((await getWarshBookmarks(userId,0,50)).items.length,1);
        assert.equal((await getWarshBookmarks(otherId,0,50)).items.length,0);
        assert.equal((await getWarshBookmarks(userId,0,1)).nextAfterOrdinal,null);
        const input={contentVersion:WARSH_CONTENT_VERSION,requestKey:randomUUID(),expectedCycleId:null,durationDays:30};
        const started=await startWarshCycle(userId,input); const id=started.cycle!.cycleId;
        assert.equal((await startWarshCycle(userId,input)).cycle!.cycleId,id);
        await assert.rejects(startWarshCycle(userId,{...input,durationDays:20}),(e:any)=>e.statusCode===409);
        await assert.rejects(getWarshCycle(otherId,id),(e:any)=>e.statusCode===404);
        const completion={contentVersion:WARSH_CONTENT_VERSION,verseKeys:['1:1','1:2'],completed:true,date:started.cycle!.dailyGoal.date};
        assert.equal((await setWarshCompletions(userId,id,completion)).cycle!.completedVerses,2);
        assert.equal((await setWarshCompletions(userId,id,completion)).cycle!.completedVerses,2);
        assert.equal((await setWarshCompletions(userId,id,{...completion,verseKeys:['1:1'],completed:false})).cycle!.completedVerses,1);
        await assert.rejects(setWarshCompletions(userId,id,{...completion,date:'2000-01-01'}),(e:any)=>e.statusCode===409);
        const restart={...input,requestKey:randomUUID(),expectedCycleId:id};
        const restarted=await startWarshCycle(userId,restart);
        assert.notEqual(restarted.cycle!.cycleId,id); assert.equal(restarted.cycle!.completedVerses,0);
        assert.equal((await getWarshCycle(userId,id)).cycle!.active,false);
        assert.equal((await getWarshCycle(userId,id)).cycle!.completedVerses,1);
        assert.equal((await startWarshCycle(userId,input)).cycle!.active,false);
        assert.equal((await getWarshCycle(userId)).cycle!.cycleId,restarted.cycle!.cycleId);
        await assert.rejects(setWarshCompletions(userId,id,completion),(e:any)=>e.statusCode===409);
        await tx.$executeRaw`DELETE FROM "users" WHERE "id"=${userId}`;
        const counts=await tx.$queryRaw<Array<{n:number}>>`SELECT COUNT(*)::int AS n FROM "warsh_completions"`;
        assert.equal(counts[0]!.n,0);
        console.log('Real PostgreSQL migration, ownership, retries, revisions, cycle restart, unique completion and cascade checks passed in isolated schema.');
        throw rollback;
      },{timeout:30000,maxWait:10000});
    } catch(e) {if(e!==rollback)throw e; console.log('Test schema and all test writes rolled back. No production tables accessed.');}
    finally {(prisma as any).$queryRaw=oldQuery;(prisma as any).$executeRaw=oldExecute;(prisma as any).$transaction=transaction;(prisma.user as any).findUnique=oldFind;}
    const absent=await prisma.$queryRaw<Array<{exists:boolean}>>`SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname=${schema}) AS "exists"`;
    assert.equal(absent[0]!.exists,false);
    console.log('Confirmed the temporary schema no longer exists.');
  } finally {env.WARSH_TEXT_APPROVED=approval; await prisma.$disconnect();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
