import {useState,useEffect,useRef} from 'react';
import {flushSync} from 'react-dom';
import gsap from 'gsap';
import {Flip} from 'gsap/Flip';
gsap.registerPlugin(Flip);
import {CarFront,Plus,ArrowRight,LogOut,Play} from 'lucide-react';
import {slots,addVehicle,allocate,exitVehicle,bayStatus,availableSlots,allocationAdvice,operationsSummary} from '../domain/parking';
import {Panel,PageTitle,Badge} from '../components/UI';
import ParkingOperations from '../components/ParkingOperations';
export default function Dashboard({state,setState,algorithm,setAlgorithm}){
 const [adding,setAdding]=useState(false),[vehicle,setVehicle]=useState(''),[priority,setPriority]=useState(4),[error,setError]=useState(''),[selected,setSelected]=useState(null);
 const motion=useRef(null);
 const [,refreshClock]=useState(0);
 useEffect(()=>{const timer=setInterval(()=>refreshClock(x=>x+1),30000);return()=>clearInterval(timer)},[]);
 useEffect(()=>()=>motion.current?.revert(),[]);
 function toggleEntry(value){
  motion.current?.revert();
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){setAdding(value);return;}
  const before=Flip.getState('.dashboard-grid');
  flushSync(()=>setAdding(value));
  motion.current=gsap.context(()=>{
   Flip.from(before,{duration:.32,ease:'power2.out',scale:false});
   if(value)gsap.from('.vehicle-form',{opacity:0,y:-6,duration:.22,ease:'power2.out'});
  });
 }
 const occupied=state.processes.filter(p=>p.assignedSlot), waiting=state.processes.filter(p=>['READY','WAITING'].includes(p.state));
 const advice=allocationAdvice(state,algorithm),summary=operationsSummary(state);
 const available=availableSlots(state).filter(id=>id!=='C4').length;
 function act(fn){try{setState(fn(state));setError('');return true;}catch(e){setError(e.message);return false;}}
 return <><PageTitle title="Parking overview" description="Manage arrivals, assign spaces, and keep your entry lane moving."><button className="primary" onClick={()=>toggleEntry(!adding)}><Plus size={17}/>Add vehicle</button></PageTitle>
 <div className="metric-row">{[['Total slots','12','Across three zones'],['Available slots',availableSlots(state).length,`${available} general · ${availableSlots(state).includes('C4')?1:0} reserved`],['Occupied slots',occupied.length,'Vehicles currently parked'],['Waiting vehicles',waiting.length,'In the request queue']].map(([label,value,sub])=><div className="metric" key={label}><span>{label}</span><strong>{value}<i className={label.startsWith('Available')?'green-dot':''}/></strong><small>{sub}</small></div>)}</div>
 {adding&&<form className="vehicle-form panel" onSubmit={e=>{e.preventDefault();if(act(s=>addVehicle(s,vehicle,priority,3))){setVehicle('');setAdding(false)}}}><label>Vehicle number<input autoFocus placeholder="MH 12 AB 1234" value={vehicle} onChange={e=>setVehicle(e.target.value)} required maxLength={15}/></label><label>Vehicle category<select value={priority} onChange={e=>setPriority(Number(e.target.value))}><option value="1">Emergency</option><option value="2">Accessible</option><option value="3">Reserved</option><option value="4">Standard</option></select></label><button className="primary" type="submit">Add to queue</button><button type="button" onClick={()=>toggleEntry(false)}>Cancel</button></form>}
 {error&&<p role="alert" className="error">{error}</p>}
 <div className="dashboard-grid"><Panel title="Live parking map" aside={<span className="live"><i/>Current occupancy</span>}><div className="map-meta"><span>GROUND LEVEL <b>/</b> 12 BAYS</span><div className="legend"><span><i className="free"/>Available</span><span><i className="taken"/>Occupied</span><span><i className="reserved"/>Reserved</span><span>H · Held</span><span>× · Blocked</span></div></div><div className="parking-map">{['A','B','C'].map(zone=><div className="zone" key={zone}><div className="zone-label">ZONE <b>{zone}</b></div><div className="bays">{slots.filter(s=>s[0]===zone).map(id=>{const {kind,vehicle:p}=bayStatus(state,id),reserved=kind==='reserved',label=({held:'Visitor hold',blocked:'Out of service',reserved:'Reserved',available:'Available'})[kind];return <button key={id} className={`bay ${kind} ${selected===id?'selected':''}`} onClick={()=>setSelected(id)} aria-label={`${id} ${p?'occupied by '+p.vehicleNumber:label}`}><span className="bay-id">{id}</span>{p?<CarFront className="bay-car" size={45} strokeWidth={1.3}/>:<span className="bay-symbol">{reserved?'R':kind==='held'?'H':kind==='blocked'?'×':'P'}</span>}<span className="bay-detail">{p?p.vehicleNumber:label}</span></button>})}</div></div>)}<div className="drive-lane"><span>ENTRY</span><ArrowRight/><div/><ArrowRight/><span>EXIT</span></div></div><div className="map-footer">{selected?<><span><b>{selected}</b> · {occupied.find(p=>p.assignedSlot===selected)?.vehicleNumber||({held:'Held for a visitor',blocked:'Out of service'})[bayStatus(state,selected).kind]||'No vehicle allocated'}</span><button disabled={!occupied.some(p=>p.assignedSlot===selected)} onClick={()=>act(s=>exitVehicle(s,occupied.find(p=>p.assignedSlot===selected)?.pid))}><LogOut size={15}/>Exit vehicle</button></>:<span>Select an occupied bay to check out a vehicle.</span>}</div></Panel>
 <div className="right-column"><Panel title="Allocation queue" aside={<Badge>{waiting.length+' waiting'}</Badge>}><div className="queue-list">{waiting.length?waiting.map(p=><button className="queue-item" key={p.pid} onClick={()=>{location.hash="Vehicles"}}><div className="car-icon"><CarFront size={20}/></div><div><strong>{p.vehicleNumber}</strong><small>{['','Emergency','Accessible','Reserved','Standard'][p.priority]}</small></div><Badge tone={p.priority===1?'emergency':'ready'}>{p.state==='READY'?'QUEUED':'WAITING'}</Badge></button>):<div className="empty"><CarFront/><p>The entry lane is clear.</p><small>Add an arriving vehicle to get started.</small></div>}</div><div className="allocation-controls"><label>Queue order<select value={algorithm} onChange={e=>setAlgorithm(e.target.value)}><option>Arrival order</option><option>Priority first</option><option>Balanced priority</option></select></label><div className="allocation-advice"><span>NEXT ASSIGNMENT</span><strong>{advice.vehicle?`${advice.vehicle.vehicleNumber} → ${advice.bay}`:'No assignment ready'}</strong><p>{advice.reason}</p></div><button className="primary full" disabled={!advice.vehicle} onClick={()=>act(s=>allocate(s,algorithm))}><Play size={15}/>Park next vehicle</button><small>C4 is reserved for vehicles in the Reserved category.</small></div></Panel></div></div>
 <Panel title="Today’s operations" aside={<span className="system-status">Local calendar day</span>}><div className="operations-summary">{[['Arrivals',summary.arrivals],['Departures',summary.departures],['Longest queue wait',summary.longestWait===null?'—':summary.longestWait+' min'],['Average completed stay',summary.averageStay===null?'—':summary.averageStay+' min']].map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><div className="capacity-notice">{summary.held} visitor holds · {summary.blocked} maintenance blocks{summary.queue>0&&available===0?' · General bays are full: check availability before admitting another vehicle.':''}{summary.longestWait>=10?' · A vehicle has waited 10+ minutes. Balanced priority improves its queue rank.':''}</div></Panel>
 <ParkingOperations state={state} view="utilization"/>
 <div className="overview-links"><a href="#Vehicles">View all vehicles and export records →</a><a href="#Activity">View arrival and departure history →</a></div></>;
}
