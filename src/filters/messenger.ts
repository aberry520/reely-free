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
      return null;
    } catch (e) { return null; }
  }
  // Find the seller's profile identifier on a Marketplace item
  // page. Prefers a numeric profile.php link (the seller's name /
  // avatar), then a username link near the "Seller details" text.
  // Returns the user string or null.
  function __rfMessengerFindSeller() {
    try {
      var anchors = document.querySelectorAll('a[href]');
      var i, href, m, a;
      for (i = 0; i < anchors.length; i++) {
        href = anchors[i].getAttribute('href') || '';
        m = href.match(/profile\\.php\\?id=(\\d+)/);
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
      return null;
    } catch (e) { return null; }
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
