
import type {Question} from './questions';

export type SpeakingBook={
 id:string;number:number;title:string;topic:string;questions:Question[];
};

export const SPEAKING_BOOK_TARGET=240;
export function buildSpeakingBooks(source:Question[],limit=SPEAKING_BOOK_TARGET):SpeakingBook[]{
 const topics=[...new Set(source.map(q=>q.topic))].filter(topic=>
  source.filter(q=>q.topic===topic&&q.part===1).length>=4 &&
  source.some(q=>q.topic===topic&&q.part===2) &&
  source.filter(q=>q.topic===topic&&q.part===3).length>=6);
 if(!topics.length)return [];
 return Array.from({length:limit},(_,index)=>{
  const topic=topics[index%topics.length],cycle=Math.floor(index/topics.length);
  const pool=(part:number)=>source.filter(q=>q.topic===topic&&q.part===part);
  const a=pool(1),b=pool(2),c=pool(3);
  const take=(arr:Question[],count:number,offset:number)=>Array.from({length:count},(_,i)=>arr[(offset+i)%arr.length]);
  const questions=[...take(a,4,cycle*4),b[cycle%b.length],...take(c,6,cycle*6)];
  const number=index+1;
  return {id:'SSB-'+String(number).padStart(3,'0'),number,title:'Speaking Book '+String(number).padStart(3,'0')+' · '+topic,topic,questions};
 });
}
