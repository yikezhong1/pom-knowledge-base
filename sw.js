var CACHE_NAME = 'pom-kb-202608311608';
/* 2026-08-24 升 v4：v3 缓存了 Bug A 修复前的旧 index.html，导致教授"看不到"23日日报。
   升版本号让旧 SW 激活时清掉 v3 缓存，强制重新拉取含 Bug A 修复的新 index.html。 */
/* 预缓存骨架：导航页 + JS 库。数据文件(data-index.json / cat-*.json)走运行时懒加载缓存 */
var CACHE_URLS = ['index.html', 'marked.min.js', 'purify.min.js', 'fuse.min.js', 'lib/leaflet/leaflet.min.css', 'lib/leaflet/leaflet.min.js'];

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

function staleWhileRevalidate(request) {
  return caches.match(request).then(function(cached) {
    var fetchPromise = fetch(request).then(function(response) {
      if (response && response.status === 200) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) { cache.put(request, clone); });
      }
      return response;
    }).catch(function() { return cached; });
    return cached || fetchPromise;
  });
}

/* 数据文件(目录索引/分类json)：联网优先，断网才回退缓存。
   绝不能 staleWhileRevalidate —— 否则会先把"部署前的旧数据"喂给页面，
   造成"首屏能看到新内容、刷新后旧内容"的诡异现象。 */
function networkFirst(request) {
  return fetch(request).then(function(response) {
    if (response && response.status === 200) {
      var clone = response.clone();
      caches.open(CACHE_NAME).then(function(cache) { cache.put(request, clone); });
    }
    return response;
  }).catch(function() {
    return caches.match(request);
  });
}

self.addEventListener('fetch', function(event) {
  var url = event.request.url;
  /* 只缓存同源 GET 请求 */
  if (event.request.method !== 'GET' || url.indexOf(self.location.origin) !== 0) return;
  /* customers.json 不缓存（实时客户数据，绝不走缓存/不覆盖） */
  if (url.indexOf('customers.json') >= 0) return;

  var isDataIndex = url.indexOf('data-index.json') >= 0;
  var isCat = /\/cat-[^/]+\.json(\?|$)/.test(url);
  /* 懒加载数据文件(data-index / cat-*)：联网优先，断网回退缓存 → 永远拿到最新数据 */
  if (isDataIndex || isCat) {
    event.respondWith(networkFirst(event.request));
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

  /* 静态资源(JS 库等)：缓存优先，后台更新（stale-while-revalidate） */
  event.respondWith(staleWhileRevalidate(event.request));
});
