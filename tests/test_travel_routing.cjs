const test=require('node:test');
const assert=require('node:assert/strict');
const {route,measureTravel}=require('../site/travel-routing.js');
const closed=[[0,0],[90,0],[90,75],[0,75],[0,0]];
const items=[
 {points:closed,style:'running',sourceIndex:0},
 {points:[[10,10],[30,10]],style:'running',sourceIndex:1},
 {points:[[64,13],[78,13]],style:'running',sourceIndex:2},
 {points:[[14,63],[38,65]],style:'running',sourceIndex:3},
 {points:[[70,64],[87,62]],style:'running',sourceIndex:4},
 {points:[[40,20],[48,25]],style:'running',sourceIndex:5},
];
test('running-stitch travel optimized and dominant closed outline sewn last',()=>{
 const old=measureTravel(items);
 const planned=route(items,true);
 const better=measureTravel(planned);
 assert.ok(better<old*.8,'expected meaningful travel reduction '+old+' => '+better);
 assert.equal(planned.at(-1).sourceIndex,0);
 assert.deepEqual(planned.map(x=>x.sourceIndex).sort((a,b)=>a-b),[0,1,2,3,4,5]);
 assert.deepEqual(items[0].points,closed,'original editing geometry must not mutate');
 assert.deepEqual(planned.at(-1).points[0],planned.at(-1).points.at(-1),'perimeter stays closed');
});
test('source geometry is preserved by path reversal and cyclic outline rotation',()=>{
 const planned=route(items,true);
 for(const item of items){
  const next=planned.find(x=>x.sourceIndex===item.sourceIndex).points;
  const source=item.points.slice(0,item.sourceIndex===0?-1:undefined);
  const output=item.sourceIndex===0?next.slice(0,-1):next;
  const sort=p=>p.map(q=>q.join(',')).sort();
  assert.deepEqual(sort(source),sort(output));
 }
});
test('mixed tatami/fills and deliberately disabled optimization preserve original order',()=>{
 for(const list of [items.map((x,i)=>({...x,style:i===2?'tatami':'running'})),items]){
  const planned=route(list,list===items?false:true);
  assert.deepEqual(planned.map(x=>x.sourceIndex),[0,1,2,3,4,5]);
  assert.deepEqual(planned.map(x=>x.points),list.map(x=>x.points));
 }
});
test('routing is deterministic and fails closed on bad geometry',()=>{
 assert.deepEqual(route(items),route(items));
 assert.throws(()=>route([{points:[[NaN,1],[4,4]],style:'running'}]));
 assert.throws(()=>route([{points:[[1,1],[2,2]],style:'garbage'}]));
 assert.throws(()=>route(new Array(129).fill(items[0])));
});
