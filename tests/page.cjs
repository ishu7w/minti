const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
let heading = '', fields = [], controls = [], clicks = 0;
const element = (text,attributes={}) => ({innerText:text,name:attributes.name||'',id:attributes.id||'',getClientRects:()=>[{}],getAttribute:key=>attributes[key]||null,closest:()=>null,click:()=>clicks++});
const context = {
 window:{addEventListener(){}}, MutationObserver:class {observe(){}},
 document:{documentElement:{},addEventListener(){},getElementById:()=>null,querySelectorAll:selector=>selector.startsWith('h1')?[element(heading)]:selector.startsWith('input[type="radio"]')?controls:fields},
 getComputedStyle:()=>({visibility:'visible'})
};
vm.createContext(context);vm.runInContext(fs.readFileSync('extension/page.js','utf8'),context);
const read = () => {if(context.window.__mintiState)context.window.__mintiState.dirty=true;return context.interactWithPage('read');};
heading='Enter the code to join'; fields=[element('',{'aria-label':'Please enter the 7 or 8 digit code'})];
assert.equal(read().question,'');
heading='Waiting for the presenter'; fields=[];assert.equal(read().question,'');
heading='Get ready';controls=[element('4',{'aria-label':'4'})];assert.equal(read().question,'');
heading='What is 2 + 2?';fields=[];controls=['3','4'].map(value=>element(value,{'aria-label':value}));
const snapshot=read();assert.equal(snapshot.question,heading);
context.interactWithPage('apply',{fingerprint:snapshot.fingerprint,answer:'4'});assert.equal(clicks,1);
assert.throws(()=>context.interactWithPage('apply',{fingerprint:snapshot.fingerprint,answer:'5'}),/unique matching/);
heading='Next question?';assert.throws(()=>context.interactWithPage('apply',{fingerprint:snapshot.fingerprint,answer:'4'}),/question changed/);
controls=[];heading='What is your favorite color?';fields=[element('',{'aria-label':'Answer'})];assert.equal(read().question,heading);
heading='Marketing page';fields=[];assert.equal(read().question,'');
// Larger sequential workload: long Unicode questions and 12 labeled options.
for(let n=0;n<100;n++) {
 heading=`Case ${n}: ${'Consider the evidence, constraints, and possible outcomes. '.repeat(30)}Which option is correct? 日本語 — café`;
 controls=Array.from({length:12},(_,i)=>element(`Option ${i}: ${'Detailed explanation '.repeat(12)}`,{'aria-label':`Option ${i}: ${'Detailed explanation '.repeat(12)}`}));
 const current=read();
 assert.equal(current.question,heading);assert.equal(current.choices.length,12);
 const before=clicks;
 context.interactWithPage('apply',{fingerprint:current.fingerprint,answer:current.choices[n%12]});
 assert.equal(clicks,before+1);
 heading+=' changed';
 assert.throws(()=>context.interactWithPage('apply',{fingerprint:current.fingerprint,answer:current.choices[0]}),/question changed/);
}
controls=[element('Same'),element('Same')];fields=[];heading='Choose one?';
const duplicate=read();assert.throws(()=>context.interactWithPage('apply',{fingerprint:duplicate.fingerprint,answer:'Same'}),/unique matching/);
controls=[];fields=[element('',{placeholder:'Name the capital of France'})];heading='What is the capital of France?';
assert.equal(read().question,heading,'Answer prompts containing name must not be treated as join fields');
console.log('PASS: join screen, waiting screen, get-ready screen, question extraction, selection, unmatched/stale answer rejection, open text question, non-question page.');
console.log('PASS: 100 long Unicode questions, 12 choices each, 100 selections and stale rejections, duplicate choices, name answer prompt.');
