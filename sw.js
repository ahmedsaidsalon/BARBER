/* Service Worker - Ahmed Saeed Barber Salon - Cashier
   - Offline-first: الصفحة تفتح من الكاش فورًا وتعمل بدون إنترنت
   - التحديث: عند الاتصال يُفحص sw.js تلقائيًا؛ إذا تغيّر (غيّر VERSION) يُجهَّز الإصدار الجديد
     في الانتظار، وتظهر للمستخدم رسالة التحديث. لا يتفعّل إلا عند ضغط زر التحديث (SKIP_WAITING)
   - بيانات الفواتير في LocalStorage/IndexedDB وليست في الكاش، فلا تتأثر بأي تحديث */
const VERSION = 'v3.1.6';
const PREFIX = 'ahmed-saeed-cashier-';
const CACHE = PREFIX + VERSION;
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(CORE.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => null)))
    )
  );
  /* لا skipWaiting هنا عمدًا: التفعيل بعد موافقة المستخدم حتى لا تتغير الصفحة وهو يعمل */
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING' || (e.data && e.data.type === 'SKIP_WAITING')) self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* الصفحة: من الكاش فورًا، وتحديث الكاش في الخلفية للإصدار القادم */
  if (req.mode === 'navigate') {
    e.respondWith(
      caches.match('./index.html').then((cached) => {
        const net = fetch(req).then((res) => {
          if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('./index.html', copy)); }
          return res;
        }).catch(() => cached);
        return cached || net;
      })
    );
    return;
  }

  /* باقي الملفات (نفس النطاق + خطوط Google): Stale-While-Revalidate */
  const sameOrigin = url.origin === self.location.origin;
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname) || (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/'));
  if (!sameOrigin && !isFont) return;
  e.respondWith(
    caches.match(req).then((cached) => {
      const net = fetch(req).then((res) => {
        if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
