"use strict";
const CACHE="ryzova-wonder-device-lab-v1";
const scope=self.registration.scope;
const asset=path=>new URL(path,scope).href;
const SHELL=[
  "./","./index.html","./lab.js","./manifest.webmanifest",
  "../basic-pwa/icons/icon-192.png","../basic-pwa/icons/icon-512.png",
  "../../src/wonder.js","../../src/store.js","../../src/capabilities.js",
  "../../src/compute.js","../../src/compute-worker.js","../../src/compute.wasm",
  "../../src/lifecycle.js","../../src/backup.js","../../src/files.js",
  "../../src/scheduler.js","../../src/hardware.js",
  "../../src/recovery.js","../../src/reconnect.js","../../src/pwa.js",
  "../../src/sync-security.js"
].map(asset);
self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await cache.addAll(SHELL);
  })());
});
self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    for(const key of await caches.keys())
      if(key.startsWith("ryzova-wonder-device-lab-")&&key!==CACHE)
        await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener("fetch",event=>{
  const req=event.request, url=new URL(req.url);
  if(req.method!=="GET"||url.origin!==self.location.origin||url.pathname.startsWith("/api/"))return;
  if(req.mode==="navigate"){
    if(!url.href.startsWith(scope))return;
    event.respondWith((async()=>{
      try{const response=await fetch(req);if(response.ok)return response;}catch{}
      return await caches.match(asset("./index.html"))??Response.error();
    })());
    return;
  }
  if(!SHELL.includes(url.href))return;
  event.respondWith((async()=>await caches.match(req)??await fetch(req))());
});
