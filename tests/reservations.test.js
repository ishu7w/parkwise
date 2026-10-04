import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,holdBay,allocate,addVehicle,checkInHold,cancelHold,toggleBayBlock,availableSlots,cancelArrival,sampleWorkspace,migrate} from '../src/domain/parking.js';
test('holds and maintenance exclude bays; check-in uses the held bay',()=>{
 let s=holdBay(initial(),{name:'Visitor',vehicleNumber:'TEST123',slot:'A1'});
 s=toggleBayBlock(s,'A2');
 assert.throws(()=>addVehicle(s,'TEST-123'),/active visit/);
 assert.throws(()=>toggleBayBlock(s,'A1'),/empty/);
 s=allocate(addVehicle(s,'OTHER123'));assert.equal(s.processes[0].assignedSlot,'A3');
 s=checkInHold(s,s.reservations[0].id);assert.equal(s.processes.at(-1).assignedSlot,'A1');
 assert.throws(()=>checkInHold(s,s.reservations[0].id),/no longer active/);
 assert.deepEqual(migrate(s).blockedSlots,['A2']);
});
test('cancellation and reopening release capacity and preserve records',()=>{
 let s=holdBay(initial(),{name:'Visitor',vehicleNumber:'TEST123',slot:'B1'});
 s=cancelHold(s,s.reservations[0].id);assert.ok(availableSlots(s).includes('B1'));
 s=toggleBayBlock(toggleBayBlock(s,'A1'),'A1');assert.ok(availableSlots(s).includes('A1'));
 s=addVehicle(s,'TEST123');s=cancelArrival(s,s.processes[0].pid);assert.equal(s.processes[0].cancelled,true);
 assert.throws(()=>holdBay(s,{name:'Visitor',vehicleNumber:'OTHER123',slot:'C4'}),/Reserved/);
});
test('sample workspace has coherent capacity and survives reload',()=>{
 const s=migrate(sampleWorkspace());assert.equal(s.processes.filter(p=>p.assignedSlot).length,4);assert.equal(availableSlots(s).length,6);
 assert.throws(()=>migrate({...s,blockedSlots:['A1']}),/Conflicting/);
});
