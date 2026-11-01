export type TestRecord={kind:string;milestone:number;answers?:string|Record<string,unknown>;completed_at?:string};
export const WEEKLY_PASS_BAND=6;
export const PRACTICE_COOLDOWN_DAYS=15;
export const TEMPORARY_AUDIO_HOURS=24;
export function testDetails(test:TestRecord){
 try{return typeof test.answers==='string'?JSON.parse(test.answers||'{}'):test.answers||{}}catch{return {}}
}
export function passedTest(test:TestRecord){
 const result=testDetails(test);
 const band=Number(result.practiceBand??result.overall??result.band);
 return result.passed===true&&Number.isFinite(band)&&band>=WEEKLY_PASS_BAND;
}
export function weeklyGate(tests:TestRecord[],kind:'weekly'|'revision',number:number):{unlocked:boolean;reason:string}{
 if(!Number.isInteger(number)||number<1)return {unlocked:false,reason:'Invalid exam number'};
 const has=(k:string,n:number)=>tests.some(t=>t.kind===k&&Math.ceil(t.milestone/(k==='weekly'?7:14))===n&&passedTest(t));
 if(kind==='revision'){
  if(!has('weekly',number*2))return {unlocked:false,reason:'Pass Weekly '+(number*2)+' with at least 6.0/9 first'};
  if(number>1&&!has('revision',number-1))return {unlocked:false,reason:'Complete Revision '+(number-1)+' first'};
  return {unlocked:true,reason:'Available after two passed weekly exams'};
 }
 if(number>1&&!has('weekly',number-1))return {unlocked:false,reason:'Pass Weekly '+(number-1)+' with at least 6.0/9 first'};
 if(number>2&&number%2===1&&!has('revision',(number-1)/2))return {unlocked:false,reason:'Mandatory Revision '+((number-1)/2)+' must be passed before Weekly '+number};
 return {unlocked:true,reason:'Ready for your next speaking exam'};
}
export function cooldownUntil(completedAt:string):string{
 return new Date(Date.parse(completedAt)+PRACTICE_COOLDOWN_DAYS*86400000).toISOString();
}
export function isCoolingDown(availableAt:string,now=new Date()):boolean{return Date.parse(availableAt)>now.getTime()}
