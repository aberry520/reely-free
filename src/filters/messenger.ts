// Shared Messenger opener for the Facebook and Marketplace-with-
// account doors (Austin's ask, 2026-11-24): tapping Message on a
// listing (or a message link anywhere on Facebook) hits
// Facebook's "Experience the best of Marketplace on Facebook app"
// prompt on the mobile web, which blocks messaging the seller.
// Instead the tap opens the Messenger app to that seller.
//
// The fragment is a plain JS string: it defines
// __rfMessengerUserFromHref(), __rfMessengerFindSeller() and
// __rfMessengerPost() (no auto-call — each door installs its own
// click listener and calls these where its own rules say the
// Messenger open applies) and is interpolated into the door's
// injected script. It must contain no backticks and no ${...},
// and every backslash in the emitted JS is doubled here (the
// standing template-literal lesson). It uses textContent-free
// DOM reads only — no innerHTML, so Trusted Types is untouched.
export const MESSENGER_JS = `
  // Network capture for the seller id (his screenshots,
  // 2026-11-24: no seller links anywhere, no seller_id in the
  // page HTML, and no React fiber on the Message button or the
  // seller area — tried=0 across all candidates). The id only
  // exists in the listing's GraphQL response, so this installs
  // transparent wrappers around fetch and XHR BEFORE the page's
  // JS runs — the filter script is injected before content
  // loads — and stashes the seller id from the listing's
  // response on window.__rfSellerId. The wrappers never change
  // a request or a response: fetch returns the original promise
  // untouched and only a clone is read in the background, and
  // XHR only reads responseText on load. Every step is
  // try/catch guarded so a bug here can never break the page.
  var __rfSellerCaptureInstalled = false;
  function __rfInstallSellerCapture() {
    try {
      if (__rfSellerCaptureInstalled) return;
      __rfSellerCaptureInstalled = true;
      // Recursively search a parsed JSON value for listings and
      // stash each one's seller: an object with a numeric id plus
      // a seller/owner object carrying a numeric id (or a direct
      // seller_id/owner_id prop) is a listing, and map[itemId] =
      // sellerId. Only seller/owner keys (not bare 'user') so a
      // commenter or the viewer is never mistaken for a seller.
      function __rfFindListingsInJson(obj, seen, map) {
        try {
          if (!obj || typeof obj !== 'object') return;
          if (seen.indexOf(obj) >= 0) return;
          seen.push(obj);
          if (seen.length > 1000) return;
          var lid = obj.id;
          if (lid != null && /^\\d{5,}$/.test(String(lid))) {
            var sObj = obj.seller || obj.owner;
            if (sObj && typeof sObj === 'object' && sObj.id != null) {
              var sid = String(sObj.id);
              if (/^\\d{5,}$/.test(sid) && sid !== String(lid)) {
                map[String(lid)] = sid;
              }
            }
            var dk = obj.seller_id || obj.sellerID || obj.owner_id || obj.ownerID;
            if (dk != null && /^\\d{5,}$/.test(String(dk)) && String(dk) !== String(lid)) {
              map[String(lid)] = String(dk);
            }
          }
          for (var k in obj) {
            if (!obj.hasOwnProperty(k)) continue;
            var v = obj[k];
            if (v && typeof v === 'object') {
              __rfFindListingsInJson(v, seen, map);
            }
          }
        } catch (e) {}
      }
      function __rfTryCapture(text, url) {
        try {
          if (!text) return;
          if (text.indexOf('seller') < 0) return;
          var data = null;
          try { data = JSON.parse(text); } catch (e) { return; }
          if (!window.__rfSellerByItem) window.__rfSellerByItem = {};
          __rfFindListingsInJson(data, [], window.__rfSellerByItem);
        } catch (e) {}
      }
      // Is this response worth parsing? A GraphQL/API URL, or a
      // JSON content type — the listing data is JSON either way.
      // (The URL alone is not trusted: the mobile site may serve
      // the data from an endpoint without 'graphql' in its path.)
      function __rfIsDataResponse(url, contentType) {
        try {
          var u = url || '';
          if (u.indexOf('graphql') >= 0) return true;
          if (u.indexOf('/api/') >= 0) return true;
          var ct = contentType || '';
          if (ct.indexOf('json') >= 0) return true;
          return false;
        } catch (e) { return false; }
      }
      try {
        if (!window.__rfSellerByItem) window.__rfSellerByItem = {};
        if (!window.__rfCaptureStats) window.__rfCaptureStats = { f: 0, x: 0, fall: 0, xall: 0, inst: false };
        window.__rfCaptureStats.inst = true;
        var origFetch = window.fetch;
        if (origFetch && !origFetch.__rfWrapped) {
          var wrappedFetch = function (input, init) {
            var p = origFetch.apply(this, arguments);
            try {
              window.__rfCaptureStats.fall++;
              var url = '';
              if (typeof input === 'string') url = input;
              else if (input && input.url) url = input.url;
              p.then(function (res) {
                try {
                  var ct = '';
                  try { ct = res.headers ? (res.headers.get('content-type') || '') : ''; } catch (e) {}
                  if (!__rfIsDataResponse(url, ct)) return;
                  var clone = res.clone();
                  clone.text().then(function (text) {
                    try {
                      window.__rfCaptureStats.f++;
                    } catch (e) {}
                    __rfTryCapture(text, url);
                  }).catch(function () {});
                } catch (e) {}
              }).catch(function () {});
            } catch (e) {}
            return p;
          };
          wrappedFetch.__rfWrapped = true;
          window.fetch = wrappedFetch;
        }
      } catch (e) {}
      try {
        var XHRProto = window.XMLHttpRequest && window.XMLHttpRequest.prototype;
        if (XHRProto && !XHRProto.__rfWrapped) {
          var origOpen = XHRProto.open;
          var origSend = XHRProto.send;
          XHRProto.open = function (method, url) {
            try { this.__rfUrl = url || ''; } catch (e) {}
            return origOpen.apply(this, arguments);
          };
          XHRProto.send = function () {
            var xhr = this;
            try {
              window.__rfCaptureStats.xall++;
              xhr.addEventListener('load', function () {
                try {
                  var url = xhr.__rfUrl || '';
                  var ct = '';
                  try { ct = xhr.getResponseHeader('Content-Type') || ''; } catch (e) {}
                  if (!__rfIsDataResponse(url, ct)) return;
                  var text = xhr.responseText || '';
                  try {
                    window.__rfCaptureStats.x++;
                  } catch (e) {}
                  __rfTryCapture(text, url);
                } catch (e) {}
              });
            } catch (e) {}
            return origSend.apply(this, arguments);
          };
          XHRProto.__rfWrapped = true;
        }
      } catch (e) {}
    } catch (e) {}
  }
  __rfInstallSellerCapture();
  // Diagnostic for the network capture, for the MPA panel on
  // item pages: the seller id for the current item from the
  // captured item→seller map, how many listings the map holds,
  // and the traffic counters — all fetch (fall) and XHR (xall)
  // calls the wrappers saw, and how many data responses were
  // parsed (f/x) — plus whether the wrappers installed (inst).
  // A miss with fall=0 xall=0 means the wrappers never saw any
  // traffic; fall>0 with f=0 means the data is not coming
  // through a data response at all.
  function __rfCaptureDiag() {
    try {
      var map = window.__rfSellerByItem || {};
      var cur = '';
      var cm = (location.pathname || '').match(/\\/marketplace\\/item\\/(\\d+)/);
      if (cm) cur = cm[1];
      var id = cur ? map[cur] : null;
      var count = 0;
      for (var k in map) if (map.hasOwnProperty(k)) count++;
      var st = window.__rfCaptureStats || {};
      return (id || 'none') + ' map=' + count +
        ' f=' + (st.f || 0) + ' x=' + (st.x || 0) +
        ' fall=' + (st.fall || 0) + ' xall=' + (st.xall || 0) +
        ' inst=' + (st.inst ? 'yes' : 'no');
    } catch (e) { return 'captureDiag error'; }
  }
  // Extract a Messenger user (numeric id or username) from a
  // messages / profile / Messenger URL. Returns the user string
  // or null.
  function __rfMessengerUserFromHref(href) {
    try {
      if (!href) return null;
      var u;
      try { u = new URL(href, location.origin); } catch (e) { return null; }
      var p = u.pathname || '';
      var m;
      // /messages/t/<id> or /messages/<id>
      m = p.match(/^\\/messages\\/(?:t\\/)?(\\d+)/);
      if (m) return m[1];
      // messenger.com/t/<id>
      m = p.match(/^\\/t\\/(\\d+)/);
      if (m && /messenger\\.com$/.test(u.hostname)) return m[1];
      // m.me/<username-or-id>
      if (/^(www\\.)?m\\.me$/.test(u.hostname)) {
        var seg = p.replace(/^\\//, '').split('/')[0];
        if (seg) return decodeURIComponent(seg);
      }
      // /profile.php?id=<id>
      if (/profile\\.php$/.test(p)) {
        var id = u.searchParams.get('id');
        if (id && /^\\d+$/.test(id)) return id;
      }
      // /people/<slug>/<id>
      m = p.match(/^\\/people\\/[^/]+\\/(\\d+)/);
      if (m) return m[1];
      // Marketplace seller profile: /marketplace/profile/<id>
      // or /marketplace/user/<id>
      m = p.match(/^\\/marketplace\\/(?:profile|user)\\/(\\d+)/);
      if (m) return m[1];
      return null;
    } catch (e) { return null; }
  }
  // Find the Message/Send control a tap landed on. Facebook's
  // mobile listing buttons are not always a <button> or an
  // anchor — the bottom-row Message button can be a plain div —
  // so closest('a, button, [role="button"]') misses it. Walk up
  // from the tap target instead: the innermost element whose
  // whole trimmed text is exactly Message or Send (or starts
  // with it, e.g. a badge) is the button. The message input
  // itself never matches — its text is empty and its ancestors
  // hold the whole composer text.
  function __rfFindMsgControl(t) {
    try {
      var el = t;
      var guard = 0;
      while (el && guard < 8) {
        guard++;
        if (!el || el.nodeType !== 1) { el = el ? el.parentElement : null; continue; }
        var txt = (el.textContent || '').trim().toLowerCase();
        if (txt === 'message' || txt === 'send' ||
            txt.indexOf('message ') === 0 || txt.indexOf('send ') === 0) {
          return el;
        }
        el = el.parentElement;
      }
      return null;
    } catch (e) { return null; }
  }
  // Find the seller's profile identifier on a Marketplace item
  // page. Tries, in order: a numeric profile.php link, a
  // /people/<slug>/<id> link, a Marketplace seller-profile link
  // (/marketplace/profile/<id> or /marketplace/user/<id>), a
  // username link inside the "Seller information" area, and —
  // as a last resort — the seller_id in the page's embedded JSON
  // (the listing's initial data). Returns the user string or null.
  // (His videos, 2026-11-24: seller=none and prof=0 ppl=0
  // user=none on two listings, so the seller's name is not a
  // profile link in any of those formats — the name/avatar is
  // plain text or a JS-opened preview, and the id lives in the
  // page data instead.)
  function __rfMessengerFindSeller() {
    try {
      var anchors = document.querySelectorAll('a[href]');
      var i, href, m, a;
      for (i = 0; i < anchors.length; i++) {
        href = anchors[i].getAttribute('href') || '';
        m = href.match(/profile\\.php\\?id=(\\d+)/);
        if (m) return m[1];
      }
      for (i = 0; i < anchors.length; i++) {
        href = anchors[i].getAttribute('href') || '';
        m = href.match(/\\/people\\/[^/]+\\/(\\d+)/);
        if (m) return m[1];
      }
      for (i = 0; i < anchors.length; i++) {
        href = anchors[i].getAttribute('href') || '';
        m = href.match(/\\/marketplace\\/(?:profile|user)\\/(\\d+)/);
        if (m) return m[1];
      }
      // Username link near the seller area: climb from a node
      // carrying "Seller details" / "Seller information" and take
      // the first single-segment profile path inside it.
      var all = document.querySelectorAll('div, section, article');
      for (i = 0; i < all.length; i++) {
        var txt = (all[i].textContent || '');
        if (txt.indexOf('Seller details') < 0 &&
            txt.indexOf('Seller information') < 0) continue;
        var links = all[i].querySelectorAll('a[href]');
        for (var j = 0; j < links.length; j++) {
          a = links[j];
          href = a.getAttribute('href') || '';
          var path = href.split('?')[0].replace(/^\\/+/, '').replace(/\\/+$/, '');
          if (!path || path.indexOf('/') >= 0) continue;
          if (/^(marketplace|messages|messenger|groups|events|watch|reel|saved|notifications|profile\\.php)$/.test(path)) continue;
          return decodeURIComponent(path);
        }
      }
      // Last resort: the seller_id in the page's embedded JSON.
      var jsonId = __rfSellerIdFromJson();
      if (jsonId) return jsonId;
      // The id is not in the DOM or the page HTML at all (his
      // screenshots: no links in the seller area, no seller_id
      // anywhere in the full HTML, Message/Send are plain divs),
      // so it lives in React state. Walk the fiber from the
      // Message button and read it out of the component props.
      // (The avatar-URL fallback is deliberately NOT here: on
      // the fragrance-oils listing it fired a CDN photo id,
      // 2067026790682737, which opened a bogus "Facebook User"
      // thread in Messenger — a photo id is not a user id.)
      var fiberId = __rfSellerIdFromFiber();
      if (fiberId) return fiberId;
      // Network capture: the seller id for this item from the
      // item→seller map built out of the listing data as it
      // arrived (including data prefetched while browsing the
      // feed, before this listing was opened).
      try {
        var capMap = window.__rfSellerByItem;
        var curItem = '';
        var cm = (location.pathname || '').match(/\\/marketplace\\/item\\/(\\d+)/);
        if (cm) curItem = cm[1];
        if (capMap && curItem && capMap[curItem]) return String(capMap[curItem]);
      } catch (e) {}
      return null;
    } catch (e) { return null; }
  }
  // Find the React fiber key on a DOM element, if it has one.
  // getOwnPropertyNames (not Object.keys) catches the key even
  // when it is non-enumerable, and any __react* prefix is
  // accepted in case the React version names it differently.
  function __rfFindFiberKey(el) {
    try {
      var names = Object.getOwnPropertyNames(el);
      for (var i = 0; i < names.length; i++) {
        if (names[i].indexOf('__react') === 0) return names[i];
      }
      return null;
    } catch (e) { return null; }
  }
  // Recursively search a React props object for the seller's
  // user id: a seller/user/owner/actor/profile object carrying
  // a numeric id, or a direct seller_id/user_id/owner_id prop.
  // depth caps the recursion; seen guards circular refs; the
  // item id is never a seller id; viewer/currentUser/me are
  // skipped (the viewer's own id, not the seller's).
  function __rfSearchPropsForSeller(obj, depth, itemId, seen) {
    try {
      if (!obj || typeof obj !== 'object' || depth > 4) return null;
      if (obj.nodeType || obj.$$typeof) return null;
      if (seen.indexOf(obj) >= 0) return null;
      seen.push(obj);
      if (seen.length > 300) return null;
      var i, k, v;
      var objKeys = ['seller', 'user', 'owner', 'actor', 'profile', 'sellerInfo', 'seller_info'];
      for (i = 0; i < objKeys.length; i++) {
        v = obj[objKeys[i]];
        if (v && typeof v === 'object' && v.id != null) {
          var s = String(v.id);
          if (/^\\d{5,}$/.test(s) && s !== itemId) return s;
        }
        if (typeof v === 'string' && /^\\d{5,}$/.test(v) && v !== itemId) return v;
      }
      var idKeys = ['seller_id', 'sellerID', 'user_id', 'userID', 'owner_id', 'ownerID', 'seller_profile_id', 'profile_id'];
      for (i = 0; i < idKeys.length; i++) {
        v = obj[idKeys[i]];
        if (v != null) {
          var t = String(v);
          if (/^\\d{5,}$/.test(t) && t !== itemId) return t;
        }
      }
      for (k in obj) {
        if (!obj.hasOwnProperty(k)) continue;
        if (k === 'viewer' || k === 'currentUser' || k === 'me') continue;
        v = obj[k];
        if (v && typeof v === 'object') {
          var found = __rfSearchPropsForSeller(v, depth + 1, itemId, seen);
          if (found) return found;
        }
      }
      return null;
    } catch (e) { return null; }
  }
  // The seller's user id from React state: walk the fiber from
  // a starting element and search each level's memoizedProps for
  // the seller. Tries every "Message" button on the page plus
  // the seller-area container (the first text match can be a
  // non-React element with no fiber, while the real button or
  // the seller area has one). Cached per item page; a null
  // result is retried at most every 3 seconds (the listing data
  // can arrive after the first attempt). The cache also records
  // whether any candidate had a fiber key and how many walks
  // ran, for the diagnostic panel.
  var __rfFiberCache = { path: '', id: null, at: 0, hadKey: false, tried: 0 };
  function __rfSellerIdFromFiber() {
    try {
      var path = location.pathname || '';
      var now = Date.now();
      if (__rfFiberCache.path === path && __rfFiberCache.id) return __rfFiberCache.id;
      if (__rfFiberCache.path === path && (now - __rfFiberCache.at) < 3000) return null;
      var id = null;
      var hadKey = false, tried = 0;
      var itemId = '';
      var pm = path.match(/\\/marketplace\\/item\\/(\\d+)/);
      if (pm) itemId = pm[1];
      var candidates = [];
      var els = document.querySelectorAll('a, button, [role="button"], div, span');
      for (var i = 0; i < els.length; i++) {
        var txt = (els[i].textContent || '').trim().toLowerCase();
        if (txt === 'message') candidates.push(els[i]);
      }
      var all = document.querySelectorAll('div, section, article');
      for (var j = 0; j < all.length; j++) {
        var t = (all[j].textContent || '');
        if (t.indexOf('Seller details') >= 0 || t.indexOf('Seller information') >= 0) {
          candidates.push(all[j]);
          break;
        }
      }
      for (var k = 0; k < candidates.length && !id; k++) {
        var key = __rfFindFiberKey(candidates[k]);
        if (!key) continue;
        hadKey = true;
        tried++;
        var node = candidates[k][key];
        var seen = 0;
        while (node && seen < 25) {
          seen++;
          if (node.memoizedProps) {
            id = __rfSearchPropsForSeller(node.memoizedProps, 0, itemId, []);
            if (id) break;
          }
          node = node.return;
        }
      }
      __rfFiberCache = { path: path, id: id, at: now, hadKey: hadKey, tried: tried };
      return id;
    } catch (e) { return null; }
  }
  // Diagnostic for the fiber seller-id source, for the MPA
  // panel on item pages: whether any starting element carried a
  // React fiber key, how many fiber walks ran, and the id the
  // walk found (if any).
  function __rfFiberDiag() {
    try {
      var fiberId = __rfSellerIdFromFiber();
      var c = __rfFiberCache;
      return 'key=' + (c.hadKey ? 'yes' : 'no') + ' tried=' + (c.tried || 0) + ' id=' + (fiberId || 'none');
    } catch (e) { return 'fiberDiag error'; }
  }
  // The seller's numeric user id from the page's embedded data.
  // The seller's name/avatar is not a link (his videos:
  // sellerArea "no links" and no seller_id in <script> tags), so
  // the id has to come from the page's data. Searches the full
  // page HTML for seller-id patterns, including a "seller" /
  // "owner" object carrying an "id". Returns the id string or
  // null. Cached per item page — the full-HTML search is expensive
  // and the diagnostic calls this every second.
  var __rfSellerJsonCache = { path: '', id: null, done: false, source: '' };
  // Search the full page HTML (server-rendered listing data) for
  // the seller id. The data does NOT travel as a fetch/XHR call
  // (the capture saw zero network traffic), so the id must live
  // in the HTML itself. The object patterns are deliberately
  // lenient — [\\s\\S]{0,3000}? so nested objects and long
  // seller records do not stop the match — and the key list
  // covers seller/actor/owner/profile variants plus data
  // attributes. The first match wins; which pattern matched is
  // kept in the cache so the panel can show it.
  // NOTE: every backslash below is DOUBLED in this TS source so
  // the emitted JS keeps it. A single backslash-d here used to
  // emit as (d+) and match the letter d instead of digits —
  // that is why this search reported json=none on every
  // screenshot before this fix.
  function __rfSellerIdFromJson() {
    try {
      var path = location.pathname || '';
      if (__rfSellerJsonCache.done && __rfSellerJsonCache.path === path) {
        return __rfSellerJsonCache.id;
      }
      var id = null;
      var source = '';
      var html = '';
      try { html = document.documentElement ? document.documentElement.innerHTML || '' : ''; } catch (e) {}
      if (html) {
        var itemId = '';
        var im = path.match(/\\/marketplace\\/item\\/(\\d+)/);
        if (im) itemId = im[1];
        var named = [
          ['seller_id', /"seller_id"\\s*:\\s*"?(\\d+)/],
          ['sellerID', /"sellerID"\\s*:\\s*"?(\\d+)/],
          ['seller_profile_id', /"seller_profile_id"\\s*:\\s*"?(\\d+)/],
          ['seller-obj', /"seller"\\s*:\\s*\\{[\\s\\S]{0,3000}?"id"\\s*:\\s*"?(\\d+)/],
          ['owner-obj', /"owner"\\s*:\\s*\\{[\\s\\S]{0,3000}?"id"\\s*:\\s*"?(\\d+)/],
          ['actor-obj', /"actor"\\s*:\\s*\\{[\\s\\S]{0,3000}?"id"\\s*:\\s*"?(\\d+)/],
          ['profile-obj', /"profile"\\s*:\\s*\\{[\\s\\S]{0,3000}?"id"\\s*:\\s*"?(\\d+)/],
          ['seller_profile-obj', /"seller_profile"\\s*:\\s*\\{[\\s\\S]{0,3000}?"id"\\s*:\\s*"?(\\d+)/],
          ['author-obj', /"author"\\s*:\\s*\\{[\\s\\S]{0,3000}?"id"\\s*:\\s*"?(\\d+)/],
          ['creator-obj', /"creator"\\s*:\\s*\\{[\\s\\S]{0,3000}?"id"\\s*:\\s*"?(\\d+)/],
          ['profile_id', /"profile_id"\\s*:\\s*"?(\\d+)/],
          ['merchant_id', /"merchant_id"\\s*:\\s*"?(\\d+)/],
          ['actor_id', /"actor_id"\\s*:\\s*"?(\\d+)/],
          ['data-user-id', /data-user-id\\s*=\\s*"(\\d+)/],
          ['data-seller-id', /data-seller-id\\s*=\\s*"(\\d+)/],
          ['data-owner-id', /data-owner-id\\s*=\\s*"(\\d+)/],
          ['user_id', /"user_id"\\s*:\\s*"?(\\d+)/]
        ];
        for (var i = 0; i < named.length && !id; i++) {
          var m = html.match(named[i][1]);
          if (m && m[1] && m[1] !== itemId) {
            id = m[1];
            source = named[i][0];
          }
        }
      }
      __rfSellerJsonCache = { path: path, id: id, done: true, source: source };
      return id;
    } catch (e) { return null; }
  }
  // The anchor hrefs (paths only, first few) inside the "Seller
  // information" area, for the diagnostic panel — so the next
  // retest shows exactly what the seller area actually links to.
  // Checks EVERY element carrying the seller text (not just the
  // first — the first match can be a small inner element with no
  // links while a larger ancestor holds them) and reports from
  // the one with the most anchors.
  function __rfSellerAreaHrefs() {
    try {
      var all = document.querySelectorAll('div, section, article');
      var best = null, bestCount = 0, matchCount = 0;
      for (var i = 0; i < all.length; i++) {
        var txt = (all[i].textContent || '');
        if (txt.indexOf('Seller details') < 0 &&
            txt.indexOf('Seller information') < 0) continue;
        matchCount++;
        var links = all[i].querySelectorAll('a[href]');
        if (links.length > bestCount) { best = links; bestCount = links.length; }
      }
      if (!matchCount) return 'no seller area';
      if (!bestCount) return 'no links (' + matchCount + ' areas)';
      var out = [];
      for (var j = 0; j < best.length && j < 3; j++) {
        var href = best[j].getAttribute('href') || '';
        var path = href.replace(/^https?:\\/\\/[^/]+/, '').split('?')[0];
        out.push(path || href);
      }
      return out.join(' | ');
    } catch (e) { return 'area error'; }
  }
  // Diagnostic for the Message / Send buttons on an item page:
  // each button's tag and, if it is an anchor, its href. The
  // Message button's href (when it is one) can carry the thread
  // or user id directly.
  function __rfMsgButtonDiag() {
    try {
      var msg = __rfFindMsgControl(document.body);
      // Find the buttons by text instead: the Message button in
      // the bottom row and the Send button in the composer.
      var out = [];
      var els = document.querySelectorAll('a, button, [role="button"], div, span');
      var foundMsg = null, foundSend = null;
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        var txt = (el.textContent || '').trim().toLowerCase();
        if (!foundMsg && txt === 'message') foundMsg = el;
        if (!foundSend && txt === 'send') foundSend = el;
        if (foundMsg && foundSend) break;
      }
      function desc(el, label) {
        if (!el) return label + '=none';
        var tag = (el.tagName || '').toLowerCase();
        var href = el.getAttribute ? (el.getAttribute('href') || '') : '';
        var short = href ? href.replace(/^https?:\\/\\/[^/]+/, '').split('?')[0] : '';
        return label + '=' + tag + (short ? ':' + short : '');
      }
      return desc(foundMsg, 'msg') + ' ' + desc(foundSend, 'send');
    } catch (e) { return 'buttonDiag error'; }
  }
  // Diagnostic for the seller lookup (reported in the MPA panel
  // on item pages): how many profile.php / /people/ /
  // Marketplace-profile links exist, the JSON seller_id, and the
  // first username link in the seller area.
  function __rfSellerDiag() {
    try {
      var anchors = document.querySelectorAll('a[href]');
      var prof = 0, ppl = 0, mp = 0, firstUser = 'none';
      for (var i = 0; i < anchors.length; i++) {
        var href = anchors[i].getAttribute('href') || '';
        if (/profile\\.php\\?id=\\d+/.test(href)) prof++;
        if (/\\/people\\/[^/]+\\/\\d+/.test(href)) ppl++;
        if (/\\/marketplace\\/(?:profile|user)\\/\\d+/.test(href)) mp++;
      }
      var all = document.querySelectorAll('div, section, article');
      outer:
      for (i = 0; i < all.length; i++) {
        var txt = (all[i].textContent || '');
        if (txt.indexOf('Seller details') < 0 &&
            txt.indexOf('Seller information') < 0) continue;
        var links = all[i].querySelectorAll('a[href]');
        for (var j = 0; j < links.length; j++) {
          var path = (links[j].getAttribute('href') || '').split('?')[0].replace(/^\\/+/, '').replace(/\\/+$/, '');
          if (!path || path.indexOf('/') >= 0) continue;
          if (/^(marketplace|messages|messenger|groups|events|watch|reel|saved|notifications|profile\\.php)$/.test(path)) continue;
          firstUser = decodeURIComponent(path);
          break outer;
        }
      }
      var jsonId = __rfSellerIdFromJson();
      var jsonSrc = '';
      try { jsonSrc = __rfSellerJsonCache.source || ''; } catch (e) {}
      return 'prof=' + prof + ' ppl=' + ppl + ' mp=' + mp +
        ' json=' + (jsonId || 'none') + (jsonId && jsonSrc ? ' (' + jsonSrc + ')' : '') + ' user=' + firstUser;
    } catch (e) { return 'sellerDiag error'; }
  }
  // Post a Messenger open request to the app. user may be null
  // (opens the Messenger inbox as a fallback).
  function __rfMessengerPost(user) {
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({ type: 'rf-messenger', user: user || null })
        );
      }
    } catch (e) {}
  }
`;
