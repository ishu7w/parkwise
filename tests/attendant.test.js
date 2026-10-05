import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,addVehicle,holdBay,availableSlots,checkInHold,expireHolds,allocationAdvice,allocate,operationsSummary,restoreBackup,exitVehicle} from '../src/domain/parking.js';
test('expired holds release capacity even before the refresh timer runs',()=>{
 let s=holdBay(initial(),{name:'Visitor',vehicleNumber:'EXPIRE123',slot:'A1',holdMinutes:15});
 s.reservations[0].expiresAt=new Date(Date.now()-1000).toISOString();
 assert.ok(availableSlots(s).includes('A1'));assert.throws(()=>checkInHold(s,s.reservations[0].id),/no longer active/);
 s=allocate(addVehicle(s,'ARRIVE123'));assert.equal(s.processes[0].assignedSlot,'A1');
 s=expireHolds(s);assert.equal(s.reservations[0].status,'expired');assert.equal(expireHolds(s),s);
});
test('balanced allocation ages the queue and always gives emergency first rank',()=>{
 const now=Date.now();let s=addVehicle(addVehicle(initial(),'LONGWAIT',4),'ACCESS123',2);
 s.processes[0].arrivedAt=new Date(now-30*60000).toISOString();
 assert.equal(allocationAdvice(s,'Priority first',now).vehicle.vehicleNumber,'ACCESS123');
 assert.equal(allocationAdvice(s,'Balanced priority',now).vehicle.vehicleNumber,'LONGWAIT');
 s=addVehicle(s,'EMERGENCY',1);assert.equal(allocationAdvice(s,'Balanced priority',now).vehicle.vehicleNumber,'EMERGENCY');
});
test('operations report ignores cancelled visits and reports actual stay',()=>{
 let s=allocate(addVehicle(initial(),'REPORT123'));const now=Date.now();s.processes[0].parkedAt=new Date(now-25*60000).toISOString();s=exitVehicle(s,s.processes[0].pid);
 const report=operationsSummary(s);assert.equal(report.arrivals,1);assert.equal(report.departures,1);assert.equal(report.averageStay,25);assert.equal(report.longestWait,null);
});
test('backup recovery validates counters, duplicate plates and dates',()=>{
 const wrap=state=>({format:'parkwise-backup-v1',state});const s=addVehicle(initial(),'BACKUP123');assert.equal(restoreBackup(wrap(s)).processes.length,1);
 assert.throws(()=>restoreBackup(wrap({...s,nextId:101})),/counter/);
 assert.throws(()=>restoreBackup(wrap({...s,processes:[...s.processes,{...s.processes[0],pid:'V200'}],nextId:201})),/duplicate active/);
 assert.throws(()=>restoreBackup(wrap({...s,processes:[{...s.processes[0],arrivedAt:'bad'}]})),/timestamp/);
 assert.throws(()=>restoreBackup({state:s}),/Parkwise/);
});
