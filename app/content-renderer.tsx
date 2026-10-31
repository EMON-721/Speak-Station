'use client';
import {Children,cloneElement,isValidElement,type ReactNode} from 'react';
import {type SiteContent} from './lib/content';
function hash(s:string){let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return (h>>>0).toString(36);}
export function contentTree(node:ReactNode,content:SiteContent,path='root'):ReactNode{
 const text=(v:string)=>{const key=v.trim().replace(/\s+/g,' ');return Object.prototype.hasOwnProperty.call(content.copy,key)?v.replace(v.trim(),content.copy[key]):v;};
 if(typeof node==='string')return text(node.replace(/[\u0980-\u09ff]+(?:[ \t]+[\u0980-\u09ff]+)*/g,'[non-English text]'));if(Array.isArray(node))return node.map((n,i)=>contentTree(n,content,path+'.'+i));if(!isValidElement(node))return node;
 const p=node.props as any;if(p['data-cms-skip'])return node;
 if(p.id&&content.hiddenSections.includes(p.id))return null;
 const key='b'+hash(path+':'+(p.id||p.className||String(node.type)));const protectedElement=['header','footer','main'].includes(String(node.type))||['app-shell homepage-shell','main-shell'].includes(p.className);if(!protectedElement&&content.hiddenBlocks.includes(key))return null;
 const props:any={};for(const name of ['title','text','placeholder','aria-label'])if(typeof p[name]==='string')props[name]=text(p[name]);
 if(p.children!==undefined)props.children=Children.map(p.children,(child,i)=>contentTree(child,content,path+'.'+i));
 if(!protectedElement&&typeof node.type==='string'&&!['svg','path','circle','line','polyline','rect','input','textarea','select','option'].includes(node.type)){props['data-cms-block']=key;if(p.id&&content.sectionOrder.includes(p.id))props.style={...p.style,order:content.sectionOrder.indexOf(p.id)};}
 return cloneElement(node,props);
}
