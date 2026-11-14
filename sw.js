/* Service Worker - Ahmed Saeed Barber Salon - Cashier
   - Offline-first: الصفحة تفتح من الكاش فورًا وتعمل بدون إنترنت
   - التحديث لا يُطبَّق أبدًا من تلقاء نفسه: الإصدار الجديد يُحمَّل في الانتظار، والتطبيق يظل يفتح من
     الإصدار المؤكَّد (accepted) حتى لو أُغلق وفُتح، إلى أن يضغط المستخدم «تحديث» ويؤكد أنه نزّل نسخة احتياطية
   - بيانات الفواتير في LocalStorage/IndexedDB وليست في الكاش */
const VERSION = 'v3.3.4';
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

const META = PREFIX + 'meta';
const getAccepted = () => caches.open(META).then((c) => c.match('accepted')).then((r) => (r ? r.text() : '')).catch(() => '');
const setAccepted = (v) => caches.open(META).then((c) => c.put('accepted', new Response(v)));

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(CORE.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => null)))
    ).then(() => getAccepted()).then((acc) => { if (!acc) return setAccepted(VERSION); })
  );
  /* لا skipWaiting هنا عمدًا: التفعيل بعد موافقة المستخدم حتى لا تتغير الصفحة وهو يعمل */
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    getAccepted().then((acc) => caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== META && k !== CACHE && k !== PREFIX + acc).map((k) => caches.delete(k)))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  const d = e.data, port = e.ports && e.ports[0];
  if (d && d.type === 'STATE') { e.waitUntil(getAccepted().then((acc) => port && port.postMessage({ version: VERSION, accepted: acc }))); return; }
  if (d === 'ACCEPT' || (d && d.type === 'ACCEPT')) { e.waitUntil(setAccepted(VERSION).then(() => { if (port) port.postMessage({ ok: 1 }); return self.skipWaiting(); })); }
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* الصفحة: دائمًا من الإصدار المؤكَّد، ولا يُستبدل في الخلفية أبدًا */
  if (req.mode === 'navigate') {
    e.respondWith(
      getAccepted().then((acc) => caches.open(PREFIX + (acc || VERSION)).then((c) => c.match('./index.html')))
        .then((cached) => cached || caches.match('./index.html'))
        .then((cached) => cached || fetch(req))
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
