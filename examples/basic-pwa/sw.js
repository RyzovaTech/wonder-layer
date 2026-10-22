"use strict";
const CACHE="ryzova-wonder-integration-v3";
const scope=self.registration.scope;
const asset=(path)=>new URL(path,scope).href;
const SHELL=[
  "./","./index.html","./app.js","./styles.css","./manifest.webmanifest",
  "./icons/icon-192.png","./icons/icon-512.png",
  "../../src/wonder.js","../../src/store.js","../../src/capabilities.js",
  "../../src/compute.js","../../src/compute-worker.js","../../src/compute.wasm",
  "../../src/lifecycle.js","../../src/backup.js","../../src/files.js",
  "../../src/scheduler.js","../../src/hardware.js",
  "../../src/recovery.js","../../src/reconnect.js","../../src/pwa.js"
].map(asset);
self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await cache.addAll(SHELL);
   })());
});
// Never auto-activate a replacement worker over unsaved user data.
self.addEventListener("message",event=>{
  if(event.data?.type==="WONDER_ACTIVATE_UPDATE")void self.skipWaiting();
});
self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    for(const key of await caches.keys()){
      if(key.startsWith("ryzova-wonder-integration-") && key!==CACHE)await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener("fetch",event=>{
  const req=event.request,url=new URL(req.url);
  if(req.method!=="GET"||url.origin!==self.location.origin||url.pathname.startsWith("/api/"))return;
  if(req.mode==="navigate"){
    // Network first for updates, cached shell when fully offline.
    if(!url.href.startsWith(scope))return;
    event.respondWith((async()=>{
      try{const fresh=await fetch(req);if(fresh.ok)return fresh;}catch{}
      return (await caches.match(asset("./index.html")))??Response.error();
    })());return;
  }
  if(!SHELL.includes(url.href))return;
  event.respondWith((async()=>((await caches.match(req))??await fetch(req)))());
});

