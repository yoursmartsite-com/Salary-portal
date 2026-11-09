// Server-authoritative card game engine for Lamma rooms.
const SUITS=["♠","♥","♦","♣"], RANKS=["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
const uidOf=(room,uid)=>room.players?.[uid];
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const standardDeck=()=>shuffle(SUITS.flatMap(s=>RANKS.map(r=>({s,r,id:s+r}))));
const unoDeck=()=>{const d=[];for(const c of ["red","yellow","green","blue"]){d.push({c,v:"0",id:c+"0"});for(let n=1;n<=9;n++)for(let k=0;k<2;k++)d.push({c,v:String(n),id:c+n+k});for(const v of ["skip","reverse","+2"])for(let k=0;k<2;k++)d.push({c,v,id:c+v+k})}for(let k=0;k<4;k++){d.push({c:"wild",v:"wild",id:"w"+k},{c:"wild",v:"+4",id:"w4"+k})}return shuffle(d)};
const next=(i,n)=>((i+n)%n+n)%n;
function startCardGame(room,game){
 const ids=Object.keys(room.players||{}),n=ids.length;
 if(ids.length!==(room.maxPlayers||4))throw Error("WAITING_FOR_PLAYERS");
 if(ids.some(id=>!room.players[id].ready))throw Error("PLAYERS_NOT_READY");
 if(["estimation","tarneeb","hokm"].includes(game)&&n!==4)throw Error("THIS_GAME_REQUIRES_FOUR");
 const base={game,phase:"playing",players:{},turn:0,startedAt:Date.now(),log:[]};
 ids.forEach((id,i)=>base.players[id]={seat:i,hand:[],score:0,tricks:0,bid:null,saidUno:false});
 if(game==="uno"){
  const deck=unoDeck();ids.forEach(id=>base.players[id].hand=deck.splice(0,7));let top=deck.pop();while(["wild","+4"].includes(top.v)){deck.unshift(top);top=deck.pop()}
  Object.assign(base,{deck,discard:[top],color:top.c,direction:1,drawn:null,phase:"playing"});
 }else if(game==="basra"){
  const deck=standardDeck();ids.forEach(id=>base.players[id].hand=deck.splice(0,4));Object.assign(base,{deck,table:deck.splice(0,4),captured:Object.fromEntries(ids.map(id=>[id,[]])),phase:"playing"});
 }else if(["tarneeb","hokm","estimation"].includes(game)){
  const deck=standardDeck();ids.forEach(id=>base.players[id].hand=deck.splice(0,13));Object.assign(base,{trick:[],trump:null,leadSuit:null,teamScores:[0,0],round:1,phase:game==="hokm"?"chooseTrump":"bidding",dealer:0});if(game==="hokm")base.turn=1;
  if(game==="tarneeb"){base.phase="bidding";base.turn=1;}
 }else if(game==="konkan"){
  const deck=standardDeck();ids.forEach(id=>base.players[id].hand=deck.splice(0,7));Object.assign(base,{deck,discard:[deck.pop()],phase:"draw",drawn:false});
 }else throw Error("UNKNOWN_CARD_GAME");
 room.gameState=base;room.status="playing";room.updatedAt=Date.now();return base;
}
function publicCardGame(room,uid){
 const g=room.gameState;if(!g)return null;const ids=Object.keys(room.players||{});
 return {...g,deck:undefined,players:Object.fromEntries(ids.map(id=>[id,{seat:g.players[id]?.seat,handCount:g.players[id]?.hand?.length||0,hand:id===uid?g.players[id]?.hand:undefined,score:g.players[id]?.score||0,tricks:g.players[id]?.tricks||0,bid:g.players[id]?.bid,saidUno:g.players[id]?.saidUno}])),myHand:g.players[uid]?.hand||[],currentPlayer:ids[g.turn],currentName:room.players[ids[g.turn]]?.name,discardTop:g.discard?.at(-1)||null,stockCount:g.deck?.length||0};
}
function log(g,s){g.log=(g.log||[]).concat({text:s,at:Date.now()}).slice(-30)}
function applyCardMove(room,uid,b){
 const g=room.gameState;if(!g)throw Error("GAME_NOT_STARTED");if(g.phase==="finished")throw Error("GAME_FINISHED");const ids=Object.keys(room.players),p=g.players[uid];if(!p)throw Error("NOT_IN_ROOM");const game=g.game;
 if(game==="uno"){
  if(g.phase!=="playing"||ids[g.turn]!==uid)throw Error("NOT_YOUR_TURN");
  if(b.action==="draw"){if(g.drawn)throw Error("ALREADY_DREW");if(!g.deck.length)g.deck=shuffle(g.discard.splice(0,g.discard.length-1));if(!g.deck.length)throw Error("NO_CARDS");const drawn=g.deck.pop();p.hand.push(drawn);g.drawn=drawn.id;log(g,room.players[uid].name+" سحب ورقة");return}if(b.action==="pass"){if(!g.drawn)throw Error("DRAW_FIRST");g.drawn=null;g.turn=next(g.turn+g.direction,ids.length);log(g,room.players[uid].name+" أنهى دوره بعد السحب");return}
  const card=p.hand.find(x=>x.id===b.card);if(!card)throw Error("CARD_NOT_IN_HAND");if(g.drawn&&card.id!==g.drawn)throw Error("PLAY_DRAWN_CARD_ONLY");
  const top=g.discard.at(-1),valid=card.c==="wild"||card.c===g.color||card.v===top.v;if(!valid)throw Error("INVALID_CARD");
  p.hand=p.hand.filter(x=>x.id!==card.id);g.drawn=null;g.discard.push(card);if(card.c==="wild"){if(!["red","yellow","green","blue"].includes(b.color))throw Error("CHOOSE_COLOR");g.color=b.color}else g.color=card.c;
  let skip=0,draw=0;if(card.v==="skip")skip=1;if(card.v==="reverse"){g.direction*=-1;if(ids.length===2)skip=1}if(card.v==="+2")draw=2;if(card.v==="+4")draw=4;
  if(p.hand.length===1&&!b.uno){for(let i=0;i<2;i++){if(!g.deck.length)g.deck=shuffle(g.discard.splice(0,g.discard.length-1));if(g.deck.length)p.hand.push(g.deck.pop())}log(g,room.players[uid].name+" نسي يقول أونو وسحب ورقتين")}
  if(!p.hand.length){g.phase="finished";g.winner=uid;g.winnerTeam=game==="uno"&&ids.length===4?p.seat%2:null;log(g,"انتهت الجولة وفاز "+room.players[uid].name);return}
  g.turn=next(g.turn+g.direction*(1+skip),ids.length);
  if(draw){const target=ids[g.turn],n=draw;for(let i=0;i<n;i++){if(!g.deck.length)g.deck=shuffle(g.discard.splice(0,g.discard.length-1));if(g.deck.length)g.players[target].hand.push(g.deck.pop())}g.turn=next(g.turn+g.direction,ids.length)}
  log(g,room.players[uid].name+" لعب "+card.v);return;
 }
 if(game==="basra"){
  if(ids[g.turn]!==uid)throw Error("NOT_YOUR_TURN");const card=p.hand.find(x=>x.id===b.card);if(!card)throw Error("CARD_NOT_IN_HAND");
  p.hand=p.hand.filter(x=>x.id!==card.id);let take=[];
  if(card.r==="J"){
   take=[...g.table];
  }else{
   // Basra: capture a matching rank, or a numeric combination equal to the played card.
   const value=c=>c.r==="A"?1:(/^([2-9]|10)$/.test(c.r)?Number(c.r):null);
   const target=value(card);
   const matching=g.table.filter(x=>x.r===card.r);
   if(matching.length)take=matching;
   else if(target!==null){
    const nums=g.table.map((c,i)=>({c,i,v:value(c)})).filter(x=>x.v!==null);
    const find=(start,left,chosen)=>{if(left===0)return chosen;if(left<0)return null;for(let i=start;i<nums.length;i++){const got=find(i+1,left-nums[i].v,[...chosen,nums[i].i]);if(got)return got}return null};
    const combo=find(0,target,[]);
    if(combo)take=combo.map(i=>g.table[i]);
   }
  }
  if(take.length){g.table=g.table.filter(x=>!take.some(t=>t.id===x.id));g.captured[uid].push(card,...take);if(!g.table.length&&card.r!=="J")g.players[uid].basras=(g.players[uid].basras||0)+1}
  else g.table.push(card);
  if(take.length)g.lastCapturer=uid;
  if(ids.every(id=>!g.players[id].hand.length)&&g.deck.length){for(const id of ids)g.players[id].hand=g.deck.splice(0,Math.min(4,g.deck.length))}
  if(ids.every(id=>!g.players[id].hand.length)&&!g.deck.length){if(g.lastCapturer&&g.table.length)g.captured[g.lastCapturer].push(...g.table);g.table=[];const score=id=>{const cards=g.captured[id]||[];return cards.reduce((v,c)=>v+(c.r==="A"?1:0)+(c.r==="J"?1:0)+(c.s==="♦"&&c.r==="10"?2:0)+(c.s==="♣"&&c.r==="2"?1:0),0)+(g.players[id].basras||0)*10};const counts=ids.map(id=>({id,count:(g.captured[id]||[]).length,spades:(g.captured[id]||[]).filter(c=>c.s==="♠").length}));const most=counts.reduce((a,x)=>x.count>a.count?x:a,counts[0]),sp=counts.reduce((a,x)=>x.spades>a.spades?x:a,counts[0]);if(counts.filter(x=>x.count===most.count).length===1)g.players[most.id].score+=30;if(counts.filter(x=>x.spades===sp.spades).length===1)g.players[sp.id].score+=30;for(const id of ids)g.players[id].score+=score(id);g.phase="finished";g.winner=ids.slice().sort((a,b)=>g.players[b].score-g.players[a].score)[0];log(g,"انتهت لعبة البصرة")}
  else g.turn=next(g.turn+1,ids.length);return;
 }
 if(["tarneeb","hokm","estimation"].includes(game)){
  if(g.phase==="chooseTrump"){if(!["hokm","tarneeb"].includes(game)||ids[g.turn]!==uid||!SUITS.includes(b.trump))throw Error("INVALID_TRUMP");g.trump=b.trump;g.phase="playing";return}
  if(g.phase==="bidding"){if(ids[g.turn]!==uid)throw Error("NOT_YOUR_TURN");if(game==="tarneeb"&&b.pass===true)p.bid=0;else{const bid=Number(b.bid),min=game==="tarneeb"?7:0;if(!Number.isInteger(bid)||bid<min||bid>13)throw Error("INVALID_BID");p.bid=bid}g.turn=next(g.turn+1,ids.length);if(ids.every(id=>g.players[id].bid!==null)){if(game==="tarneeb"){const high=ids.map(id=>({id,bid:g.players[id].bid})).sort((a,b)=>b.bid-a.bid)[0];if(high.bid===0){g.round=(g.round||1)+1;g.dealer=next(g.dealer,ids.length);const deck=standardDeck();ids.forEach(id=>{g.players[id].hand=deck.splice(0,13);g.players[id].tricks=0;g.players[id].bid=null});g.trick=[];g.trump=null;g.leadSuit=null;g.highBidder=null;g.phase="bidding";g.turn=next(g.dealer+1,ids.length);log(g,"الجميع مرّر؛ إعادة توزيع أوراق ومزايدة جديدة");return}g.highBidder=high.id;g.turn=ids.indexOf(high.id);g.phase="chooseTrump"}else{g.phase="playing";g.turn=next(g.dealer+1,ids.length)}}return}
  if(g.phase!=="playing"||ids[g.turn]!==uid)throw Error("NOT_YOUR_TURN");const card=p.hand.find(x=>x.id===b.card);if(!card)throw Error("CARD_NOT_IN_HAND");if(g.leadSuit&&!g.trick.some(t=>t.uid===uid)&&p.hand.some(x=>x.s===g.leadSuit)&&card.s!==g.leadSuit)throw Error("FOLLOW_SUIT");
  if(!g.trick.length)g.leadSuit=card.s;p.hand=p.hand.filter(x=>x.id!==card.id);g.trick.push({uid,card});if(g.trick.length<ids.length){g.turn=next(g.turn+1,ids.length);return}
  const trump=g.trump,lead=g.leadSuit;const rank=x=>RANKS.indexOf(x.card.r)+(x.card.s===trump?20:x.card.s===lead?10:0);const win=g.trick.reduce((a,x)=>rank(x)>rank(a)?x:a);const wi=ids.indexOf(win.uid);g.players[win.uid].tricks++;g.turn=wi;g.trick=[];g.leadSuit=null;
  if(ids.every(id=>!g.players[id].hand.length)){const tricks=[g.players[ids[0]].tricks+g.players[ids[2]].tricks,g.players[ids[1]].tricks+g.players[ids[3]].tricks];if(game==="estimation"){for(let i=0;i<4;i++){const pl=g.players[ids[i]],delta=pl.tricks-pl.bid;pl.score+=delta===0?10+pl.bid:-Math.abs(delta)*10}g.teamScores=[g.players[ids[0]].score+g.players[ids[2]].score,g.players[ids[1]].score+g.players[ids[3]].score]}else if(game==="tarneeb"){const t=ids.indexOf(g.highBidder)%2,contract=g.players[g.highBidder].bid;g.teamScores[t]+=tricks[t]>=contract?tricks[t]:-contract;g.teamScores[1-t]+=tricks[1-t]}else{const t=tricks[0]>tricks[1]?0:1;g.teamScores[t]+=1}g.phase="finished";g.winnerTeam=g.teamScores[0]>g.teamScores[1]?0:g.teamScores[1]>g.teamScores[0]?1:-1;log(g,"انتهت الجولة: "+g.teamScores[0]+" مقابل "+g.teamScores[1])}return;
 }
 if(game==="konkan"){
  if(ids[g.turn]!==uid)throw Error("NOT_YOUR_TURN");
  if(b.action==="draw"){if(g.phase!=="draw"||g.drawn)throw Error("CANNOT_DRAW");const c=b.from==="discard"?g.discard.pop():g.deck.pop();if(!c)throw Error("NO_CARDS");p.hand.push(c);g.drawn=true;g.phase="discard";return}
  if(b.action==="discard"){if(g.phase!=="discard"||!g.drawn)throw Error("CANNOT_DISCARD");const c=p.hand.find(x=>x.id===b.card);if(!c)throw Error("CARD_NOT_IN_HAND");p.hand=p.hand.filter(x=>x.id!==c.id);g.discard.push(c);g.drawn=false;g.phase="draw";g.turn=next(g.turn+1,ids.length);if(!g.deck.length){g.phase="finished";g.winner=uid}return}
  throw Error("INVALID_ACTION");
 }
}
export {startCardGame,publicCardGame,applyCardMove};
