// Runtime smoke test: renders every page in Guest Mode with jsdom, clicks through the tabs and flows,
// and reports crashes or NaN/undefined in the output.  Run with:  npm run smoke
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
const PROJ=process.cwd();
const req=createRequire(PROJ+'/package.json');

// ---- browser-like globals
const dom=new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:'https://localhost/',pretendToBeVisual:true});
const w=dom.window;
const define=(k,v)=>Object.defineProperty(globalThis,k,{value:v,configurable:true,writable:true});
for (const k of ['window','document','navigator','localStorage','sessionStorage','HTMLElement','Element','Node','MutationObserver','CustomEvent','Event','KeyboardEvent','MouseEvent','getComputedStyle','requestAnimationFrame','cancelAnimationFrame','DOMParser','File','Blob','FileReader','HTMLInputElement','SVGElement','Image']) {
  try { define(k, k==='window'?w:k==='document'?w.document:w[k]); } catch {}
}
globalThis.window=w; w.confirm=()=>false; w.alert=()=>{}; w.scrollTo=()=>{}; w.HTMLElement.prototype.scrollIntoView=()=>{};
class RO{observe(){}unobserve(){}disconnect(){}}; define('ResizeObserver',RO); w.ResizeObserver=RO;
w.matchMedia=w.matchMedia||(q=>({matches:false,media:q,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
define('matchMedia',w.matchMedia); define('IntersectionObserver',class{observe(){}unobserve(){}disconnect(){}}); w.IntersectionObserver=globalThis.IntersectionObserver;
w.URL.createObjectURL=()=>'blob:x'; w.URL.revokeObjectURL=()=>{};
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const errors=[]; 
w.addEventListener('error',e=>errors.push('window.error: '+(e.error?.message||e.message)));
const origErr=console.error; console.error=(...a)=>{const m=a.map(x=>typeof x==='string'?x:(x?.message||'')).join(' '); if(/@firebase|Could not reach|UNAVAILABLE|Name resolution|auth\/network|ERR_|fetch failed/.test(m)) return; if(/Error:|is not defined|Cannot read|undefined|is not a function|The above error/.test(m)&&!/act\(|not wrapped in act|ReactDOMTestUtils/.test(m)) errors.push('console.error: '+m.slice(0,300));};
// silence noisy network/firebase logs
const origLog=console.log; console.log=()=>{}; console.warn=()=>{};

// ---- vite ssr loader (handles TS/TSX, aliases, css)
const { createServer } = await import(PROJ+'/node_modules/vite/dist/node/index.js');
const vite = await createServer({ root: PROJ, configFile: PROJ+'/vite.config.ts', server:{middlewareMode:true,hmr:false,ws:false}, appType:'custom', logLevel:'silent', optimizeDeps:{noDiscovery:true,include:[]} });
const React=req('react'); const { createRoot }=req('react-dom/client'); const { act }=req('react');
const ds=await vite.ssrLoadModule('/services/dataService.ts');
ds.setGuestMode(true);

const load=async p=>vite.ssrLoadModule(p);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const results=[];
async function mount(name,Comp,props={}){
  const before=errors.length;
  w.document.body.innerHTML='<div id="root"></div>';
  const root=createRoot(w.document.getElementById('root'));
  let status='ok';
  try{
    await act(async()=>{ root.render(React.createElement(Comp,props)); });
    await act(async()=>{ await sleep(400); });
    const clicked=[];
    return {root,before,name,clicked};
  }catch(e){ results.push({name,status:'RENDER CRASH',detail:(e.message||String(e)).slice(0,260)}); try{root.unmount()}catch{}; return null; }
}
async function clickTabs(ctx,labels){
  const {name}=ctx; 
  for (const label of labels){
    const btn=[...w.document.querySelectorAll('button')].find(b=>b.textContent.replace(/\s+/g,' ').trim().toLowerCase().includes(label.toLowerCase()));
    if(!btn){ results.push({name:`${name} › ${label}`,status:'tab not found'}); continue; }
    const b4=errors.length;
    try{ await act(async()=>{ btn.dispatchEvent(new w.MouseEvent('click',{bubbles:true})); }); await act(async()=>{ await sleep(120); }); }
    catch(e){ results.push({name:`${name} › ${label}`,status:'CRASH',detail:(e.message||String(e)).slice(0,260)}); 
      // remount page for following tabs
      return false; }
    const text=w.document.getElementById('root').textContent||'';
    const bad=/NaN|Infinity|undefined/.test(text) ? 'TEXT HAS NaN/Infinity/undefined' : 'ok';
    results.push({name:`${name} › ${label}`,status:errors.length>b4?'ERRORS':bad,detail:errors.slice(b4).join(' | ').slice(0,260)||(bad!=='ok'?(text.match(/.{0,40}(NaN|Infinity|undefined).{0,40}/)||[''])[0]:'')});
  }
  return true;
}
async function page(name,path,exp,props,tabs=[]){
  const mod=await load(path); const Comp=exp==='default'?mod.default:mod[exp];
  if(!Comp){ results.push({name,status:'EXPORT MISSING'}); return; }
  const ctx=await mount(name,Comp,props); if(!ctx) return;
  const text=w.document.getElementById('root').textContent||'';
  const bad=/NaN|Infinity|undefined/.test(text)?'TEXT HAS NaN/Infinity/undefined':'ok';
  results.push({name,status:errors.length>ctx.before?'ERRORS':(text.length<30?'EMPTY':bad),detail:errors.slice(ctx.before).join(' | ').slice(0,300)||(bad!=='ok'?(text.match(/.{0,40}(NaN|Infinity|undefined).{0,40}/)||[''])[0]:'')+` (${text.length} chars)`});
  if((process.env.DUMP||'').split(',').includes(name)){ origLog('--- '+name+' TEXT: '+text.slice(0,500)); origLog('--- BUTTONS: '+[...w.document.querySelectorAll('button')].map(b=>b.textContent.replace(/\s+/g,' ').trim()).filter(Boolean).join(' | ').slice(0,600)); }
  if(tabs.length) await clickTabs(ctx,tabs);
  try{ctx.root.unmount()}catch{}
}
const lang='en', setView=()=>{};
await page('Dashboard','/components/DashboardPage.tsx','default',{setView,lang,userLevel:1},['Log a spend','Add investments']);
await page('Spend & Save','/components/BudgetPage.tsx','default',{lang},['Check my spending','Log it','New category','Money In','Bills','Import','Spends']);
await page('Investments','/components/PortfolioPage.tsx','default',{lang},['Check my portfolio','Mutual Fund','Stock','All','New Entry','Sync Prices','Smart Sync','All Assets']);
await page('Goals','/components/GoalsPage.tsx','default',{lang},['Set New Goal','FIRE Sim','Active Goals']);
await page('Reports','/components/ReportsPage.tsx','ReportsPage',{lang});
await page('Loans','/components/Pages.tsx','LoansPage',{},['EMI Calc','Prepayment','Strategy','Add','My Loans']);
await page('Insurance','/components/Pages.tsx','InsurancePage',{},['HLV Calc','Add Policy','My Policies']);
await page('Calculators','/components/Pages.tsx','CalculatorsPage',{},['Step-up','Lumpsum','Hybrid','Goal SIP','FIRE','SWP','Inflation','Buy vs Rent','Luxury Delay','FD','Old vs New Tax','SIP']);
await page('Marketing Studio','/components/MarketingStudio.tsx','MarketingStudio',{});

{ // AI built without an AI key: must fail fast with a friendly message, never hit the network
  const gs=await load('/services/geminiService.ts');
  const notices=[]; w.addEventListener('ai-notice',e=>notices.push(e.detail));
  const chat=await gs.getFinancialAdvice('hi',{investments:[],budgets:[],loans:[]},'en');
  results.push({name:'AI (no key) › chat explains',status:/isn't available in this version/.test(chat)?'ok':'FAIL',detail:chat.slice(0,80)});
  const rows=await gs.extractStatementTransactions('Date Desc Amount');
  results.push({name:'AI (no key) › import returns [] + notice',status:Array.isArray(rows)&&rows.length===0&&notices.some(n=>/not available/.test(n))?'ok':'FAIL',detail:notices.join('|').slice(0,80)});
}
console.log=origLog;
for(const r of results) console.log((r.status==='ok'?'PASS ':'FAIL ')+r.name.padEnd(30)+r.status+(r.detail?'  '+r.detail:''));
console.log('\nunique errors captured:',[...new Set(errors)].length);
for(const e of [...new Set(errors)].slice(0,12)) console.log(' -',e.slice(0,240));
await vite.close(); process.exit(0);
