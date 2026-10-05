export const slots=Array.from({length:12},(_,i)=>`${'ABC'[Math.floor(i/4)]}${i%4+1}`);
export const initial=()=>({processes:[],nextId:101,logs:[],reservations:[],blockedSlots:[]});
const stamp=()=>new Date().toISOString();
export const activeHold=(r,now=Date.now())=>r.status==='held'&&(!r.expiresAt||Date.parse(r.expiresAt)>now);
const plateKey=value=>value.replace(/[ -]/g,'').toUpperCase();
function event(state,message,at){return {...state,logs:[{message,at},...state.logs].slice(0,1000)}}
export function migrate(value){
 if(!value||!Array.isArray(value.processes)||!Array.isArray(value.logs)||!Number.isInteger(value.nextId)||value.nextId<101||value.logs.some(l=>!l||typeof l.message!=='string'&&typeof l.time!=='number'))throw Error('Invalid saved workspace');
 if(value.logs.some(l=>l.at&&!Number.isFinite(Date.parse(l.at))))throw Error('Invalid activity timestamp');
 const ids=new Set(),bays=new Set();
 for(const p of value.processes){if(typeof p.pid!=='string'||ids.has(p.pid)||typeof p.vehicleNumber!=='string'||![1,2,3,4].includes(p.priority)||!['NEW','READY','RUNNING','WAITING','TERMINATED'].includes(p.state))throw Error('Invalid saved vehicle');for(const field of ['arrivedAt','parkedAt','exitedAt'])if(p[field]&&!Number.isFinite(Date.parse(p[field])))throw Error('Invalid visit timestamp');ids.add(p.pid);if(p.assignedSlot){if(!slots.includes(p.assignedSlot)||bays.has(p.assignedSlot))throw Error('Invalid saved bay');bays.add(p.assignedSlot)}}
 const reservations=value.reservations||[],blockedSlots=value.blockedSlots||[];
 if(!Array.isArray(reservations)||!Array.isArray(blockedSlots)||blockedSlots.some(s=>!slots.includes(s))||new Set(blockedSlots).size!==blockedSlots.length)throw Error('Invalid saved capacity');
 const reservationIds=new Set();
 for(const r of reservations){
  if(typeof r.id!=='string'||reservationIds.has(r.id)||typeof r.vehicleNumber!=='string'||typeof r.name!=='string'||!slots.includes(r.slot)||!['held','checked-in','cancelled','expired'].includes(r.status)||![1,2,3,4].includes(r.priority))throw Error('Invalid saved reservation');
  if(r.expiresAt&&!Number.isFinite(Date.parse(r.expiresAt)))throw Error('Invalid reservation expiry');
  reservationIds.add(r.id);
  if(activeHold(r)){if(bays.has(r.slot)||blockedSlots.includes(r.slot))throw Error('Conflicting saved reservation');bays.add(r.slot)}
 }
 if(blockedSlots.some(s=>bays.has(s)))throw Error('Conflicting saved maintenance block');
 return {...value,reservations,blockedSlots,processes:value.processes.map(p=>({...p,arrivedAt:p.arrivedAt||null,parkedAt:p.parkedAt||null,exitedAt:p.exitedAt||null})),logs:value.logs.map(l=>l.at?l:{message:'Earlier workspace activity · time unavailable',at:null})};
}
export function addVehicle(state,number,priority=4){
 const vehicleNumber=number.trim().toUpperCase();
 if(!/^[A-Z0-9 -]{3,15}$/.test(vehicleNumber))throw Error('Enter a plate with 3–15 letters, numbers, spaces or hyphens.');
 if(![1,2,3,4].includes(priority))throw Error('Choose a valid vehicle category.');
 if(state.processes.some(p=>p.state!=='TERMINATED'&&plateKey(p.vehicleNumber)===plateKey(vehicleNumber))||(state.reservations||[]).some(r=>activeHold(r)&&plateKey(r.vehicleNumber)===plateKey(vehicleNumber)))throw Error('This vehicle already has an active visit.');
 const at=stamp();const p={pid:`V${state.nextId}`,vehicleNumber,priority,state:'READY',assignedSlot:null,arrivedAt:at,parkedAt:null,exitedAt:null};
 return event({...state,nextId:state.nextId+1,processes:[...state.processes,p]},`${vehicleNumber} added to the arrival queue`,at);
}
export function allocationAdvice(state,policy='Arrival order',now=Date.now()){
 const ready=state.processes.filter(p=>['READY','WAITING'].includes(p.state));
 if(!ready.length)return {vehicle:null,bay:null,reason:'The arrival queue is clear.'};
 const waited=p=>p.arrivedAt?Math.max(0,(now-Date.parse(p.arrivedAt))/60000):0;
 if(policy==='Priority first')ready.sort((a,b)=>a.priority-b.priority);
 if(policy==='Balanced priority')ready.sort((a,b)=>{
  const score=p=>p.priority===1?0:Math.max(1,p.priority-1-Math.floor(waited(p)/10));
  return score(a)-score(b)||Date.parse(a.arrivedAt||0)-Date.parse(b.arrivedAt||0);
 });
 const used=new Set([...state.processes.map(p=>p.assignedSlot),...(state.blockedSlots||[]),...(state.reservations||[]).filter(r=>activeHold(r,now)).map(r=>r.slot)]);
 for(const p of ready){const eligible=p.priority===3?['C4',...slots.filter(s=>s!=='C4')]:slots.filter(s=>s!=='C4');const bay=eligible.find(s=>!used.has(s));if(bay)return {vehicle:p,bay,reason:policy==='Balanced priority'?'Emergency vehicles go first; every 10 minutes of waiting improves other vehicles’ queue rank.':policy==='Priority first'?'Selected by category priority; equal categories keep arrival order.':'Selected by arrival order among vehicles with an eligible bay.'};}
 return {vehicle:null,bay:null,reason:'No eligible bay is free. Release a parked vehicle, unused hold or maintenance block.'};
}
export function allocate(state,policy='Arrival order'){
 const {vehicle:selected,bay,reason}=allocationAdvice(state,policy);
 if(!selected)throw Error(reason);
 const at=stamp();return event({...state,processes:state.processes.map(p=>p.pid===selected.pid?{...p,state:'RUNNING',assignedSlot:bay,parkedAt:at}:p)},`${selected.vehicleNumber} parked in ${bay}`,at);
}
export function exitVehicle(state,id){
 const p=state.processes.find(p=>p.pid===id);if(!p?.assignedSlot)throw Error('This vehicle is not currently parked.');
 const at=stamp();return event({...state,processes:state.processes.map(v=>v.pid===id?{...v,state:'TERMINATED',lastSlot:v.assignedSlot,assignedSlot:null,exitedAt:at}:v)},`${p.vehicleNumber} checked out of ${p.assignedSlot}`,at);
}
export const displayTime=value=>value?new Date(value).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}):'Not recorded';

export function bayStatus(state,slot){
 const vehicle=state.processes.find(p=>p.assignedSlot===slot);
 if(vehicle)return {kind:'occupied',vehicle};
 const reservation=(state.reservations||[]).find(r=>activeHold(r)&&r.slot===slot);
 if(reservation)return {kind:'held',reservation};
 if((state.blockedSlots||[]).includes(slot))return {kind:'blocked'};
 return {kind:slot==='C4'?'reserved':'available'};
}
export function availableSlots(state){return slots.filter(s=>['available','reserved'].includes(bayStatus(state,s).kind))}
export function holdBay(state,{vehicleNumber,name,slot,priority=4,holdMinutes=30}){
 const clean=vehicleNumber.trim().toUpperCase();
 if(![15,30,60,120].includes(holdMinutes))throw Error('Choose a hold duration of 15, 30, 60 or 120 minutes.');
 if(!name.trim()||name.trim().length>60)throw Error('Enter a visitor name (up to 60 characters).');
 if(!slots.includes(slot)||!availableSlots(state).includes(slot))throw Error('This bay is no longer available.');
 if(slot==='C4'&&priority!==3)throw Error('Choose the Reserved category to hold C4.');
 addVehicle(state,clean,priority); // Reuse plate, category and duplicate validation without creating a visit.
 const at=stamp(),id=`R${state.nextId}`;
 return event({...state,nextId:state.nextId+1,reservations:[{id,vehicleNumber:clean,name:name.trim(),slot,priority,status:'held',createdAt:at,expiresAt:new Date(Date.parse(at)+holdMinutes*60000).toISOString()},...(state.reservations||[])]},`${slot} held for ${name.trim()} · ${clean}`,at);
}
export function cancelHold(state,id){
 const r=(state.reservations||[]).find(r=>r.id===id);if(!r||!activeHold(r))throw Error('This reservation is no longer active.');
 return event({...state,reservations:state.reservations.map(r=>r.id===id?{...r,status:'cancelled'}:r)},`Reservation ${id} cancelled · ${r.slot} released`,stamp());
}
export function checkInHold(state,id){
 const r=(state.reservations||[]).find(r=>r.id===id);if(!r||!activeHold(r))throw Error('This reservation is no longer active.');
 if(state.processes.some(p=>p.assignedSlot===r.slot)||(state.blockedSlots||[]).includes(r.slot))throw Error('The reserved bay is unavailable.');
 let next={...state,reservations:state.reservations.map(r=>r.id===id?{...r,status:'checked-in'}:r)};
 next=addVehicle(next,r.vehicleNumber,r.priority);const p=next.processes.at(-1),at=stamp();
 return event({...next,processes:next.processes.map(v=>v.pid===p.pid?{...v,state:'RUNNING',assignedSlot:r.slot,parkedAt:at,reservationId:id}:v)},`${r.vehicleNumber} checked in to reserved bay ${r.slot}`,at);
}
export function toggleBayBlock(state,slot){
 if(!slots.includes(slot))throw Error('Unknown bay.');
 const blocked=state.blockedSlots||[],wasBlocked=blocked.includes(slot);
 if(!wasBlocked&&!availableSlots(state).includes(slot))throw Error('Only an empty, unheld bay can be blocked.');
 return event({...state,blockedSlots:wasBlocked?blocked.filter(s=>s!==slot):[...blocked,slot]},`${slot} ${wasBlocked?'reopened':'blocked for maintenance'}`,stamp());
}
export function cancelArrival(state,id){
 const p=state.processes.find(p=>p.pid===id);if(!p||!['READY','WAITING'].includes(p.state))throw Error('Only a queued visit can be cancelled.');
 const at=stamp();return event({...state,processes:state.processes.map(v=>v.pid===id?{...v,state:'TERMINATED',cancelled:true,exitedAt:at}:v)},`${p.vehicleNumber} removed from arrival queue`,at);
}
export function sampleWorkspace(){
 let state=initial();
 for(const [plate,category] of [['MH12 AB4821',4],['KA03 MN9012',2],['DL01 CX7740',4],['MH14 EV2208',4]]){state=allocate(addVehicle(state,plate,category))}
 state=addVehicle(state,'GJ05 RD6132',4);state=addVehicle(state,'MH12 PQ8091',1);
 state=holdBay(state,{vehicleNumber:'KA01 EE4521',name:'Aarav Shah',slot:'B3',priority:4});
 return toggleBayBlock(state,'C2');
}

export function expireHolds(state,now=Date.now()){
 const expired=(state.reservations||[]).filter(r=>r.status==='held'&&r.expiresAt&&Date.parse(r.expiresAt)<=now);
 if(!expired.length)return state;
 const ids=new Set(expired.map(r=>r.id));
 return event({...state,reservations:state.reservations.map(r=>ids.has(r.id)?{...r,status:'expired'}:r)},`${expired.length} visitor hold(s) expired · bays released`,new Date(now).toISOString());
}
export function operationsSummary(state,now=Date.now()){
 const today=new Date(now).toLocaleDateString(),sameDay=v=>v&&new Date(v).toLocaleDateString()===today;
 const waiting=state.processes.filter(p=>['READY','WAITING'].includes(p.state));
 const waits=waiting.map(p=>p.arrivedAt?Math.max(0,Math.floor((now-Date.parse(p.arrivedAt))/60000)):null).filter(x=>x!==null);
 const departed=state.processes.filter(p=>p.state==='TERMINATED'&&!p.cancelled&&sameDay(p.exitedAt));
 const durations=departed.filter(p=>p.parkedAt).map(p=>Math.max(0,Math.round((Date.parse(p.exitedAt)-Date.parse(p.parkedAt))/60000)));
 return {arrivals:state.processes.filter(p=>sameDay(p.arrivedAt)).length,departures:departed.length,longestWait:waits.length?Math.max(...waits):null,averageStay:durations.length?Math.round(durations.reduce((a,b)=>a+b,0)/durations.length):null,held:(state.reservations||[]).filter(r=>activeHold(r,now)).length,blocked:(state.blockedSlots||[]).length,queue:waiting.length};
}
export function restoreBackup(value){
 if(value?.format!=='parkwise-backup-v1'||!value.state)throw Error('Choose a Parkwise JSON backup.');
 const state=expireHolds(migrate(value.state));
 const ids=[...state.processes.map(p=>p.pid),...state.reservations.map(r=>r.id)].map(id=>Number(id.slice(1))).filter(Number.isFinite);
 if(state.nextId<=Math.max(100,...ids))throw Error('Backup has an invalid visit counter.');
 const active=new Set();for(const plate of [...state.processes.filter(p=>p.state!=='TERMINATED').map(p=>p.vehicleNumber),...state.reservations.filter(r=>activeHold(r)).map(r=>r.vehicleNumber)]){const key=plateKey(plate);if(active.has(key))throw Error('Backup contains duplicate active plates.');active.add(key);}
 return event(state,'Workspace restored from a backup',stamp());
}
