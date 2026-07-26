var CACHE_NAME = 'pom-kb-202607270046';
var CACHE_URLS = ['index.html', 'marked.min.js', 'purify.min.js', 'data.json'];

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

  /* 数据(data.json)：先给旧缓存、后台更新 → 复访秒开（最大文件，提速关键） */
  var isData = url.indexOf('data.json') >= 0;
  if (isData) {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        var fetchPromise = fetch(event.request).then(function(response) {
          if (response && response.status === 200) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, clone); });
          }
          return response;
        }).catch(function() { return cached; });
        return cached || fetchPromise;
      })
    );
    return;
  }

  /* 导航页(index.html)：联网优先，确保新版本 Service Worker 正常激活 */
  var isNav = event.request.mode === 'navigate' || url.indexOf('index.html') >= 0 || url.slice(-1) === '/';
  if (isNav) {
    event.respondWith(
      fetch(event.request).then(function(response) {
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, clone); });
        }
        return response;
      }).catch(function() {
        return caches.match(event.request).then(function(c) { return c || fetch(event.request); });
      })
    );
    return;
  }

  /* 静态资源(JS库等)：缓存优先，后台更新（stale-while-revalidate） */
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      var fetchPromise = fetch(event.request).then(function(response) {
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, clone); });
        }
        return response;
      }).catch(function() { return cached; });
      return cached || fetchPromise;
    })
  );
});
