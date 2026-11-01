import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {createRequire} from 'node:module';

const nativeRequire=createRequire(import.meta.url);
const cache=new Map();
export function loadTs(file){
 const full=path.resolve(file);
 if(cache.has(full))return cache.get(full).exports;
 const m={exports:{}};
 cache.set(full,m);
 const src=fs.readFileSync(full,'utf8');
 const js=ts.transpileModule(src,{fileName:full,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,resolveJsonModule:true}}).outputText;
 const requireRelative=(source)=>{
  if(!source.startsWith('.'))return nativeRequire(source);
  const target=path.resolve(path.dirname(full),source);
  if(fs.existsSync(target+'.ts'))return loadTs(target+'.ts');
  if(fs.existsSync(target+'.tsx'))return loadTs(target+'.tsx');
  if(target.endsWith('.json')&&fs.existsSync(target))return JSON.parse(fs.readFileSync(target,'utf8'));
  if(fs.existsSync(target+'.json'))return JSON.parse(fs.readFileSync(target+'.json','utf8'));
  if(fs.existsSync(target))return loadTs(target);
  throw Error('Cannot load '+source+' from '+file);
 };
 new Function('require','module','exports','__filename','__dirname',js)(requireRelative,m,m.exports,full,path.dirname(full));
 return m.exports;
}
