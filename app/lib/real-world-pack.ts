import type {Question} from './questions';

// Additional original, topic-specific IELTS-style practice pool.
// The same subject links Part 2 stories and Part 3 discussions, without claiming
// that any prompt is an official IELTS examination item.
const themes:readonly (readonly [string,string,string,string])[] = [["Libraries","libraries in your area","a library or reading room you visited","public access to books and learning spaces"],["Online reviews","reviews of products or services","an online review that influenced your decision","reliability of consumer reviews"],["Public speaking","speaking in front of groups","an occasion when you spoke to an audience","confidence and communication in public"],["Mentors","people who give you guidance","a person who offered you valuable guidance","mentorship in workplaces and education"],["Local markets","traditional markets near you","a memorable visit to a local market","the future of street markets"],["Craftsmanship","handmade products","a handmade object you admire","preserving craft skills"],["Shared spaces","spaces shared with other people","a shared space that you enjoy using","rules for shared public facilities"],["Customer service","dealing with customer support","a time someone helped you solve a service problem","consumer expectations and service quality"],["Work-life balance","balancing daily responsibilities","a time you managed several commitments","working hours and personal wellbeing"],["Digital payments","paying for things electronically","a time you used a new payment method","the move towards cashless payments"],["City design","buildings and streets in your city","an urban space that works especially well","designing inclusive cities"],["Repair and reuse","repairing rather than replacing things","an item you repaired or reused","repair culture and product lifespans"],["Community safety","how safe you feel in your neighbourhood","an occasion when neighbours helped one another","public safety and community trust"],["Sportsmanship","fair play in games and sports","an athlete or team that showed good sportsmanship","ethical conduct in competition"],["Personal boundaries","respecting other people's time and privacy","a time you politely said no to someone","privacy and mutual respect"],["Local storytelling","stories people tell in your community","a story you heard from an older person","keeping oral traditions alive"],["Learning from mistakes","how you respond to mistakes","a mistake that taught you something important","failure and resilience"],["Digital organization","managing files and notes on devices","a time an organization method helped you","digital habits and productivity"],["Public celebrations","events celebrated in your town","a public celebration that brought people together","community festivals and social ties"],["Travel planning","planning journeys in advance","a trip whose plans changed unexpectedly","technology and travel decisions"]];

export const freshTopics = themes.map(t=>t[0]);

export const realWorldPack:Question[]=themes.flatMap(([topic,personal,cue,discussion],ti)=>{
 const prefix='RW-'+String(ti+1).padStart(2,'0');
 const personalPrompts=[
  'How often do you think about '+personal+'?',
  'What do you like most about '+personal+'?',
  'Did '+personal+' matter to you when you were younger?',
  'Has your opinion about '+personal+' changed recently?',
  'Who do you usually discuss '+personal+' with?',
  'What is one thing you would improve about '+personal+'?',
  'Do people around you have similar experiences of '+personal+'?',
  'Can you remember a surprising experience related to '+personal+'?'
 ];
 const cuePrompts=[
  'Describe '+cue+'.',
  'Describe a situation in which you learned something new about '+personal+'.',
  'Describe someone whose experience of '+personal+' impressed you.'
 ];
 const discussionPrompts=[
  'Why might '+discussion+' matter more now than in the past?',
  'How can communities encourage better '+discussion+'?',
  'What are the advantages and disadvantages of greater attention to '+discussion+'?',
  'Do younger and older generations view '+discussion+' differently?',
  'What impact might technology have on '+discussion+'?',
  'Who should be responsible for improving '+discussion+'?',
  'How would you measure whether '+discussion+' has improved?',
  'How might '+discussion+' change over the next twenty years?'
 ];
 function question(part:1|2|3,index:number,text:string):Question{
  const id=prefix+'-P'+part+'-'+String(index+1).padStart(2,'0');
  return {
   id,part,topic,text,
   difficulty:part===1?'Foundation':part===2?'Intermediate':'Advanced',
   duration:part===1?45:part===2?120:90,
   cue:part===2?['What happened and when','Who was involved','What you noticed or learned','Explain how you felt and why it matters']:undefined,
   objective:part===1?'Answer naturally with an example.':part===2?'Tell a connected story covering every cue point.':'Discuss causes, outcomes and different perspectives.',
   related:[prefix+'-P1-01',prefix+'-P3-01']
  };
 }
 return [
  ...personalPrompts.map((text,i)=>question(1,i,text)),
  ...cuePrompts.map((text,i)=>question(2,i,text)),
  ...discussionPrompts.map((text,i)=>question(3,i,text))
 ];
});
