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
  // The seller's numeric user id from the page's embedded JSON
  // (the listing's initial data). Searches the <script> tags for
  // "seller_id" followed by a number. Returns the id string or
  // null. First match wins — the main listing's data loads first.
  // (Every backslash is doubled in this TS source so the emitted
  // JS keeps them — the standing template-literal lesson.)
  function __rfSellerIdFromJson() {
    try {
      var scripts = document.querySelectorAll('script');
      for (var i = 0; i < scripts.length; i++) {
        var text = scripts[i].textContent || '';
        if (!text) continue;
        var m = text.match(/"seller_id"\\s*:\\s*"?(\d+)/);
        if (m) return m[1];
        m = text.match(/"sellerID"\\s*:\\s*"?(\d+)/);
        if (m) return m[1];
      }
      return null;
    } catch (e) { return null; }
  }
  // The anchor hrefs (paths only, first few) inside the "Seller
  // information" area, for the diagnostic panel — so the next
  // retest shows exactly what the seller area actually links to.
  function __rfSellerAreaHrefs() {
    try {
      var all = document.querySelectorAll('div, section, article');
      for (var i = 0; i < all.length; i++) {
        var txt = (all[i].textContent || '');
        if (txt.indexOf('Seller details') < 0 &&
            txt.indexOf('Seller information') < 0) continue;
        var links = all[i].querySelectorAll('a[href]');
        if (!links.length) return 'no links';
        var out = [];
        for (var j = 0; j < links.length && j < 3; j++) {
          var href = links[j].getAttribute('href') || '';
          var path = href.replace(/^https?:\\/\\/[^/]+/, '').split('?')[0];
          out.push(path || href);
        }
        return out.join(' | ');
      }
      return 'no seller area';
    } catch (e) { return 'area error'; }
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
