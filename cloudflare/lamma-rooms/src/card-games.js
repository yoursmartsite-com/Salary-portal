// Server-authoritative card game engine for Lamma rooms.
const SUITS=["♠","♥","♦","♣"], RANKS=["7","8","9","10","J","Q","K","A"];
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
  Object.assign(base,{deck,discard:[top],color:top.c,direction:1,phase:"playing"});
 }else if(game==="basra"){
  const deck=standardDeck();ids.forEach(id=>base.players[id].hand=deck.splice(0,4));Object.assign(base,{deck,table:deck.splice(0,4),captured:Object.fromEntries(ids.map(id=>[id,[]])),phase:"playing"});
 }else if(["tarneeb","hokm","estimation"].includes(game)){
  const deck=standardDeck();ids.forEach(id=>base.players[id].hand=deck.splice(0,13));Object.assign(base,{trick:[],trump:null,leadSuit:null,teamScores:[0,0],round:1,phase:game==="hokm"?"chooseTrump":"bidding",dealer:0});
  if(game==="tarneeb")base.phase="bidding";
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
 const g=room.gameState;if(!g)throw Error("GAME_NOT_STARTED");const ids=Object.keys(room.players),p=g.players[uid];if(!p)throw Error("NOT_IN_ROOM");const game=g.game;
 if(game==="uno"){
  if(g.phase!=="playing"||ids[g.turn]!==uid)throw Error("NOT_YOUR_TURN");
  if(b.action==="draw"){if(!g.deck.length)g.deck=shuffle(g.discard.splice(0,g.discard.length-1));if(!g.deck.length)throw Error("NO_CARDS");p.hand.push(g.deck.pop());g.turn=next(g.turn+g.direction,ids.length);log(g,room.players[uid].name+" سحب ورقة");return}
  const card=p.hand.find(x=>x.id===b.card);if(!card)throw Error("CARD_NOT_IN_HAND");
  const top=g.discard.at(-1),valid=card.c==="wild"||card.c===g.color||card.v===top.v;if(!valid)throw Error("INVALID_CARD");
  p.hand=p.hand.filter(x=>x.id!==card.id);g.discard.push(card);if(card.c==="wild"){if(!["red","yellow","green","blue"].includes(b.color))throw Error("CHOOSE_COLOR");g.color=b.color}else g.color=card.c;
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
  if(card.r==="J")take=[...g.table];else take=g.table.filter(x=>x.r===card.r);
  if(take.length){g.table=g.table.filter(x=>!take.some(t=>t.id===x.id));g.captured[uid].push(card,...take);if(!g.table.length)g.players[uid].basras=(g.players[uid].basras||0)+1}
  else g.table.push(card);
  if(p.hand.length===0&&g.deck.length){for(const id of ids)g.players[id].hand=g.deck.splice(0,Math.min(4,g.deck.length))}
  if(ids.every(id=>!g.players[id].hand.length)&&!g.deck.length){g.phase="finished";const scores=ids.map(id=>({id,score:(g.captured[id]||[]).length+(g.players[id].basras||0)*10})).sort((a,b)=>b.score-a.score);g.winner=scores[0].id;log(g,"انتهت لعبة البصرة")}
  else g.turn=next(g.turn+1,ids.length);return;
 }
 if(["tarneeb","hokm","estimation"].includes(game)){
  if(g.phase==="chooseTrump"){if(game!=="hokm"||ids[g.turn]!==uid||!SUITS.includes(b.trump))throw Error("INVALID_TRUMP");g.trump=b.trump;g.phase="playing";return}
  if(g.phase==="bidding"){if(ids[g.turn]!==uid)throw Error("NOT_YOUR_TURN");const bid=Number(b.bid);if(!Number.isInteger(bid)||bid<1||bid>13)throw Error("INVALID_BID");p.bid=bid;if(game==="tarneeb"&&b.trump&&SUITS.includes(b.trump))g.trump=b.trump;g.turn=next(g.turn+1,ids.length);if(ids.every(id=>g.players[id].bid!==null)){if(game==="hokm"&&!g.trump)g.phase="chooseTrump";else g.phase="playing";g.turn=next(g.dealer+1,ids.length)}return}
  if(g.phase!=="playing"||ids[g.turn]!==uid)throw Error("NOT_YOUR_TURN");const card=p.hand.find(x=>x.id===b.card);if(!card)throw Error("CARD_NOT_IN_HAND");if(g.leadSuit&&!g.trick.some(t=>t.uid===uid)&&p.hand.some(x=>x.s===g.leadSuit)&&card.s!==g.leadSuit)throw Error("FOLLOW_SUIT");
  if(!g.trick.length)g.leadSuit=card.s;p.hand=p.hand.filter(x=>x.id!==card.id);g.trick.push({uid,card});if(g.trick.length<ids.length){g.turn=next(g.turn+1,ids.length);return}
  const trump=g.trump,lead=g.leadSuit;const rank=x=>RANKS.indexOf(x.card.r)+(x.card.s===trump?20:x.card.s===lead?10:0);const win=g.trick.reduce((a,x)=>rank(x)>rank(a)?x:a);const wi=ids.indexOf(win.uid);g.players[win.uid].tricks++;g.turn=wi;g.trick=[];g.leadSuit=null;
  if(ids.every(id=>!g.players[id].hand.length)){const team0=g.players[ids[0]].tricks+g.players[ids[2]].tricks,team1=g.players[ids[1]].tricks+g.players[ids[3]].tricks;g.teamScores[0]+=team0;g.teamScores[1]+=team1;g.phase="finished";g.winnerTeam=team0>team1?0:team1>team0?1:-1;log(g,"انتهت الجولة: "+team0+" مقابل "+team1)}return;
 }
 if(game==="konkan"){
  if(ids[g.turn]!==uid)throw Error("NOT_YOUR_TURN");
  if(b.action==="draw"){if(g.phase!=="draw"||g.drawn)throw Error("CANNOT_DRAW");const c=b.from==="discard"?g.discard.pop():g.deck.pop();if(!c)throw Error("NO_CARDS");p.hand.push(c);g.drawn=true;g.phase="discard";return}
  if(b.action==="discard"){if(g.phase!=="discard"||!g.drawn)throw Error("CANNOT_DISCARD");const c=p.hand.find(x=>x.id===b.card);if(!c)throw Error("CARD_NOT_IN_HAND");p.hand=p.hand.filter(x=>x.id!==c.id);g.discard.push(c);g.drawn=false;g.phase="draw";g.turn=next(g.turn+1,ids.length);if(!g.deck.length){g.phase="finished";g.winner=uid}return}
  throw Error("INVALID_ACTION");
 }
}
export {startCardGame,publicCardGame,applyCardMove};
