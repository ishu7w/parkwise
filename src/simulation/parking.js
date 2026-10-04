import {schedule} from '../algorithms/scheduling.js';
export const slots=Array.from({length:12},(_,i)=>`${'ABC'[Math.floor(i/4)]}${i%4+1}`);
export const initial=()=>({processes:[],nextId:101,clock:0,logs:[]});
const transitions={NEW:['READY'],READY:['RUNNING'],RUNNING:['WAITING','TERMINATED'],WAITING:['READY'],TERMINATED:[]};
export function transition(p,state,time){if(!transitions[p.state]?.includes(state))throw Error(`Invalid transition ${p.state} → ${state}`);return {...p,state,history:[...p.history,{state,time}]};}
function log(s,message){s.logs=[{time:s.clock,message},...s.logs].slice(0,40);return s;}
export function addVehicle(s,vehicleNumber,priority=4,burstTime=3){
  const vehicle=vehicleNumber.trim().toUpperCase();
  if(!/^[A-Z0-9 -]{3,15}$/.test(vehicle))throw Error('Vehicle number must be 3–15 letters, numbers, spaces or hyphens.');
  if(s.processes.some(p=>p.vehicleNumber===vehicle&&p.state!=='TERMINATED'))throw Error('This vehicle already has an active process.');
  if(!Number.isInteger(priority)||priority<1||priority>4||!Number.isInteger(burstTime)||burstTime<1||burstTime>100)throw Error('Invalid priority or burst time.');
  const p={pid:`P${s.nextId}`,vehicleNumber:vehicle,priority,burstTime,arrivalTime:s.clock,state:'NEW',assignedSlot:null,waitingTime:null,turnaroundTime:null,history:[{state:'NEW',time:s.clock}]};
  const next={...s,clock:s.clock+1,nextId:s.nextId+1,processes:[...s.processes,transition(p,'READY',s.clock)]};
  return log(next,`${p.pid} created · NEW → READY`);
}
export function allocate(s,algorithm='FCFS',quantum=2){
  const ready=s.processes.filter(p=>p.state==='READY');if(!ready.length)throw Error('No ready requests. Add a vehicle or release an occupied slot.');
  // A request receives a bay when its simulated CPU service completes.
  const selected=schedule([...ready].sort((a,b)=>a.arrivalTime-b.arrivalTime).map(p=>({...p,arrivalTime:0})),algorithm,quantum).stats.sort((a,b)=>a.completionTime-b.completionTime)[0];
  const used=new Set(s.processes.map(p=>p.assignedSlot));
  const slot=slots.find(id=>!used.has(id)&&(id!=='C4'||selected.priority===3));
  let p=transition(s.processes.find(p=>p.pid===selected.pid),'RUNNING',s.clock);
  const clock=s.clock+(slot?p.burstTime:1);
  if(slot)p={...p,assignedSlot:slot,serviceStart:s.clock,waitingTime:s.clock-p.arrivalTime};else p=transition(p,'WAITING',clock);
  return log({...s,clock,processes:s.processes.map(x=>x.pid===p.pid?p:x)},slot?`${p.pid} READY → RUNNING · allocated ${slot}`:`${p.pid} READY → RUNNING → WAITING · no eligible bay`);
}
export function exitVehicle(s,pid){
  const p=s.processes.find(p=>p.pid===pid);if(!p||p.state!=='RUNNING'||!p.assignedSlot)throw Error('Select an occupied bay to exit a vehicle.');
  const clock=s.clock+1;
  const terminated={...transition(p,'TERMINATED',clock),assignedSlot:null,completionTime:clock,turnaroundTime:clock-p.arrivalTime};
  return log({...s,clock,processes:s.processes.map(x=>x.pid===pid?terminated:x.state==='WAITING'?transition(x,'READY',clock):x)},`${pid} exited ${p.assignedSlot} · TERMINATED; waiting requests → READY`);
}
export function demoParking(){let s=initial();['MH 12 AB 4821','KA 03 MN 9012','DL 01 CX 7740','MH 14 EV 2208','GJ 05 RD 6132','MH 12 PQ 8091'].forEach((v,i)=>{s=addVehicle(s,v,[4,2,4,1,4,3][i],i%4+2);s=allocate(s);});s=addVehicle(s,'MH 12 WX 3320',4);s=addVehicle(s,'KA 01 EE 4521',1);return s;}
