'use strict';
const assert=require('node:assert/strict');const test=require('node:test');const crypto=require('node:crypto');require('../daily-simulation/news-storage.js');
function fetcher(files){return async path=>Object.hasOwn(files,path)?{ok:true,json:async()=>files[path],text:async()=>JSON.stringify(files[path])}:{ok:false,status:404};}
const records=[{id:'original-id',title:'內容'}];const shard={schemaVersion:1,documents:records};const file='news-shards/'+crypto.createHash('sha256').update(JSON.stringify(shard)).digest('hex')+'.json';
test('existing single file is readable',async()=>assert.deepEqual((await NewsStorage.load(fetcher({'./documents.json':{schemaVersion:1,documents:records}}))).documents,records));
test('sharded archive preserves original IDs and metadata',async()=>{const files={'./documents.json':{schemaVersion:2,count:1,sync:{status:'success'},shards:[{path:file,count:1}]},['./'+file]:shard};assert.deepEqual((await NewsStorage.load(fetcher(files))).documents,records)});
test('missing shard rejects the whole archive',async()=>await assert.rejects(NewsStorage.load(fetcher({'./documents.json':{schemaVersion:2,count:1,shards:[{path:file,count:1}]}}))));
test('duplicate IDs reject the archive',async()=>{const dup={schemaVersion:1,documents:[records[0],records[0]]},p='news-shards/'+crypto.createHash('sha256').update(JSON.stringify(dup)).digest('hex')+'.json';await assert.rejects(NewsStorage.load(fetcher({'./documents.json':{schemaVersion:2,count:2,shards:[{path:p,count:2}]},['./'+p]:dup})));});
test('untrusted shard paths rejected',async()=>await assert.rejects(NewsStorage.load(fetcher({'./documents.json':{schemaVersion:2,count:1,shards:[{path:'https://evil.example/data.json',count:1}]}}))));
