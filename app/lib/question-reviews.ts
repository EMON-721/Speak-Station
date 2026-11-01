export type PartQuestionReview={
 questionId:string;
 questionText:string;
 transcript:string;
 transcriptSource:'audio'|'browser'|'unavailable';
 correctedAnswer:string|null;
 improvedAnswer:string|null;
 comment:string|null;
 corrections:{original:string;corrected:string;explanation:string;category:string}[];
};
type ExpectedQuestion={question:{id:string;text:string};transcript:string};
const asText=(value:unknown,max=6000):string=>typeof value==='string'?value.trim().slice(0,max):'';
export function normalizePartQuestionReviews(raw:unknown,expected:ExpectedQuestion[]):PartQuestionReview[]{
 const values=Array.isArray(raw)?raw:[];
 const byId=new Map<string,Record<string,unknown>>();
 const ids=new Set(expected.map(item=>item.question.id));
 for(const candidate of values){
  if(!candidate||typeof candidate!=='object'||Array.isArray(candidate))continue;
  const record=candidate as Record<string,unknown>;
  const id=asText(record.questionId,120);
  // Never infer a correspondence from array index or match a different question.
  if(!ids.has(id)||byId.has(id))continue;
  byId.set(id,record);
 }
 return expected.map(({question,transcript})=>{
  const found=byId.get(question.id);
  const audioTranscript=asText(found?.transcript);
  const browserTranscript=asText(transcript);
  const corrections=Array.isArray(found?.corrections)?found.corrections.slice(0,12).flatMap(item=>{
   if(!item||typeof item!=='object'||Array.isArray(item))return [];
   const value=item as Record<string,unknown>;
   const original=asText(value.original,1200),corrected=asText(value.corrected,1200),explanation=asText(value.explanation,2000);
   return original&&corrected?[{original,corrected,explanation,category:asText(value.category,80)||'Grammar / expression'}]:[];
  }):[];
  return {
   questionId:question.id,questionText:question.text,
   transcript:audioTranscript||browserTranscript,
   transcriptSource:audioTranscript?(found?.transcriptSource==='browser'?'browser':'audio'):browserTranscript?'browser':'unavailable',
   correctedAnswer:asText(found?.correctedAnswer)||null,
   improvedAnswer:asText(found?.improvedAnswer)||null,
   comment:asText(found?.comment,1800)||null,
   corrections
  };
 });
}
