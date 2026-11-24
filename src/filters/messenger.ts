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
      return null;
    } catch (e) { return null; }
  }
  // The seller's numeric user id from the page's embedded data.
  // The seller's name/avatar is not a link (his videos:
  // sellerArea "no links" and no seller_id in <script> tags), so
  // the id has to come from the page's data. Searches the full
  // page HTML for seller-id patterns, including a "seller" /
  // "owner" object carrying an "id". Returns the id string or
  // null. Cached per item page — the full-HTML search is expensive
  // and the diagnostic calls this every second.
  var __rfSellerJsonCache = { path: '', id: null, done: false };
  function __rfSellerIdFromJson() {
    try {
      var path = location.pathname || '';
      if (__rfSellerJsonCache.done && __rfSellerJsonCache.path === path) {
        return __rfSellerJsonCache.id;
      }
      var id = null;
      var html = '';
      try { html = document.documentElement ? document.documentElement.innerHTML || '' : ''; } catch (e) {}
      if (html) {
        var patterns = [
          /"seller_id"\\s*:\\s*"?(\d+)/,
          /"sellerID"\\s*:\\s*"?(\d+)/,
          /"seller_profile_id"\\s*:\\s*"?(\d+)/,
          /"seller"\\s*:\\s*\{[^}]{0,400}?"id"\\s*:\\s*"?(\d+)/,
          /"owner"\\s*:\\s*\{[^}]{0,400}?"id"\\s*:\\s*"?(\d+)/,
          /"profile_id"\\s*:\\s*"?(\d+)/,
          /"merchant_id"\\s*:\\s*"?(\d+)/
        ];
        for (var i = 0; i < patterns.length && !id; i++) {
          var m = html.match(patterns[i]);
          if (m) id = m[1];
        }
      }
      __rfSellerJsonCache = { path: path, id: id, done: true };
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
      return 'prof=' + prof + ' ppl=' + ppl + ' mp=' + mp +
        ' json=' + (jsonId || 'none') + ' user=' + firstUser;
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
