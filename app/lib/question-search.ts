import type {Question} from './questions';
export type ManagedQuestion=Question&{archived?:boolean};
const normalize=(value:string)=>value.normalize('NFKC').toLowerCase().replace(/[‘’]/g,"'").replace(/[“”]/g,'"');
export function filterQuestions(bank:ManagedQuestion[],query:string,topic='all',part='all',status='active'){
 const words=normalize(query).trim().split(/\s+/).filter(Boolean);
 return bank.filter(q=>{if(topic!=='all'&&q.topic!==topic)return false;if(part!=='all'&&q.part!==Number(part))return false;if(status==='active'&&q.archived)return false;if(status==='archived'&&!q.archived)return false;const text=normalize([q.id,q.text,q.topic,q.difficulty,q.objective,...q.cue||[],`part ${q.part}`,`part${q.part}`].join(' '));return words.every(w=>text.includes(w));});
}
export function questionPage(bank:ManagedQuestion[],page:number,size:number){const pages=Math.max(1,Math.ceil(bank.length/size)),current=Math.max(1,Math.min(pages,Math.floor(page)||1));return {items:bank.slice((current-1)*size,current*size),page:current,pages,total:bank.length,start:bank.length?(current-1)*size+1:0,end:Math.min(current*size,bank.length)};}
const accents=['#8fb8ae','#a5b7db','#b8a8cc','#ceae85','#c59fa9','#a9b690'];
export function topicAccent(name:string){let hash=0;for(const c of name)hash=(hash*31+c.charCodeAt(0))>>>0;return accents[hash%accents.length];}
