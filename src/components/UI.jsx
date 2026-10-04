import {ArrowUpRight} from 'lucide-react';
export function Badge({children,tone=''}){return <span className={`badge ${tone||String(children).toLowerCase()}`}>{children}</span>}
export function Panel({title,aside,children,className=''}){return <section className={`panel ${className}`}><div className="panel-heading"><h2>{title}</h2>{aside}</div>{children}</section>}
export function PageTitle({title,description,children}){return <div className="page-title"><div><h1>{title}</h1><p>{description}</p></div><div className="actions">{children}</div></div>}
export function Logs({logs}){return <div className="logs" aria-live="polite">{logs.length?logs.map((l,i)=><div key={i}><span>{typeof l==='string'?String(logs.length-i).padStart(2,'0'):`t+${l.time}`}</span><p>{typeof l==='string'?l:l.message}</p></div>):<p className="muted">Events will appear here when you interact with the demo.</p>}</div>}
export function ConceptNote({children}){return <div className="concept-note"><ArrowUpRight size={18}/><p>{children}</p></div>}
