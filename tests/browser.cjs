const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
(async () => {
 const browser = await chromium.launch({headless:true,channel:'chrome'});
 const page = await browser.newPage();
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(() => {
  window.calls = [];
  window.activeUrl='https://www.menti.com/test';
  window.panelOpened=false; window.keyRemoved=false;
  Object.defineProperty(navigator,'clipboard',{value:{writeText:async value=>{window.copied=value;}}});
  window.chrome = {
   tabs:{query:async()=>[{id:1,url:window.activeUrl}]},
   windows:{getCurrent:async()=>({id:10})},
   sidePanel:{open:async ({windowId})=>{window.panelOpened=windowId===10;}},
   permissions:{contains:async()=>true,request:async()=>true},
   storage:{local:{get:async()=>({}),set:async()=>{}},session:{get:async()=>({}),set:async()=>{},remove:async()=>{window.keyRemoved=true;}}},
   scripting:{executeScript:async ({func,args}) => {
    const frame=document.getElementById('fixture');
    const value=frame.contentWindow.eval('('+func.toString()+')')(...args);
    return [{result:value}];
   }}
  };
  window.fetch = async (url,options) => {
   const question=JSON.parse(JSON.parse(options.body).messages[1].content).question;
   calls.push(question);
   await new Promise((resolve,reject)=> {
    const timer=setTimeout(resolve,question.includes('slow')?700:40);
    options.signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));});
   });
   if(question.includes('fail')) return {ok:false,status:401};
   return {ok:true,json:async()=>({choices:[{message:{content:question.includes('next')?'5':'4'}}]})};
  };
 });
 await page.goto('file://'+path.resolve('extension/popup.html'));
 await page.evaluate(() => {
  const frame=document.createElement('iframe');frame.id='fixture';document.body.append(frame);
  frame.contentDocument.body.innerHTML='<h1>What is 2 + 2?</h1><label><input type="radio" name="a">3</label><label><input type="radio" name="a">4</label>';
 });
 await page.click('#read'); await page.click('#ask');
 await page.waitForFunction(()=>document.getElementById('answer').textContent==='4');
 await page.click('#copy'); assert.equal(await page.evaluate(()=>window.copied),'4');
 await page.click('#apply');
 assert.equal(await page.evaluate(()=>document.getElementById('fixture').contentDocument.querySelectorAll('input')[1].checked),true);
 await page.click('#ask'); await page.waitForFunction(()=>document.getElementById('status').textContent.includes('cached'));
 assert.equal(await page.evaluate(()=>calls.length),1);
 await page.evaluate(()=>document.getElementById('fixture').contentDocument.querySelector('h1').textContent='Changed?');
 await page.click('#apply'); await page.waitForFunction(()=>document.getElementById('status').textContent.includes('question changed'));
 const change = async question => page.evaluate(q=>{
  const doc=document.getElementById('fixture').contentDocument;
  doc.querySelector('h1').textContent=q;
  doc.querySelectorAll('label')[1].lastChild.textContent=q.includes('next')?'5':'4';
 },question);
 await change('slow question?'); await page.check('#watch');
 await page.waitForFunction(()=>calls.includes('slow question?'));
 const started=Date.now(); await change('next question?');
 await page.waitForFunction(()=>document.getElementById('answer').textContent==='5');
 const elapsed=Date.now()-started;
 assert.ok(elapsed<650,`Detection too slow: ${elapsed}ms`);
 await page.waitForTimeout(800);
 assert.equal(await page.textContent('#answer'),'5');
 await change('fail question?'); await page.waitForFunction(()=>document.getElementById('status').textContent.includes('HTTP 401'));
 assert.equal(await page.isDisabled('#ask'),false);
 await page.uncheck('#watch');
 await change('slow cancellation question?'); await page.click('#read'); await page.click('#ask');
 await page.waitForFunction(()=>calls.includes('slow cancellation question?'));
 await page.click('#stop');
 await page.waitForTimeout(750);
 assert.equal(await page.textContent('#answer'),'');
 assert.equal(await page.isDisabled('#ask'),false);
 await change('What is 2 + 2?');await page.check('#watch');
 await page.waitForFunction(()=>document.getElementById('answer').textContent==='4');
 await page.evaluate(()=>window.activeUrl='https://example.com');
 await page.waitForFunction(()=>document.getElementById('apply').disabled && !document.getElementById('answer').textContent);
 await page.evaluate(()=>window.activeUrl='https://www.menti.com/test');
 await page.waitForFunction(()=>document.getElementById('answer').textContent==='4');
 await page.click('#panel');
 assert.equal(await page.evaluate(()=>window.panelOpened),true);
 assert.equal(await page.isChecked('#watch'),false);
 await page.locator('#provider-settings').evaluate(el=>{el.open=true;});
 await page.fill('#key','test-key'); await page.click('#forget');
 await page.waitForFunction(()=>window.keyRemoved);
 assert.equal(await page.inputValue('#key'),'');
 const pageSource = require('node:fs').readFileSync('extension/page.js','utf8');
 const checks = await page.evaluate(source => {
  const frame=document.getElementById('fixture'), doc=frame.contentDocument;
  frame.contentWindow.eval(source);
  const act=frame.contentWindow.interactWithPage;
  const check = (html,answer,expected) => {
   doc.body.innerHTML=html;
   // Application intentionally extracts fresh DOM even before observer delivery.
   const headings=[...doc.querySelectorAll('h1')].map(el=>el.textContent);
   frame.contentWindow.__mintiState.dirty=true;
   const snapshot=act('read');
   try {act('apply',{fingerprint:snapshot.fingerprint,answer});return expected==='success';}
   catch(error) {return error.message.includes(expected);}
  };
  return [
   check('<h1>Choose?</h1><label><input type="radio">4</label><label><input type="radio">4</label>','4','unique matching'),
   check('<h1>Choose?</h1><label><input type="radio" disabled>4</label>','4','disabled'),
   check('<h1>Choose?</h1><label><input type="checkbox">4</label>','4','manual selection'),
   check('<h1>Write?</h1><textarea></textarea>','hello','success') && doc.querySelector('textarea').value==='hello',
   check('<h1>Choose?</h1><span id="label">4</span><div role="radio" aria-labelledby="label"></div>','4','success'),
   check('<h1>Choose?</h1><label><input type="radio" style="display:none">4</label>','4','success'),
  ];
 },pageSource);
 assert.ok(checks.every(Boolean),'Page edge-case checks failed: '+JSON.stringify(checks));
 await page.evaluate(()=>{delete window.chrome;});
 // Preview path is tested in a clean browser context without the mock.
 const preview=await browser.newPage(); const previewErrors=[];preview.on('pageerror',e=>previewErrors.push(e.message));
 await preview.goto('file://'+path.resolve('extension/popup.html'));
 await preview.waitForFunction(()=>document.getElementById('status').textContent.includes('Preview only'));
 assert.equal(await preview.isDisabled('#ask'),true);
 assert.deepEqual(errors,[]);assert.deepEqual(previewErrors,[]);
 console.log(`PASS: read, AI request, apply, cache, stale-question rejection, cancellation, API error recovery, file preview, duplicate/disabled/multiple choices, text filling, ARIA labels, hidden labeled inputs, copy, manual cancel, tab-switch recovery, side-panel dispatch, clear key. New-question detection + mocked AI: ${elapsed}ms.`);
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
