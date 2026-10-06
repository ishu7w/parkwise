import './styles.css';
import './technical.css';
import {useEffect,useState,useRef} from 'react';
import gsap from 'gsap';
import {CustomEase} from 'gsap/CustomEase';
import {Command} from 'lucide-react';
import useSmoothScroll from './hooks/useSmoothScroll';
import Dashboard from './pages/Dashboard';
import Reservations from './pages/Reservations';
import Workspace from './pages/Workspace';
import ParkingOperations from './components/ParkingOperations';
import {Panel,PageTitle} from './components/UI';
import {initial,migrate,exitVehicle,displayTime,sampleWorkspace,cancelArrival,expireHolds} from './domain/parking';
gsap.registerPlugin(CustomEase);CustomEase.create('workspaceEase','0.22,1,0.36,1');
const isSample=new URLSearchParams(location.search).get('workspace')==='sample';
const key=isSample?'parkwise-sample-v1':'parkwise-workspace-v2';
function restore(){try{const raw=localStorage.getItem(key)||(!isSample&&localStorage.getItem('parkwise-state-v1'));return {state:raw?expireHolds(migrate(JSON.parse(raw))):isSample?sampleWorkspace():initial(),error:''}}catch{return {state:initial(),error:'Saved data could not be loaded. Your existing storage has not been overwritten.'}}}
function route(){try{const name=decodeURIComponent(location.hash.slice(1));return ['Vehicles','Reservations','Activity','Workspace'].includes(name)?name:'Overview'}catch{return 'Overview'}}
export default function App(){
 const [loaded]=useState(restore),[state,setState]=useState(loaded.state),[page,setPage]=useState(route),[policy,setPolicy]=useState('Arrival order'),[savingBlocked,setSavingBlocked]=useState(Boolean(loaded.error)),[saved,setSaved]=useState(false),[error,setError]=useState(loaded.error);const content=useRef(null);useSmoothScroll(page);
 useEffect(()=>{const refresh=()=>setState(s=>expireHolds(s));const timer=setInterval(refresh,15000);window.addEventListener('focus',refresh);return()=>{clearInterval(timer);window.removeEventListener('focus',refresh)}},[]);
 useEffect(()=>{const fn=()=>setPage(route());window.addEventListener('hashchange',fn);return()=>window.removeEventListener('hashchange',fn)},[]);
 useEffect(()=>{if(savingBlocked)return;try{localStorage.setItem(key,JSON.stringify(state));setSaved(true)}catch{setSaved(false)}},[state,savingBlocked]);
 useEffect(()=>{document.title=`${page} · Parkwise`;const media=gsap.matchMedia();media.add('(prefers-reduced-motion: no-preference)',()=>{const ctx=gsap.context(()=>gsap.from('.page-title,.metric-row,.panel',{y:10,opacity:0,duration:.35,stagger:.035,ease:'workspaceEase'}),content);return()=>ctx.revert()});return()=>media.revert()},[page]);
 function checkout(id){try{setState(exitVehicle(state,id));setError('')}catch(e){setError(e.message)}}
 return <div className="technical-app"><a className="skip-link" href="#main" onClick={e=>{e.preventDefault();content.current.focus()}}>Skip to content</a><header className="technical-header"><a className="technical-brand" href="#Overview"><span><Command size={20}/></span>parkwise<small>PARKING SYSTEM</small></a><nav aria-label="Main navigation">{['Overview','Vehicles','Reservations','Activity','Workspace'].map((name,i)=><a key={name} href={'#'+name} aria-current={page===name?'page':undefined}><span>0{i+1}.</span> {name}</a>)}</nav><span className="system-status"><i/>{saved?'Saved on this device':'Session only'}</span></header><main id="main" tabIndex={-1} ref={content}>{isSample&&<div className="sample-banner">SAMPLE WORKSPACE · Changes stay separate from your real records. <a href="/?workspace=local#Overview">Return to real workspace →</a></div>}<div className="workspace-kicker"><span>WORKSPACE / {page.toUpperCase()}</span><span>GROUND LEVEL · 12 BAYS</span></div>{error&&<p role="alert" className="error">{error}</p>}{page==='Overview'?<Dashboard state={state} setState={setState} algorithm={policy} setAlgorithm={setPolicy}/>:page==='Vehicles'?<><PageTitle title="Vehicles" description="Find a vehicle, check out a visit, or export your records."/><ParkingOperations state={state} onExit={checkout} onCancel={id=>{try{setState(cancelArrival(state,id));setError('')}catch(e){setError(e.message)}}} view="register"/></>:page==='Reservations'?<Reservations state={state} setState={setState}/>:page==='Workspace'?<Workspace state={state} setState={setState} onRestore={restored=>{setState(restored);setSavingBlocked(false);setError('')}} isSample={isSample}/>:<><PageTitle title="Activity" description="A record of arrivals, parking assignments, and departures."/><Panel title="Recent activity"><div className="logs">{state.logs.length?state.logs.map((l,i)=><div key={i}><span>{displayTime(l.at)}</span><p>{l.message}</p></div>):<p className="muted">Activity will appear after your first arrival.</p>}</div><p className="storage-note">Latest 1,000 events · Times shown in your local time zone.</p></Panel></>}</main><footer className="technical-footer"><span>PARKWISE / SPACE, IN ORDER.</span><span>{saved?'SINGLE-DEVICE WORKSPACE · SAVED LOCALLY':'SESSION ONLY · DATA IS NOT SAVED'}</span></footer></div>
}
