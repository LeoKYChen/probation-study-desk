'use strict';
// Offline prerequisite: detect corrupted/duplicated rules files immediately,
// even if Java/npm/Firebase emulator is unavailable. Not a Rules compiler.
// Emulator tests remain mandatory before actual Firebase deployment.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const file=path.resolve(__dirname,'../../firestore.rules');
const rules=fs.readFileSync(file,'utf8');
function count(pattern){return [...rules.matchAll(pattern)].length}
assert.equal(count(/\brules_version\s*=/g),1,'exactly one rules_version');
assert.equal(count(/\bservice\s+cloud\.firestore\b/g),1,'exactly one Firestore service');
assert.equal(count(/match \/databases\/\{database\}\/documents/g),1,'exactly one Firestore database scope');
for(const scope of ['modules/{moduleId}','desk/{recordId}'])
 assert.equal(rules.split('match /users/{uid}/'+scope+' {').length-1,1,'exactly one user collection: '+scope);
assert.equal(count(/function\s+owns\s*\(/g),1,'exactly one authentication helper');
assert.equal(count(/function\s+validRecordId\s*\(/g),1,'exactly one document id helper');
assert.equal(count(/function\s+validModuleId\s*\(/g),1,'exactly one module allowlist helper');
assert.equal(count(/function\s+validSyncDocument\s*\(/g),1,'exactly one payload helper');
assert.equal(count(/allow delete:\s*if false;/g),2,'disable deletion for both collections');
assert.equal(count(/allow read:\s*if owns\(uid\);/g),2,'only owner may read collections');
assert.equal(count(/allow create:\s*if owns\(uid\) && validRecordId\(/g),1,'desk create requires canonical ID');
assert.equal(count(/allow update:\s*if owns\(uid\) && validRecordId\(/g),1,'desk update requires canonical ID');
assert.equal(count(/allow create:\s*if owns\(uid\) && validModuleId\(/g),1,'modules create require allowlist');
assert.equal(count(/allow update:\s*if owns\(uid\) && validModuleId\(/g),1,'modules update require allowlist');
const unified=require('../../backup/unified-core.js');
const allowed=[...unified.modules.map(x=>x.key),unified.CONFLICT_KEY];
assert.equal(allowed.length,16,'expected 15 modules and one conflict archive');
for(const key of allowed)assert(rules.includes("'k~"+encodeURIComponent(key)+"'"),'missing cloud allowlist key: '+key);
assert.equal((rules.match(/'k~[^']+'/g)||[]).length,16,'no extra cloud module IDs');
assert(rules.includes("request.resource.data.keys().hasOnly(['raw', 'revision', 'updatedAt'])"),
 'reject unexpected Firestore fields');
assert(rules.includes('request.resource.data.updatedAt == request.time'),'use server timestamp');
assert(rules.includes('request.resource.data.revision == resource.data.revision + 1'),'require CAS increments');
assert(rules.includes('id.matches("^k~('),'canonical document id pattern missing');
assert(!/\ballow\s+(read|write|create|update)\s*:\s*if\s*true\b/.test(rules),'public access forbidden');
assert.equal(count(/match \/\{any=\*\*\}/g),1,'exactly one fallback deny');
assert(rules.includes('allow read, write: if false;'),'fallback must deny');
const open=(rules.match(/\{/g)||[]).length,close=(rules.match(/\}/g)||[]).length;
assert.equal(open,close,'unbalanced Firestore block delimiters');
// These assertions do not parse every rules expression. Actual syntax and
// authorization MUST also pass the Firebase emulator integration tests.
console.log('PASS Firebase rules structural guard: no duplicated or incomplete authorization blocks');
