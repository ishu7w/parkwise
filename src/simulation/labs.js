export const raceSteps = (locked) => locked ? [
 {text:'P101 requests and acquires lock',owner:'P101',slot:'AVAILABLE'},
 {text:'P101 enters critical section; P102 waits for lock',owner:'P101',slot:'AVAILABLE'},
 {text:'P101 checks A1 → AVAILABLE',owner:'P101',slot:'AVAILABLE'},
 {text:'P101 allocates A1 and updates status',owner:'P101',slot:'P101'},
 {text:'P101 exits critical section and releases lock',owner:null,slot:'P101'},
 {text:'P102 acquires lock and checks A1 → OCCUPIED',owner:'P102',slot:'P101'},
 {text:'P102 moves to WAITING and releases lock',owner:null,slot:'P101'},
 {text:'RESOURCE PROTECTED · only P101 owns A1',owner:null,slot:'P101'},
] : [
 {text:'P101 checks A1 → AVAILABLE',owner:null,slot:'AVAILABLE'},
 {text:'P102 checks A1 → AVAILABLE (stale shared state)',owner:null,slot:'AVAILABLE'},
 {text:'P101 attempts allocation',owner:null,slot:'P101'},
 {text:'P102 attempts allocation using its earlier read',owner:null,slot:'CONFLICT'},
 {text:'RACE CONDITION · both processes claim A1',owner:null,slot:'CONFLICT'},
];
export const bufferInitial=()=>({queue:[],nextId:101,logs:[],message:'Buffer empty · consumer waiting'});
export function bufferAction(s,action){
 const queue=[...s.queue];let message,nextId=s.nextId;
 if(action==='produce'){if(queue.length===5)message='Buffer full · producer waiting';else {queue.push(`P${nextId++}`);message=`Produced ${queue.at(-1)}`;}}
 else if(action==='consume'){message=queue.length?`Consumed ${queue.shift()} → parking allocator`:'Buffer empty · consumer waiting';}
 else throw Error('Invalid buffer action');
 return {queue,nextId,message,logs:[message,...s.logs].slice(0,20)};
}
export const deadlockInitial=()=>({stage:'idle',r1:null,r2:null,waits:[],logs:[]});
export function deadlockAction(s,action){
 if(action==='trigger')return {stage:'blocked',r1:'P1',r2:'P2',waits:[['P1','P2'],['P2','P1']],logs:['P1 holds R1 and requests R2','P2 holds R2 and requests R1','Cycle detected: P1 → P2 → P1']};
 if(action==='resolve'&&s.stage==='blocked')return {stage:'resolved',r1:'P1',r2:'P1',waits:[],logs:['P2 selected as victim','P2 rolled back; R2 released','P1 acquired R2 and can proceed','Deadlock resolved']};
 throw Error('Create a deadlock before recovery.');
}
