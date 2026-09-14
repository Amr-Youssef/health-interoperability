/* Service Worker — المنصة الوطنية للربط الصحي
   App-shell caching ONLY. Patient/clinical data (/api, /fhir) is NEVER cached (PDPL). */
var CACHE = 'saudi-health-v1';
var SHELL = [
  '/',
  '/auth/login.html',
  '/auth/register.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/style.min.css',
  '/auth/auth.min.css',
  '/app.min.js',
  '/js/vitals-charts.min.js',
  '/js/patient-self-reported.min.js',
  '/auth/auth.min.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
  '/icons/apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function isApi(url) {
  return url.pathname.indexOf('/api') === 0 || url.pathname.indexOf('/fhir') === 0;
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  /* Clinical data: network only, never cached, never served stale */
  if (isApi(url)) {
    e.respondWith(fetch(req));
    return;
  }
  /* Navigations: network first, then cache, then offline page */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) { return hit || caches.match('/offline.html'); });
      })
    );
    return;
  }
  /* Static shell: cache first with background revalidation */
  e.respondWith(
    caches.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    })
  );
});
