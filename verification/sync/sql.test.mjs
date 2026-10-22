import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(process.env.PSD_SYNC_TEST_MODULES?pathToFileURL(process.env.PSD_SYNC_TEST_MODULES+'/@electric-sql/pglite/dist/index.js'):'@electric-sql/pglite');
test('real PostgreSQL RPC: CAS, replay, pagination, ownership and anonymous denial',async()=>{
 const db=new PGlite();
 try {
 await db.exec("create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;");
 await db.exec(await readFile(new URL('../../cloud-sync/schema.sql',import.meta.url),'utf8'));
 const alice='11111111-1111-4111-8111-111111111111',bob='22222222-2222-4222-8222-222222222222';
 await db.query('insert into auth.users values($1),($2)',[alice,bob]);
 async function as(user,fn){await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);try{return await fn();}finally{await db.exec('reset role');}}
 const push=op=>db.query('select public.psd_sync_push($1::jsonb) as result',[JSON.stringify(op)]).then(x=>x.rows[0].result);
 const pull=cursor=>db.query('select public.psd_sync_pull($1) as result',[cursor]).then(x=>x.rows[0].result);
 const op={id:'attempt/one',opId:crypto.randomUUID(),baseRevision:0,value:{answer:'私有答案'},deleted:false};
 const first=await as(alice,()=>push(op));assert.equal(first.status,'ok');assert.equal(first.record.revision,1);
 assert.deepEqual(await as(alice,()=>push(op)),first);
 await assert.rejects(as(alice,()=>push({...op,value:{answer:'reused'}})),/reused/);
 const conflict=await as(alice,()=>push({...op,opId:crypto.randomUUID(),value:{answer:'另一裝置'}}));assert.equal(conflict.status,'conflict');assert.equal(conflict.record.value.answer,'私有答案');
 assert.equal((await as(alice,()=>pull(0))).changes.length,1);
 assert.deepEqual((await as(bob,()=>pull(0))).changes,[]);
 const b=await as(bob,()=>push({...op,value:{answer:'Bob'}}));assert.equal(b.status,'ok');assert.equal(b.record.value.answer,'Bob');
 assert.equal((await as(alice,()=>pull(0))).changes[0].value.answer,'私有答案');
 await as(alice,async()=>{await assert.rejects(db.query('select * from psd_private.records'),/permission denied/);await assert.rejects(push({...op,id:'bad id',opId:crypto.randomUUID()}),/invalid operation/);});
 await db.exec('set role anon');await assert.rejects(db.query('select public.psd_sync_pull(0)'),/permission denied/);await db.exec('reset role');
 await as(alice,()=>db.query("select set_config('request.jwt.claim.sub','',false)").then(()=>pull(0))).then(()=>assert.fail('missing identity accepted'),e=>assert.match(e.message,/authentication required/));
 // Large page: per-account event counters and incremental retrieval.
 await as(alice,async()=>{for(let i=0;i<201;i++)await push({id:'attempt/'+i,opId:crypto.randomUUID(),baseRevision:0,value:{i},deleted:false});});
 const page=await as(alice,()=>pull(0));assert.equal(page.changes.length,200);assert.equal(page.more,true);
 const last=page.changes.at(-1).sequence,tail=await as(alice,()=>pull(last));assert.equal(tail.changes.length,2);assert.equal(tail.more,false);
 console.log('SQL migration executed in embedded PostgreSQL; production Auth/API still requires real service validation.');
 } finally {await db.close();}
});
