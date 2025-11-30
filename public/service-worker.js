self.addEventListener("install", (e) => self.skipWaiting());

self.addEventListener("activate", (e) => {
  clients.claim();
});

// Keep service worker active (important for PWA behaviour)
setInterval(() => {}, 10000);
