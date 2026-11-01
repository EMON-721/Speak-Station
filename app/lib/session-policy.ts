/** Rolling, server-timestamp based speaking session admission. No audio is stored here. */
export const PRACTICE_INTERVAL_MS=6*60*60*1000;
export const PRACTICE_DAY_MS=24*60*60*1000;
export const TEST_INTERVAL_MS=7*24*60*60*1000;
export const MAX_PRACTICES_PER_24H=3;
export const REQUIRED_WEEKLY_MODULES=2;
export type SessionRow={category:'practice'|'test';started_at:string};
export type ModuleRow={module:string;completed_at:string};
export type SessionGate={allowed:boolean;nextAt:string|null;reason:string;recentCount:number;modulesCompleted:number};
export function eligibility(category:'practice'|'test',sessions:SessionRow[],modules:ModuleRow[],at=new Date()):SessionGate {
 const instant=at.getTime();
 const isValid=(iso:string)=>Number.isFinite(Date.parse(iso))&&Date.parse(iso)<=instant;
 const times=sessions.filter(s=>s.category===category&&isValid(s.started_at)).map(s=>Date.parse(s.started_at)).sort((a,b)=>b-a);
 const duration=category==='practice'?PRACTICE_DAY_MS:TEST_INTERVAL_MS;
 const recent=times.filter(t=>t>instant-duration);
 const modulesCompleted=new Set(modules.filter(m=>isValid(m.completed_at)&&Date.parse(m.completed_at)>instant-TEST_INTERVAL_MS).map(m=>m.module)).size;
 let earliest=instant;
 let reason='';
 if(category==='practice'){
  if(times.length&&times[0]+PRACTICE_INTERVAL_MS>earliest){earliest=times[0]+PRACTICE_INTERVAL_MS;reason='Only one complete practice can start every six hours.'}
  if(recent.length>=MAX_PRACTICES_PER_24H&&recent[recent.length-MAX_PRACTICES_PER_24H]+PRACTICE_DAY_MS>earliest){earliest=recent[recent.length-MAX_PRACTICES_PER_24H]+PRACTICE_DAY_MS;reason='A maximum of three complete practices is allowed in any rolling 24 hours.'}
 }else{
  if(modulesCompleted<REQUIRED_WEEKLY_MODULES)return {allowed:false,nextAt:null,reason:'Complete two different speaking modules in the last seven days before starting a test.',recentCount:recent.length,modulesCompleted};
  if(times.length&&times[0]+TEST_INTERVAL_MS>earliest){earliest=times[0]+TEST_INTERVAL_MS;reason='Only one weekly, revision or book test can start every seven days.'}
 }
 return {allowed:earliest<=instant,nextAt:earliest>instant?new Date(earliest).toISOString():null,reason:earliest>instant?reason:'Ready to begin',recentCount:recent.length,modulesCompleted};
}
