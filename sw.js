// 모델 5.7MB를 캐시해 두 번째 실행부터는 오프라인에서도 열리게 한다.
// 모델/아이콘을 바꾸면 CACHE 번호를 올릴 것 — 캐시 우선이라 안 올리면 옛 파일이 계속 쓰인다.
const CACHE='penguinrun-v1';
const SHELL=['./','./index.html','./manifest.webmanifest','./icon-32.png','./icon-180.png','./icon-192.png','./icon-512.png'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys()
    .then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
  const put=res=>{if(res.ok){const c=res.clone();caches.open(CACHE).then(x=>x.put(r,c))}return res};
  // HTML은 네트워크 우선 — 안 그러면 게임을 고쳐도 영영 옛 버전이 열린다.
  if(r.mode==='navigate'||new URL(r.url).pathname.endsWith('.html')){
    e.respondWith(fetch(r).then(put).catch(()=>caches.match(r).then(h=>h||caches.match('./index.html'))));
    return;
  }
  // 모델·아이콘은 캐시 우선 (크고 거의 안 바뀜).
  e.respondWith(caches.match(r).then(hit=>hit||fetch(r).then(put)));
});
