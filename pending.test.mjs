import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
const stored = new Map();
const context = vm.createContext({ console, Date, Math, Intl, document: { addEventListener() {} }, window: {}, localStorage: { getItem: k => stored.get(k), setItem: (k,v) => stored.set(k,v), removeItem: k => stored.delete(k) } });
vm.runInContext(fs.readFileSync(new URL('./app.js',import.meta.url),'utf8'), context);
const stamp = '2026-09-08T10:00:00.000Z';
const base = context.normalizePendingTask({id:'plan',task:'UNI',description:'Revisar',startDate:'2026-09-01',dueDate:'2026-09-03',createdAt:stamp,updatedAt:stamp});
assert.equal(context.pendingOverdueDays(base,'2026-09-08'),5);
assert.equal(context.pendingOverdueDays({...base,completedAt:stamp},'2026-09-08'),0);
assert.equal(context.pendingOverdueDays({...base,dueDate:''},'2026-09-08'),0);
assert.equal(context.pendingDaysBetween('2026-03-28','2026-03-30'),2);
const list = [{...base,id:'none',startDate:''},{...base,id:'later',startDate:'2026-09-06'},{...base,id:'early',startDate:'2026-09-01'}].sort(context.comparePendingTasks);
assert.deepEqual(list.map(x=>x.id),['early','later','none']);
for (const [repeat, expected] of [['daily','2026-09-09'],['weekly','2026-09-15'],['monthly','2026-10-01'],['yearly','2027-09-01']]) {
  const next=context.nextPendingOccurrence({...base,repeat},'2026-09-08',stamp); assert.equal(next.startDate,expected);
  assert.equal(next.completedAt,''); assert.equal(next.description,'Revisar');
}
const jan=context.normalizePendingTask({...base,startDate:'2026-01-31',dueDate:'',anchorStart:'2026-01-31',anchorDue:'',repeat:'monthly'});
const feb=context.nextPendingOccurrence(jan,'2026-01-31',stamp);
assert.equal(feb.startDate,'2026-02-28');
assert.equal(context.nextPendingOccurrence(feb,'2026-02-28',stamp).startDate,'2026-03-31');
const leap=context.normalizePendingTask({...jan,startDate:'2024-02-29',anchorStart:'2024-02-29',repeat:'yearly'});
assert.equal(context.nextPendingOccurrence(leap,'2027-03-01',stamp).startDate,'2028-02-29');
const dueOnly=context.nextPendingOccurrence({...base,startDate:'',anchorStart:'',repeat:'weekly'},'2026-09-08',stamp);
assert.equal(dueOnly.startDate,''); assert.equal(dueOnly.dueDate,'2026-09-10');
assert.equal(context.nextPendingOccurrence({...base,startDate:'',dueDate:'',anchorStart:'',anchorDue:'',repeat:'daily'},'2026-09-08',stamp),null);
assert.equal(context.pendingDate('2026-02-30'),'');
const deleted={...base,deletedAt:'2026-09-09T10:00:00Z',updatedAt:'2026-09-09T10:00:00Z'};
assert.ok(context.mergePendingTasks([deleted],[base])[0].deletedAt);
context.testPending=base;
vm.runInContext('state.pendingTasks=[testPending]; persistPendingTasks()',context);
assert.equal(context.loadPendingTasks()[0].description,'Revisar');
assert.equal(context.buildSyncPayload().pendingTasks[0].id,'plan');
const signature=context.getSyncDataSignature();
vm.runInContext('state.pendingTasks[0].notes="Cambio"',context);
assert.notEqual(context.getSyncDataSignature(),signature);
assert.equal(context.normalizeEntry({id:'session',pendingId:'plan',date:'2026-09-08',task:'UNI',start:'10:00',end:'11:00'}).pendingId,'plan');
let cloud=null;
const server=vm.createContext({ console, Date, Math, Request, Response, createHash, getStore: () => ({get:async()=>cloud,setJSON:async(k,v)=>{cloud=JSON.parse(JSON.stringify(v));}}) });
let source=fs.readFileSync(new URL('./netlify/functions/sync.mjs',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace('export default async','const handler = async').replace('export const config','const config');
vm.runInContext(source,server);
assert.equal(JSON.stringify(server.normalizePendingTask(base)),JSON.stringify(context.normalizePendingTask(base)));
const handler=vm.runInContext('handler',server);
async function sync(payload){const res=await handler(new Request('http://local/api/sync',{method:'POST',body:JSON.stringify({syncKey:'isolated-unit-test',...payload})}));assert.equal(res.status,200);return res.json();}
let result=await sync({pendingTasks:[base],entries:[]});assert.equal(result.pendingTasks.length,1);
result=await sync({entries:[]});assert.equal(result.pendingTasks[0].id,'plan'); // older client
result=await sync({mode:'replace',entries:[]});assert.equal(result.pendingTasks[0].id,'plan'); // old backup preserves pending tasks
result=await sync({pendingTasks:[deleted],entries:[],clientLastSyncedAt:'2099-01-01T00:00:00Z'});assert.ok(result.pendingTasks[0].deletedAt);
result=await sync({pendingTasks:[base],entries:[],clientLastSyncedAt:'2099-01-01T00:00:00Z'});assert.ok(result.pendingTasks[0].deletedAt);
const entry={id:'session',pendingId:'plan',date:'2026-09-08',task:'UNI',start:'10:00',end:'11:00',createdAt:stamp,updatedAt:stamp};
assert.equal(server.mergeEntryValues(entry,{...entry,pendingId:'',updatedAt:'2026-09-09T10:00:00Z'}).pendingId,'plan');
// An old occurrence cannot overwrite its next occurrence; IDs are deterministic across devices.
const one=context.nextPendingOccurrence({...base,repeat:'daily'},'2026-09-08',stamp);
const two=context.nextPendingOccurrence({...base,repeat:'daily'},'2026-09-08',stamp);
assert.equal(context.mergePendingTasks([one],[two]).length,1);
// Backup contains the pending tasks and links, including backups with zero time entries.
context.downloadText=(name,text)=>{context.backup=JSON.parse(text)};
context.exportJson();assert.equal(context.backup.pendingTasks[0].id,'plan');
console.log('Pendientes: fechas, repetición, enlaces, backup y sincronización superados.');
// Session lifecycle from pending tasks, isolated from the DOM and real storage.
vm.runInContext(fs.readFileSync(new URL('./pending.js',import.meta.url),'utf8'),context);
vm.runInContext(`render=()=>{}; renderPending=()=>{}; setView=()=>{}; scheduleAutoSync=()=>{}; pendingMessage=()=>{};
state.entries=[]; state.pendingTasks=[normalizePendingTask(testPending)]; state.tracking.allowSimultaneous=false;`,context);
context.startPendingNow(base);
assert.equal(vm.runInContext('state.entries.length',context),1);
assert.equal(vm.runInContext('state.entries[0].pendingId',context),'plan');
context.startPendingNow(base);
assert.equal(vm.runInContext('state.entries.length',context),1); // repeated click never duplicates
vm.runInContext('pauseTrackedEntry(state.entries[0].id)',context);
context.startPendingNow(base);
assert.equal(vm.runInContext('state.entries.length',context),1);
assert.equal(vm.runInContext('state.entries[0].segments.length',context),2);
context.startPendingNow({...base,id:'other'});
assert.equal(vm.runInContext('state.entries.filter(e=>e.status==="active").length',context),1);
assert.equal(vm.runInContext('state.entries[0].status',context),'paused');
context.pendingAction({target:{closest:()=>({dataset:{pendingAction:'complete'},closest:()=>({dataset:{pendingId:'plan'}})})}});
assert.equal(vm.runInContext('state.entries[0].status',context),'completed');
assert.ok(vm.runInContext('state.pendingTasks[0].completedAt',context));
vm.runInContext('state.tracking.allowSimultaneous=true',context);
context.startPendingNow({...base,id:'third'});
assert.equal(vm.runInContext('state.entries.filter(e=>e.status==="active").length',context),2);
console.log('Inicio, reanudación, finalización y tareas simultáneas verificados.');
const replaced = server.replaceStore({entries:[{...entry,pendingId:''}]},{entries:[entry],pendingTasks:[base]});
assert.equal(replaced.entries[0].pendingId,'plan');
assert.equal(replaced.pendingTasks[0].id,'plan');
