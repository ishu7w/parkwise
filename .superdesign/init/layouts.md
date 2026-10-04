# Shared application shell
App renders sticky header, home navigation or lab navigation and workspace footer. Home owns its marketing footer.

## src/App.jsx
```jsx
import {useEffect,useState,useRef,lazy,Suspense} from 'react';
import gsap from 'gsap';
import useSmoothScroll from './hooks/useSmoothScroll';
import {Command,LayoutDashboard,Layers,ShieldCheck,ListOrdered,Workflow,BookOpen,Box,ChevronRight,ArrowUpRight} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Processes from './pages/Processes';
import {Synchronization,ProducerConsumer,Deadlock,Concepts} from './pages/Labs';
import Home from './pages/Home';
import TemplateDemo from './components/ui/demo';
import {demoParking} from './simulation/parking';
const GridShaderDemo=lazy(()=>import('./components/ui/grid-shader-demo'));
const nav=[['Home',Box],['Dashboard',LayoutDashboard],['Processes & scheduling',Layers],['Synchronization',ShieldCheck],['Producer–consumer',ListOrdered],['Deadlock',Workflow],['OS Concepts',BookOpen]];
const key='parkwise-state-v1';
function restore(){try{const value=JSON.parse(localStorage.getItem(key));if(value&&Array.isArray(value.processes)&&Number.isFinite(value.clock)&&Number.isFinite(value.nextId)&&Array.isArray(value.logs)&&value.processes.every(p=>Array.isArray(p.history)&&typeof p.vehicleNumber==='string'&&['NEW','READY','RUNNING','WAITING','TERMINATED'].includes(p.state)))return value}catch{}return demoParking()}
function route(){try{const value=decodeURIComponent(location.hash.slice(1));return ['Template','GridShader'].includes(value)||nav.some(([n])=>n===value)?value:'Home'}catch{return 'Home'}}
export default function App(){const [page,setPage]=useState(route),[state,setState]=useState(restore),[algorithm,setAlgorithm]=useState('FCFS'),[quantum,setQuantum]=useState(2),[selected,setSelected]=useState(null),[saved,setSaved]=useState(true);
 const scrollTo=useSmoothScroll(page);const content=useRef(null);
 useEffect(()=>{const handler=()=>setPage(route());window.addEventListener('hashchange',handler);return()=>window.removeEventListener('hashchange',handler)},[]);
 useEffect(()=>{try{localStorage.setItem(key,JSON.stringify(state));setSaved(true)}catch{setSaved(false)}},[state]);
 useEffect(()=>{document.title=`${page} · Parkwise OS Lab`;if(['Home','Template','GridShader'].includes(page))return;const ctx=gsap.context(()=>{if(!matchMedia('(prefers-reduced-motion: reduce)').matches)gsap.from('.page-title,.metric-row,.panel',{y:14,opacity:0,duration:.5,stagger:.045,ease:'power3.out'})},content);return()=>ctx.revert()},[page]);
 function navigate(value){location.hash=encodeURIComponent(value);setPage(value)}
 if(page==='GridShader')return <div style={{background:'#000',minHeight:'100svh'}}><Suspense fallback={<p style={{color:'#bbb',padding:30}}>Loading grid shader…</p>}><GridShaderDemo/></Suspense><button className="template-return" onClick={()=>navigate('Home')}>← Back to Parkwise</button></div>;
 if(page==='Template')return <div className="original-template-preview"><TemplateDemo/><button className="template-return" onClick={()=>navigate('Home')}>← Back to Parkwise</button></div>;
 return <div className={`app-shell ${page==='Home'?'is-premium-home':'lab-theme'}`}><a className="skip-link" href="#main" onClick={e=>{e.preventDefault();document.getElementById('main').focus()}}>Skip to content</a><header className="site-header"><a className="site-brand" href="#Home" onClick={()=>navigate('Home')}><Command size={23}/>parkwise<span>OS LAB</span></a>{page==='Home'?<nav aria-label="Home navigation"><button onClick={()=>scrollTo('#modules')}>The lab</button><button onClick={()=>scrollTo('#how-it-works')}>How it works</button><button onClick={()=>navigate('OS Concepts')}>Concept guide</button></nav>:<span className="workspace-name">Workspace <ChevronRight size={14}/>{page}</span>}<button className="header-launch" onClick={()=>navigate(page==='Home'?'Dashboard':'Home')}>{page==='Home'?'Launch app':'Back to overview'}<ArrowUpRight size={15}/></button></header>{page!=='Home'&&<nav className="lab-navigation" aria-label="Main navigation">{nav.map(([name,Icon])=><button key={name} aria-current={page===name?'page':undefined} className={page===name?'current':''} onClick={()=>navigate(name)}><Icon size={16}/>{name}</button>)}</nav>}<div className="main-shell"><main id="main" tabIndex={-1} ref={content}>{page==='Home'?<Home navigate={navigate} scrollTo={scrollTo} state={state} algorithm={algorithm} setAlgorithm={setAlgorithm}/>:page==='Dashboard'?<Dashboard state={state} setState={setState} algorithm={algorithm} setAlgorithm={setAlgorithm} quantum={quantum} onProcess={pid=>{setSelected(pid);navigate('Processes & scheduling')}}/>:page==='Processes & scheduling'?<Processes state={state} algorithm={algorithm} setAlgorithm={setAlgorithm} quantum={quantum} setQuantum={setQuantum} selected={selected} setSelected={setSelected}/>:page==='Synchronization'?<Synchronization/>:page==='Producer–consumer'?<ProducerConsumer/>:page==='Deadlock'?<Deadlock/>:<Concepts navigate={navigate}/>}</main>{page!=='Home'&&<footer className="app-footer"><span>Parkwise / Operating systems, made tangible.</span><span>{saved?'Saved on this device':'Storage unavailable · session only'}</span></footer>}</div></div>
}

```
