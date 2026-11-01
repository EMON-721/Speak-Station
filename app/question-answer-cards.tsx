'use client';
import {Copy,Volume2} from 'lucide-react';
import type {PartQuestionReview} from './lib/question-reviews';

export function QuestionAnswerCards({answers,onSpeak,onCopy,compact=false}:{
 answers:PartQuestionReview[];
 onSpeak?:(text:string)=>void;
 onCopy?:(text:string)=>void;
 compact?:boolean;
}){
 return <div className={compact?'question-answer-cards compact':'question-answer-cards'} data-cms-skip>
  {answers.map((entry,index)=><article className="question-answer-card" key={entry.questionId}>
   <div className="question-answer-title"><span className="question-answer-number">Question {index+1}</span><h3>{entry.questionText}</h3></div>
   <div className="question-answer-pair">
    <section className="question-answer-original"><h4>Your original answer</h4>
     <p>{entry.transcript||'No reliable transcript was available for this recording.'}</p>
     {entry.transcriptSource==='browser'&&<small>Browser speech recognition transcript; the words may contain errors.</small>}
    </section>
    <section className="question-answer-corrected"><h4>Your corrected answer</h4>
     <p>{entry.correctedAnswer||'A reliable question-specific correction was not returned. Your original answer is shown separately; no correction has been invented.'}</p>
     {entry.correctedAnswer&&<div className="question-answer-actions">
      {onSpeak&&<button type="button" onClick={()=>onSpeak(entry.correctedAnswer!)}><Volume2 size={15}/>Listen</button>}
      {onCopy&&<button type="button" onClick={()=>onCopy(entry.correctedAnswer!)}><Copy size={15}/>Copy</button>}
     </div>}
    </section>
   </div>
   {entry.comment&&<div className="question-answer-comment"><strong>AI feedback for Question {index+1}</strong><p>{entry.comment}</p></div>}
   {entry.corrections.length>0&&<details className="question-answer-corrections"><summary>Grammar and sentence corrections ({entry.corrections.length})</summary><div>{entry.corrections.map((c,i)=><p key={i}><strong>Original:</strong> {c.original} <strong>Corrected:</strong> {c.corrected}{c.explanation?' — '+c.explanation:''}</p>)}</div></details>}
   {entry.improvedAnswer&&<details className="question-answer-improved"><summary>More natural answer for this question</summary><p>{entry.improvedAnswer}</p></details>}
  </article>)}
 </div>;
}
