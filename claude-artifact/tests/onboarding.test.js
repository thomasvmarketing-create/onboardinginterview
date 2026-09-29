const {chromium}=require('playwright');
const path=require('path');
const URL='file://'+path.resolve(__dirname,'../onboarding.html');
const store={};
const SHOTS=path.resolve(__dirname,'screenshots')+'/';
require('fs').mkdirSync(SHOTS,{recursive:true});
function assert(c,m){if(!c){console.log('FAIL:',m);process.exitCode=1;}else console.log('ok:',m);}

async function mkPage(b,{uid,owner,canWrite,noClaude,scheme}){
  const ctx=await b.newContext({viewport:{width:1200,height:900},colorScheme:scheme||'light'});
  const p=await ctx.newPage();
  const errs=[];p.on('pageerror',e=>errs.push(e.message));p.errs=errs;
  await p.exposeFunction('__set',(path,json)=>{if(!canWrite&&!owner)return 'DENY';store[path]=JSON.parse(json);return 'OK';});
  await p.exposeFunction('__get',(path)=>store[path]?JSON.stringify(store[path]):null);
  await p.exposeFunction('__list',(col)=>JSON.stringify(Object.keys(store).filter(k=>k.startsWith(col+'/')).map(k=>({id:k.split('/')[1],data:store[k]}))));
  if(!noClaude) await p.addInitScript(({uid,owner,canWrite})=>{
    function snap(id,d){return {id,exists:!!d,data:()=>d||undefined,metadata:{fromCache:false,hasPendingWrites:false}};}
    const db={doc(path){return {path,id:path.split('/').pop(),
        get:async()=>{const j=await window.__get(path);return snap(path.split('/').pop(),j&&JSON.parse(j));},
        set:async(d)=>{const r=await window.__set(path,JSON.stringify(d));if(r==='DENY')throw {code:'invalid_argument',message:'denied'};}}},
      collection(col){return {onSnapshot(next){const f=async()=>{const l=JSON.parse(await window.__list(col));next({docs:l.map(x=>snap(x.id,x.data)),size:l.length,empty:!l.length,docChanges:()=>[],metadata:{}});};f();const t=setInterval(f,500);return()=>clearInterval(t);}}}};
    const user={id:async()=>uid,isOwner:async()=>owner,canEdit:async()=>owner,can:async()=>canWrite,profiles:async(ids)=>Object.fromEntries([].concat(ids).map(i=>[i,{id:i,name:i==='client1'?'Maya Torres':'',email:null,guest:true}]))};
    const downloads={save:async({filename,data})=>{window.__lastDownload={filename,data};return {status:'saved'};}};
    window.claude={use:async(n)=>({db,user,downloads})[n]||null};
  },{uid,owner,canWrite});
  await p.goto(URL);await p.waitForTimeout(400);
  return p;
}
async function answer(p,text){await p.fill('textarea.answer',text);}

(async()=>{
  const b=await chromium.launch();
  // A: client who can save
  let p=await mkPage(b,{uid:'client1',owner:false,canWrite:true});
  assert(await p.isVisible('text=Tell us about your business'),'welcome renders');
  assert(await p.isVisible('text=save automatically'),'cloud mode note shown');
  assert(await p.locator('input').count()===0,'no name/business/email fields');
  assert(await p.isVisible('text=Talk, don'),'talk tip on intro');
  await p.click('button:has-text("Start the interview")');
  assert(await p.isVisible('text=Talk instead of typing'),'talk helper on question');
  assert(await p.isVisible('text=What is your main industry'),'q1 shown');
  await answer(p,'Airbnb arbitrage for people with full-time jobs.');
  await p.waitForTimeout(1600);
  assert(store['submissions/client1']?.answers?.q01?.startsWith('Airbnb'),'autosave while typing reached store');
  assert(await p.textContent('#status')==='Saved','status says Saved');
  await p.click('.dock button:has-text("Next")');
  await answer(p,'To get leads.');
  await p.click('.dock button:has-text("Next")');
  assert(await p.isVisible('text=Who is your target audience'),'next advances to q3');
  await p.click('.dock button:has-text("Back")');
  assert(await p.inputValue('textarea.answer')==='To get leads.','back keeps answer');
  await p.screenshot({path:SHOTS+'q-desktop.png'});
  await p.click('.rail button:nth-child(17)');
  assert(await p.isVisible('text=NOT include'),'rail jumps to q17');
  await answer(p,'No crypto talk.');
  await p.click('button:has-text("Review answers")');
  assert(await p.locator('.chip.red').count()===14,'review flags 14 unanswered');
  await p.click('button:has-text("Send my answers")');
  await p.waitForTimeout(300);
  assert(await p.isVisible('text=Your answers have been sent'),'done screen (cloud)');
  assert(store['submissions/client1'].status==='submitted'&&store['submissions/client1'].answeredCount===3,'submitted with 3 answers in store');
  await p.click('button:has-text("Download my answers")');
  const dl=await p.evaluate(()=>window.__lastDownload);
  assert(dl&&dl.filename==='onboarding-answers.md'&&dl.data.includes('## 17.'),'download has all 17 questions');
  assert(p.errs.length===0,'no page errors A '+p.errs.join(';'));
  // resume from another device (fresh storage)
  const p2=await mkPage(b,{uid:'client1',owner:false,canWrite:true});
  assert(await p2.isVisible('text=Welcome back')&&await p2.isVisible('text=3 of 17 answered'),'resumes from store on new device');

  // B: outside viewer who can't save
  const pb=await mkPage(b,{uid:'client2',owner:false,canWrite:false,scheme:'dark'});
  assert(await pb.isVisible('text=kept on this device'),'local mode note for non-writer');
  await pb.click('button:has-text("Start the interview")');
  await answer(pb,'Day trading');
  assert((await pb.textContent('#status')).includes('this device only'),'status says device only');
  await pb.setViewportSize({width:400,height:820});
  await pb.screenshot({path:SHOTS+'q-phone-dark.png'});
  await p2.screenshot({path:SHOTS+'intro.png'});
  await pb.click('.rail button:nth-child(17)');await pb.click('button:has-text("Review answers")');await pb.click('button:has-text("Send my answers")');
  await pb.waitForTimeout(200);
  assert(await pb.isVisible('text=saved on this device only'),'done screen tells them to send it');
  assert(!store['submissions/client2'],'nothing written for non-writer');
  assert(await pb.evaluate(()=>document.documentElement.scrollWidth)<=400,'no horizontal scroll at phone width');
  // reload keeps local answers
  await pb.reload();await pb.waitForTimeout(400);
  assert(await pb.isVisible('text=Welcome back'),'local answers survive reload');

  // C: owner
  const po=await mkPage(b,{uid:'owner1',owner:true,canWrite:true});
  await po.waitForTimeout(700);
  assert(await po.isVisible('text=Client interviews'),'owner lands on dashboard');
  assert(await po.isVisible('text=Send this to a client'),'share steps shown');
  assert(await po.isVisible('text=Maya Torres'),'owner sees client submission');
  await po.screenshot({path:SHOTS+'owner.png'});
  await po.click('.trow:has-text("Maya Torres")');
  assert(await po.isVisible('text=No crypto talk.'),'owner detail shows answers');
  assert(po.errs.length===0,'no page errors owner');
  await po.click('button:has-text("All interviews")');await po.click('button:has-text("Preview as a client")');
  assert(await po.isVisible('text=Tell us about your business'),'owner can preview client view');

  // D: no claude runtime
  const pd=await mkPage(b,{noClaude:true});
  assert(await pd.isVisible('text=kept on this device'),'works with no runtime (local)');
  await b.close();
})();
