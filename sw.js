/**
 * DemocraCy — Service Worker
 * sw.js
 */
"use strict";
const CACHE_NAME="dcy-v3-20260430";
const ASSETS=["./","./index.html","./style.css","./script.js"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",e=>{const u=new URL(e.request.url);const skip=["api.anthropic.com","googletagmanager.com","firestore.googleapis.com","firebase.googleapis.com"];if(skip.some(h=>u.hostname.includes(h)))return;e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request).then(r=>{if(!r||r.status!==200)return r;const cl=r.clone();caches.open(CACHE_NAME).then(ca=>ca.put(e.request,cl));return r;})));});
