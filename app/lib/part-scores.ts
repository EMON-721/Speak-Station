import type {Question} from './questions';
import type {PracticeReceipt} from './practice-receipts';

// Final result uses all three completed parts equally (instead of rewarding
// whichever part happens to contain the most short questions).
export function summarizeSpeakingParts(receipts:PracticeReceipt[],questions:Question[],threshold=6.5){
 const byId=new Map(receipts.map(r=>[r.questionId,r]));
 const partScores:Record<number,number|null>={};
 const criterionParts:number[][]=[[],[],[],[]];
 for(const part of [1,2,3]){
  const group=questions.filter(q=>q.part===part);
  const values=group.map(q=>byId.get(q.id)?.scores);
  if(!group.length||values.some(v=>!v||v.some(c=>typeof c!=='number'||!Number.isFinite(c)))){
   partScores[part]=null;continue;
  }
  const perCriterion=[0,1,2,3].map(i=>Math.round(values.reduce((sum,v)=>sum+(v?.[i]||0),0)/group.length*2)/2);
  perCriterion.forEach((v,i)=>criterionParts[i].push(v));
  partScores[part]=Math.round(perCriterion.reduce((sum,v)=>sum+v,0)/4*2)/2;
 }
 const complete=[1,2,3].every(p=>partScores[p]!==null);
 const band=complete?Math.round([1,2,3].reduce((sum,p)=>sum+(partScores[p]||0),0)/3*2)/2:null;
 const criteria=Object.fromEntries(['fluency','lexical','grammar','pronunciation'].map((k,i)=>[k,complete?Math.round(criterionParts[i].reduce((a,b)=>a+b,0)/3*2)/2:null]));
 return {band,partScores,criteria,passed:band!==null&&band>=threshold,threshold,answers:receipts.length,label:'Unverified AI practice estimate',message:complete?(band!>=threshold?'Practice pass threshold met.':'Review your weaker parts and try again.'):'Insufficient clear audio evidence to score all three speaking parts.'};
}
