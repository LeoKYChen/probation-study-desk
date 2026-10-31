(()=>{
"use strict";
/* Study Island v4 — original, local-first miniature life simulation. No access to other app modules. */
const W=20,H=16,TODAY=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");};
const $=id=>document.getElementById(id);
const canvas=$("world"),ctx=canvas.getContext("2d");
const RES={shell:{icon:"🐚",name:"貝殼"},wood:{icon:"🪵",name:"木材"},leaf:{icon:"🍃",name:"葉子"},fruit:{icon:"🍎",name:"果實"}};
const ITEMS={bench:{icon:"🪑",name:"木椅",needs:{wood:2,leaf:1}},flower:{icon:"🌷",name:"花圃",needs:{leaf:2,wood:1}},lamp:{icon:"🏮",name:"小燈籠",needs:{shell:3,wood:1}}};
const NAMES={fox:"栗子",bear:"阿棕",rabbit:"小白",owl:"墨墨"};
const NPCS=[
 {id:"fox",x:6,y:8,color:"#dda274",dialogues:["你找到小樹灣了！我喜歡把複雜的問題拆成小小一段。","今天的少年事件處理法，先記住一個核心爭點就很好。"]},
 {id:"bear",x:13,y:8,color:"#b98c68",dialogues:["我叫阿棕！樹下有一些木材，可以拿去工坊製作。","犯罪學有好多理論呀，試著想想它們各自想解釋什麼。"]},
 {id:"rabbit",x:5,y:11,color:"#ffebe0",dialogues:["好天氣！我最喜歡花圃，你也能製作一個喔。","心理學的名詞，配合生活例子就比較好理解。"]},
 {id:"owl",x:14,y:10,color:"#9cbac1",dialogues:["晚上也有月亮相伴，記得讓眼睛休息。","訂正不是懲罰，是給未來的自己留下路標。"]}
];
const RESOURCE_SPOTS=[
 {id:"shell-1",type:"shell",x:2,y:12},{id:"shell-2",type:"shell",x:3,y:13},{id:"shell-3",type:"shell",x:17,y:12},
 {id:"shell-4",type:"shell",x:16,y:14},{id:"wood-1",type:"wood",x:4,y:6},{id:"wood-2",type:"wood",x:15,y:7},
 {id:"wood-3",type:"wood",x:14,y:12},{id:"leaf-1",type:"leaf",x:5,y:6},{id:"leaf-2",type:"leaf",x:12,y:6},
 {id:"leaf-3",type:"leaf",x:16,y:11},{id:"fruit-1",type:"fruit",x:6,y:5},{id:"fruit-2",type:"fruit",x:16,y:8}
];
const TREES=[[3,4],[4,4],[5,4],[4,5],[14,5],[16,5],[17,6],[3,9],[16,10],[17,9],[6,3],[13,3]];
const POND=[[15,3],[16,3],[15,4],[16,4]];
const house=(x,y)=>x>=8&&x<=11&&y>=2&&y<=5;
const tileKey=(x,y)=>x+","+y;
function defaultSave(){return {id:"main",version:4,created:TODAY(),name:"小樹灣",outfit:0,coins:0,xp:0,player:{x:9,y:9},bag:{shell:0,wood:0,leaf:0,fruit:0},furniture:{bench:1,flower:0,lamp:0},placed:[],spawnDate:TODAY(),collected:[],flags:{walked:false,talked:false,crafted:false,placed:false},talkCounts:{},questClaims:[],dailyClaims:{},focus:{end:0,mins:0},focusRewards:[],legacyGarden:null};}
let db=null,state=defaultSave(),opened="",interacting=false,pending=null,placing=null,hasStorage=false;
const player={x:9,y:9,fx:9,fy:9,fromX:9,fromY:9,toX:9,toY:9,moveStart:0,moveDuration:155,dir:"down",route:[]};
let held="",lastKeyMove=0,lastPositionSaved=0,cam={x:0,y:0,w:16,h:12},time=0,toastTimer=0,pendingMove=false;
const npcAnim=NPCS.map(n=>({...n,rx:n.x,ry:n.y,targetX:n.x,targetY:n.y,step:0,phase:0}));
function esc(value){return String(value).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));}
function count(key){return Math.max(0,Number(state.bag[key])||0);}
function openDatabase(){return new Promise((resolve,reject)=>{const r=indexedDB.open("probation-study-island-v4",1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains("saves"))r.result.createObjectStore("saves",{keyPath:"id"});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||new Error("IndexedDB error"));});}
function getRecord(){return new Promise((resolve,reject)=>{const tx=db.transaction("saves","readonly");const r=tx.objectStore("saves").get("main");r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);});}
function dayUpdate(s){const day=TODAY();if(s.spawnDate!==day){s.spawnDate=day;s.collected=[];}}
function mutate(fn){if(!db){notify("⚠️ 目前無法保存，操作未完成");return Promise.resolve(false);}return new Promise((resolve,reject)=>{
 const tx=db.transaction("saves","readwrite");const store=tx.objectStore("saves");let next=null,outcome=false;
 const req=store.get("main");
 req.onsuccess=()=>{try{next=req.result||defaultSave();dayUpdate(next);outcome=fn(next);if(outcome!==false)store.put(next);}catch(e){try{tx.abort();}catch(_){ }reject(e);}};
 req.onerror=()=>reject(req.error);
 tx.oncomplete=()=>{if(next)state=next;refreshHUD();if(opened&&opened!=="settings")renderSheet();if(channel)channel.postMessage("changed");resolve(outcome);};
 tx.onerror=()=>reject(tx.error||new Error("存檔失敗"));
 tx.onabort=()=>reject(tx.error||new Error("存檔已取消"));
 }).catch(e=>{notify("⚠️ 保存失敗："+e.message);return false;});}
const channel=typeof BroadcastChannel!=="undefined"?new BroadcastChannel("probation-study-island-v4"):null;
if(channel)channel.onmessage=async()=>{try{if(db){const fresh=await getRecord();if(fresh){state=fresh;refreshHUD();if(opened&&opened!=="settings")renderSheet();}}}catch(_){}};
function notify(message){const el=$("toast");el.textContent=message;el.classList.add("is-visible");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("is-visible"),3800);}
function refreshHUD(){
 $("island-title").textContent=state.name;$("shells-label").textContent="🐚 "+state.coins;
 const month=new Date().getMonth()+1,season=month<=2||month===12?"冬日":month<=5?"春日":month<=8?"夏日":"秋日";
 $("day-label").textContent=(new Date().getHours()>=18?"🌙 ":"☀️ ")+season;
 const progress=[!!state.flags.walked,!!state.flags.talked,count("shell")>=1,!!state.flags.placed];
 const n=progress.filter(Boolean).length;
 $("guide-progress").style.width=(n/4*100)+"%";$("guide-count").textContent=n+" / 4";
 $("guide").textContent=!progress[0]?"先點草地，讓小人走幾步。":!progress[1]?"找栗子（橘色小狐狸）聊聊天。":!progress[2]?"去海邊撿起一個貝殼。":!progress[3]?"打開背包，把免費的小木椅放到草地。":"太好了！你已完成新手探索，可以自在經營小島。";
}
function isStaticBlocked(x,y){if(x<1||x>18||y<1||y>14)return true;if(house(x,y))return true;return POND.some(t=>t[0]===x&&t[1]===y)||TREES.some(t=>t[0]===x&&t[1]===y);}
function furnitureAt(x,y){return state.placed.find(p=>p.x===x&&p.y===y);}
function walkable(x,y){return !isStaticBlocked(x,y)&&!furnitureAt(x,y);}
function neighbors(x,y){return [[x+1,y],[x-1,y],[x,y+1],[x,y-1]].filter(p=>walkable(p[0],p[1]));}
function routeTo(tx,ty,near=false){
 const start=[player.x,player.y],goalList=near?neighbors(tx,ty).filter(p=>!NPCS.some(n=>n.x===p[0]&&n.y===p[1])):[[tx,ty]];
 if(!goalList.length)return null;
 const queue=[start],visited=new Set([tileKey(...start)]),prev=new Map(),goalSet=new Set(goalList.map(g=>tileKey(...g)));
 let found=null;
 while(queue.length){const cur=queue.shift(),id=tileKey(...cur);if(goalSet.has(id)){found=cur;break;}for(const nxt of neighbors(...cur)){const k=tileKey(...nxt);if(visited.has(k))continue;visited.add(k);prev.set(k,cur);queue.push(nxt);}}
 if(!found)return null;
 let path=[],n=found;while(tileKey(...n)!==tileKey(...start)){path.unshift(n);n=prev.get(tileKey(...n));if(!n)return null;}return path;
}
function setRoute(x,y,interaction){const route=routeTo(x,y,!!interaction);if(!route){notify("這條路有障礙，換個方向試試。");return;}player.route=route;pending=interaction||null;if(route.length===0&&pending){const action=pending;pending=null;perform(action);}}
function distance(x,y){return Math.abs(player.x-x)+Math.abs(player.y-y);}
function nearestAction(){const nearNpc=NPCS.find(n=>distance(n.x,n.y)<=1);if(nearNpc)return {kind:"npc",id:nearNpc.id,x:nearNpc.x,y:nearNpc.y};const spot=RESOURCE_SPOTS.find(r=>!state.collected.includes(r.id)&&distance(r.x,r.y)<=1);if(spot)return {kind:"resource",id:spot.id,x:spot.x,y:spot.y};const nearPlaced=state.placed.find(p=>distance(p.x,p.y)<=1);if(nearPlaced)return {kind:"furniture",id:nearPlaced.id,x:nearPlaced.x,y:nearPlaced.y};return null;}
function step(dx,dy){if(player.fx!==player.x||player.fy!==player.y)return;if(!dx&&!dy)return;const nx=player.x+dx,ny=player.y+dy;if(!walkable(nx,ny))return;
 player.fromX=player.fx;player.fromY=player.fy;player.x=nx;player.y=ny;player.toX=nx;player.toY=ny;player.moveStart=performance.now();
 player.dir=dx>0?"right":dx<0?"left":dy<0?"up":"down";if(!state.flags.walked)mutate(s=>{s.flags.walked=true;return true;});pendingMove=true;
}
function rememberPosition(){if(!pendingMove||performance.now()-lastPositionSaved<700)return;lastPositionSaved=performance.now();pendingMove=false;const x=player.x,y=player.y;mutate(s=>{s.player={x,y};return true;});}
function commandAt(x,y){x=Math.floor(x);y=Math.floor(y);
 if(x<0||x>=W||y<0||y>=H)return;
 if(placing){if(!walkable(x,y)||NPCS.some(n=>n.x===x&&n.y===y)||Math.abs(player.x-x)+Math.abs(player.y-y)<1){notify("這裡不能擺放家具，換一片空地吧。");return;}
  const key=placing;mutate(s=>{if(!(s.furniture[key]>0)||s.placed.some(p=>p.x===x&&p.y===y))return false;s.furniture[key]--;s.placed.push({id:key,x,y});s.flags.placed=true;return true;}).then(ok=>{if(ok)notify("✨ "+ITEMS[key].name+"已放到小島！");});placing=null;return;}
 const npc=NPCS.find(n=>n.x===x&&n.y===y);
 if(npc){setRoute(x,y,{kind:"npc",id:npc.id,x,y});return;}
 const resource=RESOURCE_SPOTS.find(r=>r.x===x&&r.y===y&&!state.collected.includes(r.id));
 if(resource){setRoute(x,y,{kind:"resource",id:resource.id,x,y});return;}
 const furniture=furnitureAt(x,y);if(furniture){setRoute(x,y,{kind:"furniture",id:furniture.id,x,y});return;}
 if(walkable(x,y)){setRoute(x,y,null);}else notify("前面不能通行，試試旁邊的小路。");
}
function perform(action){
 if(!action)return;
 if(action.kind==="npc"){const npc=NPCS.find(n=>n.id===action.id);if(!npc)return;
  mutate(s=>{s.talkCounts[npc.id]=(s.talkCounts[npc.id]||0)+1;if(npc.id==="fox")s.flags.talked=true;return true;}).then(()=>{showSheet("dialogue",npc.id);});return;}
 if(action.kind==="resource"){const spot=RESOURCE_SPOTS.find(r=>r.id===action.id);if(!spot||state.collected.includes(spot.id))return;
  mutate(s=>{if(s.collected.includes(spot.id))return false;s.collected.push(spot.id);s.bag[spot.type]=(s.bag[spot.type]||0)+1;return true;}).then(ok=>{if(ok)notify("✨ 撿到了 "+RES[spot.type].icon+" "+RES[spot.type].name+" ×1");});return;}
 if(action.kind==="furniture"){const p=state.placed.find(it=>it.x===action.x&&it.y===action.y);if(!p)return;
  mutate(s=>{const i=s.placed.findIndex(it=>it.x===p.x&&it.y===p.y);if(i<0)return false;const item=s.placed.splice(i,1)[0];s.furniture[item.id]=(s.furniture[item.id]||0)+1;return true;}).then(ok=>{if(ok)notify("已把 "+ITEMS[p.id].name+" 收回背包。");});}
}
function doInteract(){if(pending){notify("正在走向目的地…");return;}const near=nearestAction();if(near)perform(near);else notify("附近沒有東西，走近居民或拾取物再試試。");}
function finishMovement(now){
 if(player.fx!==player.x||player.fy!==player.y){const t=Math.min(1,(now-player.moveStart)/player.moveDuration);const smooth=t*t*(3-2*t);player.fx=player.fromX+(player.toX-player.fromX)*smooth;player.fy=player.fromY+(player.toY-player.fromY)*smooth;if(t>=1){player.fx=player.x;player.fy=player.y;}}
 if(player.fx===player.x&&player.fy===player.y){
  if(player.route.length){const next=player.route.shift();if(next&&walkable(...next)){step(next[0]-player.x,next[1]-player.y);}else player.route=[];}
  else if(pending){const a=pending;pending=null;if(distance(a.x,a.y)<=1)perform(a);}
  else if(held&&now-lastKeyMove>125){lastKeyMove=now;const m={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[held];if(m)step(...m);}
 }
 rememberPosition();
}
function pickView(){const narrow=window.innerWidth<660;cam.w=narrow?12:17;cam.h=cam.w*(canvas.height/canvas.width);
 cam.x=Math.max(0,Math.min(W-cam.w,player.fx-cam.w/2));cam.y=Math.max(0,Math.min(H-cam.h,player.fy-cam.h/2));}
function hash(x,y){const n=Math.sin((x*37.7+y*99.3)*78.233)*43758.5453;return n-Math.floor(n);}
function roundRect(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.06;ctx.stroke();}}
function circ(x,y,r,color){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
function drawTerrain(){
 ctx.fillStyle="#7bd0db";ctx.fillRect(0,0,W,H);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  if(x===0||x===19||y===0||y===15){ctx.fillStyle=(x+y)%2?"#80cfda":"#86d4dc";ctx.fillRect(x,y,1,1);if(hash(x,y)>.43){ctx.strokeStyle="#c2f1e8";ctx.lineWidth=.035;ctx.beginPath();ctx.moveTo(x+.14,y+.35);ctx.quadraticCurveTo(x+.52,y+.29,x+.8,y+.36);ctx.stroke();}continue;}
  const sand=x<=2||x>=17||y>=13||y<=1, plaza=x>=7&&x<=12&&y>=6&&y<=10,road=(x===9||x===10)&&y>=6&&y<=12;
  let ground=sand?"#f3dfa3":"#a4d28e";if(plaza||road)ground="#e8d5a4";
  ctx.fillStyle=ground;ctx.fillRect(x,y,1.02,1.02);
  const h=hash(x,y);if(!sand&&!plaza&&!road){
   ctx.fillStyle=h>.5?"#94c985":"#b7da91";ctx.globalAlpha=.4;ctx.fillRect(x+.12,y+.1,.25,.17);ctx.globalAlpha=1;
   if(h>.73){ctx.strokeStyle="#7daf7f";ctx.lineWidth=.035;ctx.beginPath();ctx.moveTo(x+.38,y+.76);ctx.lineTo(x+.35,y+.66);ctx.moveTo(x+.38,y+.76);ctx.lineTo(x+.44,y+.66);ctx.stroke();}
   if(h<.2){circ(x+.7,y+.28,.09,"#f7f0ce");circ(x+.7,y+.28,.04,"#f4bb87");}
  }else if(sand&&h>.7){ctx.fillStyle="#e1c992";ctx.fillRect(x+.4,y+.6,.12,.06);}
 }
 // Beach foam and islands edge
 ctx.strokeStyle="#eef7d3";ctx.lineWidth=.11;ctx.beginPath();ctx.moveTo(1,1);ctx.lineTo(19,1);ctx.lineTo(19,15);ctx.lineTo(1,15);ctx.closePath();ctx.stroke();
 for(const [x,y] of POND){ctx.fillStyle="#75bac2";ctx.fillRect(x,y,1,1);circ(x+.6,y+.3,.2,"#9edadd");}
}
function drawHouse(){
 const x=8,y=2;
 roundRect(x-.2,y+1.1,4.4,3.4,.16,"#b0a07a");roundRect(x+.12,y+.8,3.78,3.4,.14,"#ffe1ad","#c59f7e");
 ctx.fillStyle="#d18468";ctx.beginPath();ctx.moveTo(x-.48,y+1.1);ctx.lineTo(x+2,y-.52);ctx.lineTo(x+4.42,y+1.1);ctx.closePath();ctx.fill();
 ctx.strokeStyle="#aa705e";ctx.lineWidth=.14;ctx.stroke();roundRect(x+1.55,y+2.55,.95,1.66,.4,"#956b55");
 circ(x+2.26,y+3.34,.07,"#fae9b4");
 for(const wx of [x+.65,x+2.95]){roundRect(wx,y+1.78,.65,.69,.07,"#a2d7d1","#9b8d79");ctx.strokeStyle="#fff7d2";ctx.lineWidth=.07;ctx.beginPath();ctx.moveTo(wx+.33,y+1.8);ctx.lineTo(wx+.33,y+2.48);ctx.stroke();}
 ctx.textAlign="center";ctx.fillStyle="#795942";ctx.font="bold .32px system-ui";ctx.fillText("小島書屋",x+2,y+.57);
}
function drawTree(x,y,i){circ(x+.52,y+.88,.35,"#6c9f6d55");roundRect(x+.42,y+.4,.21,.61,.05,"#9d7859");circ(x+.51,y+.30,.53,i%2?"#7db681":"#8ac27e");circ(x+.22,y+.46,.4,i%2?"#93cd85":"#73af7e");circ(x+.81,y+.48,.42,"#a2d08c");circ(x+.49,y+.10,.4,"#a8d88f");}
function drawNPC(n,now){
 const w=(Math.sin(now/1400+n.x+n.y)*.08),x=n.rx+.5,y=n.ry+.55+w;ctx.fillStyle="#44624a44";ctx.beginPath();ctx.ellipse(x,y+.35,.34,.12,0,0,6.3);ctx.fill();
 roundRect(x-.27,y+.14,.54,.39,.12,n.id==="fox"?"#8fb8a1":n.id==="bear"?"#88b5c7":n.id==="rabbit"?"#d3a6a6":"#b7a7c1");
 const face=n.color; if(n.id==="fox"){ctx.fillStyle=face;ctx.beginPath();ctx.moveTo(x-.32,y-.13);ctx.lineTo(x-.31,y-.66);ctx.lineTo(x-.04,y-.38);ctx.lineTo(x+.1,y-.38);ctx.lineTo(x+.32,y-.66);ctx.lineTo(x+.31,y-.13);ctx.fill();}
 if(n.id==="bear"){circ(x-.22,y-.33,.17,face);circ(x+.22,y-.33,.17,face);}
 if(n.id==="rabbit"){roundRect(x-.24,y-.87,.15,.51,.075,face);roundRect(x+.1,y-.87,.15,.51,.075,face);}
 if(n.id==="owl"){ctx.fillStyle=face;ctx.beginPath();ctx.moveTo(x-.26,y-.17);ctx.lineTo(x-.33,y-.67);ctx.lineTo(x-.06,y-.43);ctx.lineTo(x+.06,y-.43);ctx.lineTo(x+.33,y-.67);ctx.lineTo(x+.26,y-.17);ctx.fill();}
 circ(x,y-.15,.37,face);
 if(n.id==="fox"){circ(x,y,.25,"#fff1d7");}
 if(n.id==="owl"){circ(x-.15,y-.2,.16,"#e7e9da");circ(x+.15,y-.2,.16,"#e7e9da");}
 circ(x-.13,y-.23,.041,"#4d5145");circ(x+.13,y-.23,.041,"#4d5145");
 circ(x,y-.07,.052,n.id==="owl"?"#dcae77":"#7d6052");
 ctx.textAlign="center";ctx.font="bold .25px system-ui";ctx.fillStyle="#4f705a";ctx.fillText(NAMES[n.id],x,y+.82);
 if(n.id==="fox"&&!state.flags.talked){circ(x+.31,y-.69,.17,"#f9bd72");ctx.fillStyle="#805a35";ctx.font="bold .26px system-ui";ctx.fillText("!",x+.31,y-.60);}
}
function drawPlayer(now){
 const x=player.fx+.5,y=player.fy+.54,bob=Math.abs(player.fx-player.x)+Math.abs(player.fy-player.y)>.01?Math.sin(now/65)*.04:0;
 ctx.fillStyle="#496b483e";ctx.beginPath();ctx.ellipse(x,y+.38,.32,.115,0,0,6.28);ctx.fill();
 const shirts=["#e5a28b","#a7b7da","#83b8a0"],shirt=shirts[state.outfit]||shirts[0];
 roundRect(x-.22,y+.06+bob,.44,.37,.11,shirt);
 roundRect(x-.18,y+.33+bob,.13,.15,.04,"#7e796f");roundRect(x+.07,y+.33+bob,.13,.15,.04,"#7e796f");
 circ(x,y-.14+bob,.3,"#edc9ac");circ(x,y-.35+bob,.29,"#665b4e");
 roundRect(x-.28,y-.37+bob,.56,.23,.10,"#695849");
 if(player.dir!=="up"){circ(x-.12,y-.1+bob,.033,"#473d37");circ(x+.12,y-.1+bob,.033,"#473d37");ctx.strokeStyle="#ad8b76";ctx.lineWidth=.026;ctx.beginPath();ctx.arc(x,y-.01+bob,.08,.2,Math.PI-.2);ctx.stroke();}
}
function drawPlaced(p){const x=p.x+.5,y=p.y+.47;ctx.fillStyle="#42795c3a";ctx.beginPath();ctx.ellipse(x,y+.3,.38,.12,0,0,6.28);ctx.fill();
 ctx.textAlign="center";ctx.textBaseline="middle";ctx.font=".79px system-ui";ctx.fillText(ITEMS[p.id]?.icon||"🪑",x,y);ctx.textBaseline="alphabetic";}
function drawResource(r,now){const x=r.x+.5,y=r.y+.5+Math.sin(now/400+r.x)*.055;ctx.fillStyle="#ffffffa6";ctx.beginPath();ctx.ellipse(x,y+.27,.3,.095,0,0,6.3);ctx.fill();ctx.textAlign="center";ctx.textBaseline="middle";ctx.font=".74px system-ui";ctx.fillText(RES[r.type].icon,x,y);ctx.textBaseline="alphabetic";if(Math.sin(now/550+r.y)>.7){ctx.fillStyle="#fff9d3";ctx.font=".3px system-ui";ctx.fillText("✦",x+.32,y-.31);}}
function render(now){time=now;if(!document.hidden){finishMovement(now);pickView();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
 const scale=canvas.width/cam.w;ctx.setTransform(scale,0,0,scale,-cam.x*scale,-cam.y*scale);
 drawTerrain();drawHouse();
 for(let i=0;i<TREES.length;i++)drawTree(TREES[i][0],TREES[i][1],i);
 const actors=[...npcAnim.map(n=>({y:n.ry+.65,draw:()=>drawNPC(n,now)})),{y:player.fy+.6,draw:()=>drawPlayer(now)},...state.placed.map(p=>({y:p.y+.8,draw:()=>drawPlaced(p)})),...RESOURCE_SPOTS.filter(r=>!state.collected.includes(r.id)).map(r=>({y:r.y+.5,draw:()=>drawResource(r,now)}))];
 actors.sort((a,b)=>a.y-b.y).forEach(a=>a.draw());
 if(placing){ctx.lineWidth=.07;ctx.strokeStyle="#fff8dd";ctx.setLineDash([.15,.12]);ctx.strokeRect(player.x-1,player.y-1,3,3);ctx.setLineDash([]);}
 }
 requestAnimationFrame(render);}
function getWorldPoint(evt){const rect=canvas.getBoundingClientRect();const px=(evt.clientX-rect.left)/rect.width*canvas.width,py=(evt.clientY-rect.top)/rect.height*canvas.height;return [cam.x+px/(canvas.width/cam.w),cam.y+py/(canvas.width/cam.w)];}
canvas.addEventListener("pointerdown",evt=>{evt.preventDefault();const [x,y]=getWorldPoint(evt);player.route=[];pending=null;commandAt(x,y);});
function setHeld(dir){held=dir;player.route=[];pending=null;lastKeyMove=0;}
document.querySelectorAll("[data-dir]").forEach(btn=>{const dir=btn.dataset.dir;btn.addEventListener("pointerdown",e=>{e.preventDefault();btn.setPointerCapture?.(e.pointerId);setHeld(dir);});for(const type of ["pointerup","pointercancel","lostpointercapture"])btn.addEventListener(type,()=>{if(held===dir)held="";});});
$("interact-button").addEventListener("click",doInteract);
document.addEventListener("keydown",e=>{if(!$("overlay").hidden){if(e.key==="Escape")hideSheet();return;}if(e.target instanceof HTMLInputElement)return;
 const dirs={ArrowUp:"up",ArrowDown:"down",ArrowLeft:"left",ArrowRight:"right",w:"up",a:"left",s:"down",d:"right",W:"up",A:"left",S:"down",D:"right"};
 if(dirs[e.key]){e.preventDefault();setHeld(dirs[e.key]);}else if(e.key.toLowerCase()==="e"){e.preventDefault();doInteract();}else if(e.key.toLowerCase()==="b"){e.preventDefault();showSheet("bag");}
});
document.addEventListener("keyup",e=>{const dirs={ArrowUp:"up",ArrowDown:"down",ArrowLeft:"left",ArrowRight:"right",w:"up",a:"left",s:"down",d:"right"};if(held===dirs[e.key]||held===dirs[e.key?.toLowerCase()])held="";});
window.addEventListener("blur",()=>held="");
function hideSheet(){$("overlay").hidden=true;opened="";$("sheet-content").replaceChildren();}
function showSheet(kind,id=""){opened=kind;interacting=id;$("overlay").hidden=false;renderSheet();$("close-sheet").focus();}
function renderSheet(){
 if(!opened)return;const content=$("sheet-content");let title="",kicker="小樹灣",html="";
 if(opened==="help"){title="島民手冊";html=$("help-template").innerHTML;}
 if(opened==="bag"){title="我的背包";kicker="POCKETS";html='<h3>🌿 採集材料</h3><div class="item-grid">'+Object.keys(RES).map(id=>'<div class="item-card"><span class="count">× '+count(id)+'</span><div class="item-icon">'+RES[id].icon+'</div><h3>'+RES[id].name+'</h3></div>').join("")+'</div><h3>🪑 家具口袋</h3><div class="item-grid">'+Object.keys(ITEMS).map(id=>'<div class="item-card"><span class="count">× '+(state.furniture[id]||0)+'</span><div class="item-icon">'+ITEMS[id].icon+'</div><h3>'+ITEMS[id].name+'</h3><p>可以擺放到可走的草地上。</p><button class="panel-button" data-action="place" data-id="'+id+'" '+(!(state.furniture[id]>0)?"disabled":"")+'>擺放到小島</button></div>').join("")+'</div>';}
 if(opened==="workshop"){title="森林小工坊";kicker="DIY RECIPES";html='<p class="muted">帶回海邊和森林撿到的材料，在這裡做一件小家具吧！</p><div class="item-grid">'+Object.keys(ITEMS).map(id=>{const item=ITEMS[id];return '<div class="item-card"><div class="item-icon">'+item.icon+'</div><h3>'+item.name+'</h3><p>'+Object.entries(item.needs).map(([r,n])=>RES[r].icon+RES[r].name+' ×'+n).join('　')+'</p><button class="panel-button" data-action="craft" data-id="'+id+'" '+(!Object.entries(item.needs).every(([r,n])=>count(r)>=n)?"disabled":"")+'>🔨 製作</button></div>';}).join("")+'</div>';}
 if(opened==="quests"){title="小島委託簿";kicker="DAILY ADVENTURES";const quests=[{id:"talk",label:"和栗子打招呼",description:"走近橘色小狐狸並和她說話",done:!!state.flags.talked},{id:"shells",label:"海岸探索",description:"帶回至少 2 個貝殼",done:count("shell")>=2||state.questClaims.includes("shells")},{id:"craft",label:"第一次手作",description:"在工坊製作至少一件家具",done:!!state.flags.crafted}];
 html=quests.map(q=>'<div class="quest '+(q.done?"done":"")+'"><strong>✿ '+q.label+'</strong><p>'+q.description+'</p><span class="reward-chip">🎁 🐚金幣 +15、木材 +1</span><div class="button-row"><button class="panel-button" data-action="quest" data-id="'+q.id+'" '+(!q.done||state.questClaims.includes(q.id)?"disabled":"")+'>'+(state.questClaims.includes(q.id)?"已領取 ✓":q.done?"領取獎勵":"尚未完成")+'</button></div></div>').join("");}
 if(opened==="study"){title="讀書也能幫小島";kicker="STUDY QUESTS";const today=TODAY();const claimed=state.dailyClaims[today]||{};
 const activities=[{id:"read",name:"閱讀一段法條或學科",reward:"🍃 葉子 +2",item:"leaf",amount:2},{id:"practice",name:"完成一題申論練習",reward:"🪵 木材 +2",item:"wood",amount:2},{id:"review",name:"訂正或主動回憶一次",reward:"🍎 果實 +2",item:"fruit",amount:2}];
 html='<div class="info-box">這裡是<b>自行回報</b>，不會讀取、修改或判斷原本的考古題答案。每項每天只可領一次。</div>'+activities.map(a=>'<div class="quest"><strong>📘 '+a.name+'</strong><p>'+a.reward+'（每天一次）</p><button class="panel-button" data-action="learn" data-id="'+a.id+'" '+(claimed[a.id]?"disabled":"")+'>'+(claimed[a.id]?"今天已完成 ✓":"我已完成，領獎勵")+'</button></div>').join("")+
 '<h3>🍵 專注屋</h3><p class="muted">倒數完成後，依裝置時間核對一次獎勵。請自行確認實際有在讀書。</p><p id="focus-info"><b>'+(state.focus.end?Math.max(0,Math.ceil((state.focus.end-Date.now())/60000))+" 分鐘後完成":"目前沒有進行中的計時")+'</b></p><div class="button-row"><button class="panel-button" data-action="focus" data-id="5" '+(state.focus.end?"disabled":"")+'>開始 5 分鐘</button><button class="panel-button alt" data-action="focus" data-id="25" '+(state.focus.end?"disabled":"")+'>25 分鐘</button><button class="panel-button alt" data-action="cancel-focus" '+(!state.focus.end?"disabled":"")+'>取消</button></div><p class="muted">5 分鐘：木材 +1；25 分鐘：木材 +3。取消不給獎勵。</p>';
 }
 if(opened==="dialogue"){const n=NPCS.find(n=>n.id===interacting);if(!n){hideSheet();return;}title="和 "+NAMES[n.id]+" 說話";kicker="ISLAND FRIENDS";
 const line=n.dialogues[((state.talkCounts[n.id]||1)-1)%n.dialogues.length];
 html='<div class="dialogue-body"><p class="dialogue-name">'+(n.id==="fox"?"🦊":n.id==="bear"?"🐻":n.id==="rabbit"?"🐰":"🦉")+' '+NAMES[n.id]+'</p><p>'+esc(line)+'</p></div><div class="button-row"><button class="panel-button" data-action="next-dialogue" data-id="'+n.id+'">再聊聊</button><button class="panel-button alt" data-action="close">改天見 ♡</button></div>';
 }
 if(opened==="settings"){title="島民設定與備份";kicker="SAVE YOUR ISLAND";html='<div class="settings-row"><label for="rename">替小島取名字</label><input id="rename" type="text" maxlength="18" value="'+esc(state.name)+'"><div class="button-row"><button class="panel-button" data-action="rename">儲存島名</button></div></div><div class="settings-row"><label>選擇衣服顏色</label><div class="button-row">'+["珊瑚橘","天空藍","森林綠"].map((name,i)=>'<button class="panel-button '+(i===state.outfit?"":"alt")+'" data-action="outfit" data-id="'+i+'">'+name+'</button>').join("")+'</div></div><div class="settings-row"><label>備份小島資料</label><button class="panel-button" data-action="export">⬇ 匯出 v4 JSON</button><p class="muted">瀏覽器或網域不同不會同步。請確認備份檔確實儲存。</p><label for="restore">匯入 v4 存檔或 v3 小島 JSON</label><input class="file-input" type="file" id="restore" accept=".json,application/json"><p class="muted">先檢查內容與預覽，再由你確認。匯入 v3 會建立「舊島花園」紀錄，不更動 v3 原存檔。</p></div>'+(state.legacyGarden?'<div class="settings-row"><h3>🌷 舊島花園（v3 留存）</h3><div class="legacy-grid">'+state.legacyGarden.plots.map(x=>'<span>'+(x==="flower"?"🌷":x==="tree"?"🌳":x==="bench"?"🪑":x==="tent"?"⛺":x==="garden"?"🍄":x==="lamp"?"🏮":"·")+'</span>').join("")+'</div><p class="muted">舊島家具完整保存供展示；原本的 JSON 不會刪除。</p></div>':"")+'<div class="offline-alert">此站的獎勵與紀錄僅屬遊戲，不代表考選部正式評分。</div>';}
 $("sheet-title").textContent=title;$("sheet-kicker").textContent=kicker;content.innerHTML=html;
}
$("close-sheet").addEventListener("click",hideSheet);$("close-backdrop").addEventListener("click",hideSheet);
$("help-button").addEventListener("click",()=>showSheet("help"));
document.querySelectorAll("[data-open]").forEach(btn=>btn.addEventListener("click",()=>showSheet(btn.dataset.open)));
$("sheet-content").addEventListener("click",async event=>{
 const b=event.target.closest("button[data-action]");if(!b||b.disabled)return;const action=b.dataset.action,id=b.dataset.id;
 if(action==="close"){hideSheet();return;}
 if(action==="place"){if(!(state.furniture[id]>0))return;placing=id;hideSheet();notify("選好位置，點擊島上的空草地放置 "+ITEMS[id].name);return;}
 if(action==="craft"){const item=ITEMS[id];if(!item)return;const ok=await mutate(s=>{if(!Object.entries(item.needs).every(([r,n])=>(s.bag[r]||0)>=n))return false;for(const [r,n] of Object.entries(item.needs))s.bag[r]-=n;s.furniture[id]=(s.furniture[id]||0)+1;s.flags.crafted=true;return true;});if(ok)notify("🔨 製作完成！"+item.name+" 已放入背包。");return;}
 if(action==="quest"){const ready=id==="talk"?state.flags.talked:id==="shells"?(count("shell")>=2||state.questClaims.includes(id)):state.flags.crafted;if(!ready)return;const ok=await mutate(s=>{if(s.questClaims.includes(id))return false;s.questClaims.push(id);s.coins+=15;s.bag.wood+=1;return true;});if(ok)notify("🎁 完成委託！獲得 15 金幣與 1 木材");return;}
 if(action==="learn"){const rewards={read:["leaf",2],practice:["wood",2],review:["fruit",2]};if(!rewards[id])return;const ok=await mutate(s=>{const day=TODAY(),today=s.dailyClaims[day]||{};if(today[id])return false;today[id]=true;s.dailyClaims[day]=today;s.bag[rewards[id][0]]+=rewards[id][1];s.xp+=10;return true;});if(ok)notify("📚 學習紀錄已自行確認，獎勵入袋！");return;}
 if(action==="focus"){const mins=Number(id);if(![5,25].includes(mins))return;const ok=await mutate(s=>{if(s.focus.end)return false;s.focus={end:Date.now()+mins*60000,mins};return true;});if(ok)notify("🍵 "+mins+" 分鐘專注開始！");return;}
 if(action==="cancel-focus"){await mutate(s=>{s.focus={end:0,mins:0};return true;});notify("已取消專注，沒有發放獎勵。");return;}
 if(action==="next-dialogue"){const npc=NPCS.find(n=>n.id===id);if(npc)await mutate(s=>{s.talkCounts[id]=(s.talkCounts[id]||0)+1;return true;});return;}
 if(action==="rename"){const name=$("rename").value.trim().slice(0,18);if(!name)return notify("請替小島取一個名字");await mutate(s=>{s.name=name;return true;});renderSheet();notify("🏝️ 新島名已儲存");return;}
 if(action==="outfit"){const v=Number(id);if(v>=0&&v<=2)await mutate(s=>{s.outfit=v;return true;});renderSheet();return;}
 if(action==="export"){downloadSave();return;}
});
$("sheet-content").addEventListener("change",async evt=>{if(evt.target.id!=="restore")return;const file=evt.target.files&&evt.target.files[0];if(!file)return;try{if(file.size>2*1024*1024)throw new Error("檔案過大，限 2 MB");const raw=JSON.parse(await file.text());await importSave(raw);}catch(e){notify("匯入失敗："+e.message);}finally{evt.target.value="";}});
function downloadSave(){const file=new Blob([JSON.stringify({format:"study-island-v4",exportedAt:new Date().toISOString(),state},null,2)],{type:"application/json"});const url=URL.createObjectURL(file),a=document.createElement("a");a.href=url;a.download="study-island-v4-"+TODAY()+".json";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);notify("已開始下載備份，請檢查檔案。");}
function validSave(s){return s&&s.version===4&&s.id==="main"&&typeof s.name==="string"&&s.name.length<=100&&s.bag&&["shell","wood","leaf","fruit"].every(k=>Number.isSafeInteger(s.bag[k])&&s.bag[k]>=0&&s.bag[k]<100000)&&s.furniture&&["bench","flower","lamp"].every(k=>Number.isSafeInteger(s.furniture[k])&&s.furniture[k]>=0&&s.furniture[k]<100000)&&Array.isArray(s.placed)&&s.placed.length<200&&s.placed.every(p=>ITEMS[p.id]&&Number.isInteger(p.x)&&Number.isInteger(p.y)&&!isStaticBlocked(p.x,p.y))&&s.player&&Number.isInteger(s.player.x)&&Number.isInteger(s.player.y)&&!isStaticBlocked(s.player.x,s.player.y);}
async function importSave(raw){
 let next,kind;
 if(raw?.format==="study-island-v4"&&validSave(raw.state)){next=raw.state;kind="v4";}
 else if(raw?.version===1&&Array.isArray(raw.plots)&&raw.plots.length===36){
  const valid=["flower","tree","bench","tent","garden","lamp"];if(!raw.plots.every(x=>x===""||valid.includes(x)))throw new Error("舊島家具格式不正確");
  next=JSON.parse(JSON.stringify(state));kind="v3";next.legacyGarden={plots:[...raw.plots],owned:raw.owned||{},oldName:raw.islandName||"舊島",coins:raw.coins||0,xp:raw.xp||0,hearts:raw.hearts||{}};
  next.name=String(raw.islandName||next.name).slice(0,18);next.coins+=Math.max(0,Math.min(1000000,Number(raw.coins)||0));next.xp+=Math.max(0,Math.min(1000000,Number(raw.xp)||0));
  // Six legacy furniture classes remain in a complete, read-only garden instead of mapping onto incompatible new tiles.
 }else throw new Error("這不是相容的 v4 或 v3 JSON 檔");
 const summary=kind==="v3"?"舊島 36 格家具與金幣資料將複製到 v4 的『舊島花園』；不修改 v3 原始檔。":"匯入 v4 會取代這個網域目前的 v4 存檔。";
 if(!confirm(summary+"\n\n請先備份目前小島。確定匯入？"))return;
 const ok=await mutate(s=>{for(const key of Object.keys(s))delete s[key];Object.assign(s,next,{id:"main",version:4});return true;});
 if(ok){player.x=next.player.x;player.y=next.player.y;player.fx=player.x;player.fy=player.y;player.route=[];pending=null;placing=null;renderSheet();notify("✅ 匯入完成，舊有來源資料未更動");}
}
let focusBusy=false;
async function checkFocus(){if(focusBusy||!state.focus?.end||Date.now()<state.focus.end)return;focusBusy=true;
 const ok=await mutate(s=>{const f=s.focus;if(!f.end||Date.now()<f.end)return false;const token=String(f.end)+":"+f.mins;if(s.focusRewards.includes(token))return false;
  s.focusRewards.push(token);s.focusRewards=s.focusRewards.slice(-300);s.bag.wood+=(f.mins===25?3:1);s.xp+=f.mins===25?30:6;s.focus={end:0,mins:0};return true;});
 if(ok)notify("🎉 專注完成！木材已收進背包");focusBusy=false;
}
async function initialize(){
 try{db=await openDatabase();const old=await getRecord();if(!old){await mutate(s=>true);}else{state=old;await mutate(s=>true);}hasStorage=true;player.x=state.player.x;player.y=state.player.y;player.fx=player.x;player.fy=player.y;refreshHUD();notify("🌷 歡迎來到 "+state.name+"，今天想去哪裡散步？");}
 catch(err){notify("⚠️ 無法使用本機儲存，進度不能保存。請使用一般瀏覽器分頁。");$("hint").textContent="儲存未啟用，請退出無痕模式或開啟網站儲存權限";console.error(err);}
 requestAnimationFrame(render);setInterval(checkFocus,1000);document.addEventListener("visibilitychange",()=>{if(!document.hidden){checkFocus();refreshHUD();}});window.addEventListener("pagehide",()=>{if(db&&pendingMove)mutate(s=>{s.player={x:player.x,y:player.y};return true;});});
}
initialize();
})();
