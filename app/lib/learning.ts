import {passedTest,type TestRecord} from './weekly-policy';
export function nextStage(completed:number[],tests:TestRecord[],track=210,schedule?:{kind:string;day:number}[]){
 let next=1;const completedSet=new Set(completed);
 while(completedSet.has(next))next++;
 const previous=next-1;
 if(previous>0){
  const weeklyDue=schedule?schedule.some(e=>e.day===previous&&e.kind==='weekly'):previous%7===0;
  const revisionDue=schedule?schedule.some(e=>e.day===previous&&e.kind==='revision'):previous%14===0;
  if(weeklyDue&&!tests.some(t=>t.kind==='weekly'&&t.milestone===previous&&passedTest(t)))return {type:'weekly',day:previous};
  if(revisionDue&&!tests.some(t=>t.kind==='revision'&&t.milestone===previous&&passedTest(t)))return {type:'revision',day:previous};
 }
 if(next>track)return {type:'complete',day:track};
 return {type:'daily',day:next};
}
export function streak(dates:string[],today=new Date()){const set=new Set(dates.map(d=>new Date(d).toLocaleDateString('en-CA',{timeZone:'Asia/Dhaka'})));let n=0;const day=new Date(today);if(!set.has(day.toLocaleDateString('en-CA',{timeZone:'Asia/Dhaka'})))day.setDate(day.getDate()-1);while(set.has(day.toLocaleDateString('en-CA',{timeZone:'Asia/Dhaka'}))){n++;day.setDate(day.getDate()-1);}return n;}
