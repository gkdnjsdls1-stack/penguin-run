// 실제 index.html의 <script>를 그대로 vm에 올려 게임 로직을 검증한다.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const js=fs.readFileSync('/Users/test/projects/penquin-run/index.html','utf8').split('<script>')[1].split('</script>')[0];

const sty=()=>({setProperty(){},removeProperty(){},getPropertyValue:()=>''});
const el=()=>new Proxy({style:sty(),classList:{add(){},remove(){},toggle(){}},dataset:{},
  addEventListener(){},setAttribute(){},textContent:'',innerHTML:'',offsetWidth:0},
  {get:(t,k)=>k in t?t[k]:(()=>{}),set:(t,k,v)=>(t[k]=v,true)});
const ctx={console:{log:console.log,error(){}},setTimeout(){},clearTimeout(){},requestAnimationFrame(){},Math,Date,JSON,
  atob:s=>'',TextDecoder:class{decode(){return'{}'}},Blob:class{},Image:class{},URL:{createObjectURL(){},revokeObjectURL(){}},
  localStorage:{getItem:()=>null,setItem(){}},navigator:{},
  document:{getElementById:el,querySelector:el,querySelectorAll:()=>[],addEventListener(){},
    createElement:el,documentElement:el()},
  window:{addEventListener(){},devicePixelRatio:1,innerWidth:400,innerHeight:800},
  addEventListener(){},innerWidth:400,innerHeight:800};
ctx.window.AudioContext=undefined; ctx.globalThis=ctx;
// canvas.getContext -> null : 부팅이 'nogl'로 빠져 GL/모델 로딩을 건너뛴다
ctx.document.getElementById=id=>id==='c'?{getContext:()=>null,addEventListener(){},style:sty()}:el();
vm.createContext(ctx);
vm.runInContext(js,ctx,{filename:'game.js'});

const run=src=>vm.runInContext(src,ctx);
let pass=0; const t=(name,fn)=>{fn();console.log('  ok',name);pass++};

// --- 4. 길 구간 분할 ---
run(`globalThis.__segs=[];roadSeg=(a,b)=>__segs.push([+a.toFixed(2),+b.toFixed(2)]);`);
t('구멍 없으면 길이 통짜 한 구간',()=>{
  run(`obs=[];__segs.length=0;drawRoad();`);
  assert.strictEqual(JSON.stringify(ctx.__segs),'[[-155,15]]');
});
t('구멍 하나면 정확히 GAP_LEN 만큼 비는 두 구간',()=>{
  run(`obs=[];makeObs('gap',1,-50);__segs.length=0;drawRoad();`);
  const s=ctx.__segs, L=run('GAP_LEN');
  assert.strictEqual(s.length,2,'구간 2개');
  assert.strictEqual(s[0][0],-155); assert.strictEqual(s[1][1],15);
  assert.ok(Math.abs((s[1][0]-s[0][1])-L)<1e-6,'구멍 폭='+L);
});
t('구멍 두 개면 세 구간, 길이 사라지지 않음',()=>{
  run(`obs=[];makeObs('gap',1,-80);makeObs('gap',1,-30);__segs.length=0;drawRoad();`);
  assert.strictEqual(ctx.__segs.length,3);
  assert.ok(ctx.__segs.every(([a,b])=>b>a),'모든 구간 길이>0');
});

// --- 2. 떠 있는 얼음: 점프해야만 먹힌다 ---
run(`A_={H:1.15};M.ice={h:1.02};`);
const ice=(py)=>run(`(()=>{obs=[];const o=makeObs('ice',1,0);o.h=1.02;
  Object.assign(pg,{x:0,y:${py},vy:0,inv:0,slip:0,dead:false});
  const c0=save.coins;collide(o);return JSON.stringify({dead:o.dead,got:save.coins-c0})})()`);
t('서서 지나가면 얼음 통과 (안 깨짐, 코인 0)',()=>{
  const r=JSON.parse(ice(0));
  assert.strictEqual(r.dead,false); assert.strictEqual(r.got,0);
});
t('점프하면 얼음 깨고 +3 코인',()=>{
  const r=JSON.parse(ice(1.0));
  assert.strictEqual(r.dead,true); assert.strictEqual(r.got,3);
});
t('얼음 바닥이 선 키보다 높다 (점프 강제)',()=>{
  assert.ok(run('ICE_Y') > run('A_.H')-0.9, 'ICE_Y가 통과 못할 만큼 높음');
  assert.ok(run('ICE_Y') < 9*9/(2*21), '점프 정점 안에 들어옴');
});

// --- 6. 슬라이딩으로 게이트 통과 ---
const arch=(sliding)=>run(`(()=>{obs=[];const o=makeObs('arch',1,0);
  Object.assign(pg,{x:0,y:0,vy:0,inv:0,slip:0,slide:${sliding?0.5:0},dead:false});
  collide(o);return JSON.stringify({slip:pg.slip,hit:o.hit})})()`);
t('안 숙이면 게이트에 맞는다',()=>{
  const r=JSON.parse(arch(false));
  assert.ok(r.slip>0&&r.hit,'미끄덩 발동');
});
t('슬라이딩하면 게이트 통과',()=>{
  const r=JSON.parse(arch(true));
  assert.strictEqual(r.slip,0); assert.strictEqual(r.hit,false);
});
t('점프로는 게이트를 못 넘는다',()=>{
  const r=JSON.parse(run(`(()=>{obs=[];const o=makeObs('arch',1,0);
    Object.assign(pg,{x:0,y:1.9,vy:0,inv:0,slip:0,slide:0,dead:false});
    collide(o);return JSON.stringify({slip:pg.slip})})()`));
  assert.ok(r.slip>0);
});

// --- 3. 코인 줍기 ---
t('코인은 닿으면 +1, 사라진다',()=>{
  const r=JSON.parse(run(`(()=>{obs=[];const o=makeObs('coin',1,0);
    Object.assign(pg,{x:0,y:0,inv:0,slip:0,dead:false});
    const c0=save.coins;collide(o);return JSON.stringify({dead:o.dead,got:save.coins-c0})})()`));
  assert.strictEqual(r.dead,true); assert.strictEqual(r.got,1);
});

// --- 4. 구멍 추락 ---
t('구멍 위에서 땅에 있으면 추락 게임오버',()=>{
  run(`obs=[];makeObs('gap',1,0);state='run';introT=1;spawnAcc=0;
    Object.assign(pg,{x:0,y:0,vy:0,slip:0,inv:0,dead:false,fell:false});update(0.016);`);
  assert.strictEqual(run('state'),'over');
  assert.strictEqual(run('pg.fell'),true);
});
t('구멍 위를 점프 중이면 안 떨어진다',()=>{
  run(`obs=[];makeObs('gap',1,0);state='run';introT=1;spawnAcc=0;
    Object.assign(pg,{x:0,y:1.2,vy:3,slip:0,inv:0,dead:false,fell:false});update(0.016);`);
  assert.strictEqual(run('state'),'run');
});

// --- 8. 화면 흔들림이 모든 상태에서 감쇠 ---
t('게임오버 화면에서 흔들림이 0으로 잦아든다',()=>{
  run(`shake=1;state='over';pg.fell=false;for(let i=0;i<120;i++)update(0.016);`);
  assert.strictEqual(run('shake'),0,'over 상태에서 감쇠');
});
t('시작 화면에서도 흔들림이 잦아든다',()=>{
  run(`shake=1;state='start';for(let i=0;i<120;i++)update(0.016);`);
  assert.strictEqual(run('shake'),0,'start 상태에서 감쇠');
});

// --- 7. 장애물이 펭귄보다 크되 넘을 수 있는가 ---
t('몬스터는 펭귄보다 크지만 점프 정점 안에 들어온다',()=>{
  const apex=9*9/(2*21), H=run('A_.H');
  for(const m of JSON.parse(run('JSON.stringify(MONSTERS)'))){
    assert.ok(m.h>H,m.key+' 가 펭귄보다 큼 ('+m.h+'>'+H+')');
    assert.ok(m.h*0.72-0.08 < apex-0.25, m.key+' 넘을 수 있음 (여유 포함)');
  }
});



// --- 에너지: 하루 3판, 오전 9시 충전 ---
t('첫 실행이면 3판이 채워진다',()=>{
  run(`save.day=0;save.energy=0;refillCheck();`);
  assert.strictEqual(run('save.energy'),3);
});
t('같은 날 다시 확인해도 충전되지 않는다',()=>{
  run(`save.energy=1;refillCheck();`);
  assert.strictEqual(run('save.energy'),1);
});
t('날짜가 바뀌면 다시 3판',()=>{
  run(`save.energy=0;save.day=save.day-1;refillCheck();`);
  assert.strictEqual(run('save.energy'),3);
});
t('달리기를 시작하면 1판 소모',()=>{
  run(`save.energy=3;state='start';startRun();`);
  assert.strictEqual(run('save.energy'),2);
  assert.strictEqual(run('state'),'run');
});
t('0판이면 달리기가 시작되지 않는다',()=>{
  run(`save.energy=0;state='start';startRun();`);
  assert.strictEqual(run('state'),'start','상태 그대로');
  assert.strictEqual(run('save.energy'),0,'음수로 안 내려감');
});
t('저장값이 망가져 있어도 범위 안으로 되돌린다',()=>{
  for(const [bad,want] of [[999,3],[-5,0],[undefined,0],['x',0],[2,2]]){
    run(`save.day=gameDay();save.energy=${JSON.stringify(bad)};refillCheck();`);
    assert.strictEqual(run('save.energy'),want,`${bad} -> ${want}`);
    run(`'\u25cf'.repeat(save.energy)+'\u25cb'.repeat(MAX_ENERGY-save.energy)`);  // repeat()이 터지지 않아야 함
  }
});
t('하루 상한은 3판',()=>{
  assert.strictEqual(run('MAX_ENERGY'),3);
  assert.strictEqual(run('DAY_START_H'),9);
});

// --- 구간 테마: 500m마다 순환 ---
t('거리에 따라 테마가 500m마다 바뀐다',()=>{
  const names=JSON.parse(run('JSON.stringify(THEMES.map(t=>t.name))'));
  for(const [d,want] of [[0,0],[499,0],[500,1],[1200,2],[1700,3],[2000,0]]){
    const got=run(`Math.floor(${d}/THEME_EVERY)%THEMES.length`);
    assert.strictEqual(got,want,`${d}m -> ${names[want]}`);
  }
});
t('테마 전환은 섞이는 중에도 색이 범위를 벗어나지 않는다',()=>{
  for(const b of [0,0.3,0.7,1]){
    run(`themeFrom=0;themeIdx=2;themeBlend=${b};applyTheme();`);
    for(const v of JSON.parse(run('JSON.stringify(curTint.concat(curSea,curFog))')))
      assert.ok(v>=0&&v<=1.2,'색 성분 범위: '+v);
  }
});

// --- 곡선은 보이기만 하고 주행 판정은 안 건드린다 ---
t('곡률은 셰이더 전용 — 레인 좌표가 그대로다',()=>{
  assert.strictEqual(JSON.stringify(run('JSON.stringify(LANES)')&&JSON.parse(run('JSON.stringify(LANES)'))),'[-1.5,0,1.5]');
  assert.ok(run('BEND')>0,'곡률 값이 켜져 있음');
});

console.log('\n총 '+pass+'개 통과');
