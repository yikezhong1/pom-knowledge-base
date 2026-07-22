var CACHE_NAME = 'pom-kb-v1';
var CACHE_URLS = ['index.html', 'marked.min.js', 'data.json'];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(CACHE_URLS);
    }).then(function() { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE_NAME; }).map(function(k) { return caches.delete(k); }));
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(event) {
  var url = event.request.url;
  /* 只缓存同源GET请求 */
  if (event.request.method !== 'GET' || url.indexOf(self.location.origin) !== 0) return;
  /* customers.json 不缓存（实时数据） */
  if (url.indexOf('customers.json') >= 0) return;
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      var fetchPromise = fetch(event.request).then(function(response) {
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, clone); });
        }
        return response;
      }).catch(function() { return cached; });
      /* 优先返回缓存，后台更新（stale-while-revalidate） */
      return cached || fetchPromise;
    })
  );
});
