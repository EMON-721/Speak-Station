import type {Question} from './questions';

export type SpeakingBook={id:string;number:number;title:string;topic:string;questions:Question[]};
export const SPEAKING_BOOK_TARGET=240;

// Group only once. This runs both in the browser and in Cloudflare Workers;
// avoid repeatedly filtering thousands of questions for every book.
export function buildSpeakingBooks(source:Question[],limit=SPEAKING_BOOK_TARGET):SpeakingBook[]{
 const groups=new Map<string,{p1:Question[];p2:Question[];p3:Question[]}>();
 for(const question of source){
  if(question.part!==1&&question.part!==2&&question.part!==3)continue;
  let group=groups.get(question.topic);
  if(!group){group={p1:[],p2:[],p3:[]};groups.set(question.topic,group)}
  if(question.part===1)group.p1.push(question);
  else if(question.part===2)group.p2.push(question);
  else group.p3.push(question);
 }
 const topics=[...groups].filter(([,g])=>g.p1.length>=4&&g.p2.length>=1&&g.p3.length>=6);
 if(!topics.length)return [];
 return Array.from({length:limit},(_,index)=>{
  const [topic,group]=topics[index%topics.length];
  const cycle=Math.floor(index/topics.length);
  const take=(arr:Question[],count:number,offset:number)=>Array.from({length:count},(_,i)=>arr[(offset+i)%arr.length]);
  const questions=[...take(group.p1,4,cycle*4),group.p2[cycle%group.p2.length],...take(group.p3,6,cycle*6)];
  const number=index+1;
  return {id:'SSB-'+String(number).padStart(3,'0'),number,title:'Speaking Book '+String(number).padStart(3,'0')+' · '+topic,topic,questions};
 });
}
