/* GCMBS HF84 — reparo defensivo de UTF-8/mojibake e branding. Somente apresentação. */
(()=>{
'use strict';
const root=document.documentElement;if(root.dataset.gc84Utf8==='1')return;root.dataset.gc84Utf8='1';
const suspicious=/Ã|Â|â(?:€|„|€“|€”|€™|œ|˜)|ðŸ|ï¿½|�/;
const score=s=>{s=String(s??'');let n=0;for(const m of s.matchAll(/Ã|Â|â.|ðŸ|ï¿½|�/g))n+=m[0]==='Â'?2:3;return n};
function latin1ToUtf8(s){try{const bytes=Uint8Array.from(String(s),c=>c.charCodeAt(0)&255);return new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{return s}}
function fix(v){let s=String(v??'');if(!suspicious.test(s))return s;let best=s,bestScore=score(s);for(let i=0;i<3;i++){const next=latin1ToUtf8(best),ns=score(next);if(next===best||ns>=bestScore)break;best=next;bestScore=ns}return best.replace(/Â(?=[·ºª°])/g,'').replace(/â€“/g,'–').replace(/â€”/g,'—').replace(/â€™/g,'’')}
function textNode(n){if(!n?.nodeValue||!suspicious.test(n.nodeValue))return;const x=fix(n.nodeValue);if(x!==n.nodeValue)n.nodeValue=x}
function brandImage(img){const sig=[img.id,img.className,img.alt].join(' ');if(!/GCMBS|loginIcone|headerIcone|brand|crest/i.test(sig)||img.dataset.gc84Brand==='1')return;img.dataset.gc84Brand='1';const fallback=()=>{if(!/brasao-gcmbs\.png(?:\?|$)/.test(img.src)){img.src='brasao-gcmbs.png?v=100084';img.style.display=''}};img.addEventListener('error',fallback);if(!img.getAttribute('src')||/icon\.png(?:\?|$)/.test(img.getAttribute('src')))img.src='brasao-gcmbs.png?v=100084'}
function element(el){if(!el||el.nodeType!==1)return;['title','aria-label','placeholder','alt'].forEach(a=>{const v=el.getAttribute?.(a);if(v&&suspicious.test(v))el.setAttribute(a,fix(v))});if(el.tagName==='IMG')brandImage(el)}
function scan(node=document.body){if(!node)return;if(node.nodeType===3){textNode(node);return}element(node);const w=document.createTreeWalker(node,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);let n;while((n=w.nextNode()))n.nodeType===3?textNode(n):element(n)}
function apply(){scan(document.body);document.querySelectorAll('img').forEach(brandImage)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
let queued=false;new MutationObserver(ms=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;for(const m of ms){m.addedNodes.forEach(scan);if(m.type==='characterData')textNode(m.target)}document.querySelectorAll('img').forEach(brandImage)})}).observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','placeholder','alt','src']});
window.GCMBS_FIX_TEXT=fix;
})();
