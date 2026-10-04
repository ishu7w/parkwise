const {chromium}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const p=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://localhost:5174/#Overview');
 const original=await p.evaluate(()=>localStorage.getItem('parkwise-workspace-v2'));
 await p.goto('http://localhost:5174/?workspace=sample#Overview');
 await p.getByText('SAMPLE WORKSPACE',{exact:false}).first().waitFor();
 assert.equal(await p.locator('.bay.occupied').count(),4);assert.equal(await p.locator('.bay.held').count(),1);assert.equal(await p.locator('.bay.blocked').count(),1);
 await p.goto('http://localhost:5174/?workspace=sample#Reservations');
 await p.getByLabel('Visitor name').fill('Presentation Visitor');await p.getByLabel('Vehicle plate').fill('DEMO123');await p.getByLabel('Hold bay',{exact:true}).selectOption('B1');await p.getByRole('button',{name:'Hold bay',exact:true}).click();
 await p.getByRole('button',{name:'Check in DEMO123',exact:true}).click();await p.reload();assert.match(await p.locator('.reservation-list').innerText(),/Checked in/);
 await p.getByRole('button',{name:'Cancel reservation KA01 EE4521',exact:true}).click();
 await p.goto('http://localhost:5174/?workspace=sample#Workspace');await p.getByRole('button',{name:'Block B2',exact:true}).click();await p.getByRole('button',{name:'Reopen C2',exact:true}).click();
 const downloaded=p.waitForEvent('download');await p.getByRole('button',{name:'Download workspace backup'}).click();const file=await downloaded;const backup=JSON.parse(fs.readFileSync(await file.path(),'utf8'));assert.equal(backup.workspace,'sample');assert.deepEqual(backup.state.blockedSlots,['B2']);
 await p.goto('http://localhost:5174/?workspace=sample#Overview');await p.getByRole('button',{name:'Park next vehicle'}).click();assert.equal(await p.locator('.bay.occupied').count(),6);assert.match(await p.getByRole('button',{name:/B3 occupied/}).innerText(),/GJ05/);
 for(const width of [1440,390]){await p.setViewportSize({width,height:1000});for(const route of ['Overview','Vehicles','Reservations','Activity','Workspace']){await p.goto('http://localhost:5174/?workspace=sample#'+route);await p.locator('.page-title').waitFor();assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${route} overflow ${width}`)}}
 await p.screenshot({path:'docs/prototype-mobile.png',fullPage:true});await p.setViewportSize({width:1440,height:1000});await p.goto('http://localhost:5174/?workspace=sample#Overview');await p.screenshot({path:'docs/prototype-overview.png',fullPage:true});
 assert.equal(await p.evaluate(()=>localStorage.getItem('parkwise-workspace-v2')),original);assert.deepEqual(errors,[]);
 console.log('PASS holds, check-in, cancellation, maintenance, backup, allocation, isolated sample storage and five responsive routes');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
