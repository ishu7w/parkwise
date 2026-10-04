import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1440,height:1050}});const errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text()+' '+JSON.stringify(m.location()))});
const url=process.env.PARKWISE_URL||'http://localhost:5174';
async function nav(name){
 if(await page.locator('.premium-home').count()){
  if(name==='Home')return;
  await page.getByRole('button',{name:'Launch app',exact:true}).click();
 }
 if(name!=='Dashboard'||decodeURIComponent(await page.evaluate(()=>location.hash.slice(1)))!=='Dashboard')await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name,exact:true}).click();
 await page.waitForFunction(name=>decodeURIComponent(location.hash.slice(1))===name,name);await page.waitForTimeout(200);
}
await page.goto(url);await page.waitForTimeout(1300);await page.locator('.homepage-grid canvas').waitFor();await page.screenshot({path:'docs/screenshots/home-desktop.png',fullPage:true});
await nav('Dashboard');await page.getByRole('button',{name:'Reset demo',exact:true}).click();await page.getByRole('button',{name:'Add vehicle',exact:true}).click();await page.getByLabel('Vehicle number').fill('TEST-123');await page.getByRole('button',{name:'Create process'}).click();await page.getByRole('button',{name:'Allocate next request'}).click();await page.getByRole('button',{name:'A1 occupied by TEST-123'}).click();await page.getByRole('button',{name:'Exit vehicle',exact:true}).click();assert.equal(await page.getByRole('button',{name:'A1 available',exact:true}).count(),1);
await page.getByRole('button',{name:'Load demo data'}).click();await page.screenshot({path:'docs/screenshots/dashboard-desktop.png',fullPage:true});
await nav('Processes & scheduling');await page.getByRole('button',{name:'P101',exact:true}).click();await page.getByRole('heading',{name:'PCB / P101'}).waitFor();for(const algorithm of ['FCFS','Priority','Round Robin']){await page.getByLabel('Algorithm',{exact:true}).selectOption(algorithm);await page.getByRole('button',{name:'Run scheduler'}).click();await page.getByRole('heading',{name:'Execution timeline'}).waitFor();}await page.screenshot({path:'docs/screenshots/scheduler-desktop.png',fullPage:true});
await nav('Synchronization');for(let i=0;i<5;i++)await page.getByRole('button',{name:'Next step'}).click();await page.getByRole('status').filter({hasText:'Race condition.'}).waitFor();await page.getByRole('button',{name:'Synchronization OFF'}).click();for(let i=0;i<8;i++)await page.getByRole('button',{name:'Next step'}).click();await page.getByRole('status').filter({hasText:'Resource protected.'}).waitFor();
await nav('Producer–consumer');for(let i=0;i<6;i++)await page.getByRole('button',{name:'Produce vehicle'}).click();assert.match(await page.getByRole('status').innerText(),/full/);for(let i=0;i<6;i++)await page.getByRole('button',{name:'Consume vehicle'}).click();assert.match(await page.getByRole('status').innerText(),/empty/);
await nav('Deadlock');await page.getByRole('button',{name:'Create deadlock'}).click();await page.getByText('DEADLOCK DETECTED',{exact:true}).waitFor();await page.getByRole('button',{name:'Resolve deadlock'}).click();await page.getByText('RESOLVED',{exact:true}).waitFor();
await nav('OS Concepts');assert.equal(await page.locator('.concept-table article').count(),10);
for(const width of [1440,1280,768,390]){await page.setViewportSize({width,height:900});for(const name of ['Home','Dashboard','Processes & scheduling','Synchronization','Producer–consumer','Deadlock','OS Concepts']){await nav(name);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow ${width} ${name}`);if(width===390&&['Home','Dashboard'].includes(name))await page.screenshot({path:`docs/screenshots/${name.toLowerCase()}-mobile.png`,fullPage:true});}}
assert.deepEqual(errors,[]);console.log('PASS: all 7 routes, core UI interactions, PCB, three schedulers, both race modes, buffer bounds, deadlock recovery, 4 viewport widths and shader-backed landing. No console/page errors.');await browser.close();
