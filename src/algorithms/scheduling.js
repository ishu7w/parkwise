export const sample = [
  {pid:'P1',arrivalTime:0,burstTime:5,priority:3},
  {pid:'P2',arrivalTime:1,burstTime:3,priority:1},
  {pid:'P3',arrivalTime:2,burstTime:4,priority:4},
  {pid:'P4',arrivalTime:3,burstTime:2,priority:2},
];
export function schedule(input, algorithm='FCFS', quantum=2) {
  if (!['FCFS','Priority','Round Robin'].includes(algorithm)) throw Error('Unknown algorithm');
  if (!Number.isInteger(quantum)||quantum<1||quantum>100) throw Error('Quantum must be an integer from 1 to 100');
  const seen = new Set();
  const jobs = input.map((p,i)=>{
    if(seen.has(p.pid)) throw Error('Duplicate PID'); seen.add(p.pid);
    if(!Number.isInteger(p.arrivalTime)||p.arrivalTime<0||p.arrivalTime>10000||!Number.isInteger(p.burstTime)||p.burstTime<1||p.burstTime>100||!Number.isInteger(p.priority)||p.priority<1||p.priority>4) throw Error('Use arrival 0–10000, burst 1–100, priority 1–4 (integers).');
    return {...p,index:i,remaining:p.burstTime};
  }).sort((a,b)=>a.arrivalTime-b.arrivalTime||a.index-b.index);
  let time=0, cursor=0; const queue=[],segments=[],done=[];
  const arrive=()=>{while(cursor<jobs.length&&jobs[cursor].arrivalTime<=time)queue.push(jobs[cursor++]);};
  while(done.length<jobs.length){
    arrive();
    if(!queue.length){const next=jobs[cursor].arrivalTime;segments.push({pid:'Idle',start:time,end:next});time=next;arrive();}
    if(algorithm==='Priority')queue.sort((a,b)=>a.priority-b.priority||a.arrivalTime-b.arrivalTime||a.index-b.index);
    const p=queue.shift(),duration=algorithm==='Round Robin'?Math.min(quantum,p.remaining):p.remaining;
    segments.push({pid:p.pid,start:time,end:time+duration});time+=duration;p.remaining-=duration;
    arrive();
    if(p.remaining)queue.push(p);else done.push({...p,completionTime:time,turnaroundTime:time-p.arrivalTime,waitingTime:time-p.arrivalTime-p.burstTime});
  }
  const stats=done.sort((a,b)=>a.index-b.index);
  return {segments,stats,averageWaitingTime:stats.reduce((n,p)=>n+p.waitingTime,0)/(stats.length||1),averageTurnaroundTime:stats.reduce((n,p)=>n+p.turnaroundTime,0)/(stats.length||1)};
}
