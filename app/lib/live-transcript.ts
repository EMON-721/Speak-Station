// Render interim words even before the first final recognition result.
export function recognizedText(event:any){
 let final='',interim='';
 for(let i=0;i<event.results.length;i++){
  const text=event.results[i]?.[0]?.transcript||'';
  if(event.results[i].isFinal)final+=(final?' ':'')+text;
  else interim+=(interim?' ':'')+text;
 }
 return {final,interim};
}
// Each snapshot is a complete WAV, not an unplayable slice of a WebM container.
export function pcmWave(blocks:Float32Array[],rate=16000){
 const count=blocks.reduce((n,b)=>n+b.length,0),bytes=new ArrayBuffer(44+count*2),view=new DataView(bytes);
 const text=(offset:number,s:string)=>{for(let i=0;i<s.length;i++)view.setUint8(offset+i,s.charCodeAt(i))};
 text(0,'RIFF');view.setUint32(4,36+count*2,true);text(8,'WAVEfmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,count*2,true);
 let at=44;for(const block of blocks)for(const value of block){const sample=Math.max(-1,Math.min(1,value));view.setInt16(at,sample<0?sample*32768:sample*32767,true);at+=2;}
 return new Blob([bytes],{type:'audio/wav'});
}
export async function captureTranscriptAudio(media:MediaStream,isPaused:()=>boolean){
 const Audio=(window as any).AudioContext||(window as any).webkitAudioContext;if(!Audio)return null;
 const context:AudioContext=new Audio({sampleRate:16000});
 try{
  await context.resume();const source=context.createMediaStreamSource(media),processor=context.createScriptProcessor(4096,1,1),silent=context.createGain();silent.gain.value=0;const blocks:Float32Array[]=[];let samples=0;
  processor.onaudioprocess=event=>{if(isPaused()||samples>=16000*181)return;const input=event.inputBuffer.getChannelData(0),ratio=context.sampleRate/16000,out=new Float32Array(Math.floor(input.length/ratio));for(let i=0;i<out.length;i++)out[i]=input[Math.min(input.length-1,Math.floor(i*ratio))];blocks.push(out);samples+=out.length;};
  source.connect(processor);processor.connect(silent);silent.connect(context.destination);
  return {snapshot:()=>pcmWave(blocks),close:()=>{processor.onaudioprocess=null;source.disconnect();processor.disconnect();silent.disconnect();void context.close().catch(()=>{});}};
 }catch(error){void context.close().catch(()=>{});throw error;}
}
