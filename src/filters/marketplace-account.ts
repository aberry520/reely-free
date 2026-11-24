import type { FilterSettings } from '../lib/settings';
import { LOGO_MARK_DATA_URI } from './logo-data';
import { PHOTO_VIEWER_JS } from './photo-viewer';
import { DIAG_JS } from './diag';
import { MESSENGER_JS } from './messenger';

// Builds the JavaScript injected into facebook.com before page
// content loads, for the Marketplace door WITH his account
// (Austin's ask, 2026-11-23): he signs into Facebook as usual —
// this door shares the Facebook door's session — but the rest of
// Facebook is ignored. The door opens on Marketplace and stays
// there:
//
//  - A route guard runs on load and on a loop: a facebook.com
//    page on the block list is replaced with Marketplace home.
//    That covers redirects (Facebook loves sending you to the
//    feed after login) and JS-driven navigation the tap guard
//    can't see. The guard is a DENYLIST, not an allowlist
//    (Austin, 2026-11-23): it only targets the established
//    rabbit holes — the feed, Watch, Reels, groups, and the rest
//    of the Facebook chrome — plus login prompts. Everything
//    else, including any Marketplace popup or overlay Facebook
//    routes through an unexpected path, is left alone. The
//    allowlist kept breaking legitimate Marketplace features,
//    and that was the annoyance.
//  - A capture-phase tap guard swallows taps on links to a
//    blocked page, so the top nav (Home, Watch, groups,
//    profile) simply does nothing instead of bouncing him around.
//  - Blocked: the home feed (/), Watch, Reels, groups,
//    notifications, gaming, videos, events, stories, saved,
//    memories, profile, friends, pages. Allowed, and never
//    policed: Marketplace itself, the photo viewer, the sign-in
//    flow (/login, /checkpoint, /recover, two-step — without
//    those he could never log in), and, behind its own toggle,
//    message threads (/messages, /messenger paths) for talking
//    to buyers/sellers.
//  - Other hosts (e.g. messenger.com) are left alone entirely —
//    the guard only polices facebook.com.
//  - The 'Open app' footer bar is hidden with the same rule the
//    Facebook door uses (innermost label match + hide the bar it
//    sits in), behind its own toggle — Austin's screenshot showed
//    this door wearing the bar while the other doors don't.
//  - Facebook's icon tab bar at the very top is COVERED (never
//    hidden or restructured — the cover lesson) with a branded
//    strip: "Reely" — the logo mark — "Free", all in one line,
//    glued to the bar's exact box so it scrolls and returns with
//    it (Austin's ask, 2026-11-23). Marketplace's own header row
//    underneath (back chevron, title, search) is not the tab bar
//    and stays untouched.
//
// With "stay in Marketplace" off, the stay rules stand down and
// the door is just Facebook starting on Marketplace (the promo
// and header rules still apply, like the Facebook door).
export function buildMarketplaceAccountScript(
  settings: FilterSettings,
): string {
  const s = JSON.stringify({
    enabled: settings.featureMarketplaceAccount,
    stay: settings.mpaStayInMarketplace,
    allowMessages: settings.mpaAllowMessages,
    blockAppPromo: settings.mpaBlockAppPromo,
    brandHeader: settings.mpaBrandHeader,
    diagnostics: settings.diagnosticsEnabled,
    openMessenger: settings.mpaOpenMessenger,
  });
  const logo = JSON.stringify(LOGO_MARK_DATA_URI);

  return `
(function () {
  var S = ${s};
  if (!S.enabled) { true; return; }
  var HOME = 'https://www.facebook.com/marketplace';
  var LOGO_SRC = ${logo};
${DIAG_JS}
${MESSENGER_JS}
  function isFb() {
    return /(^|\\.)facebook\\.com$/.test(location.hostname);
  }
  // Denylist (Austin, 2026-11-23): only these paths get bounced.
  // Everything else — Marketplace itself, the photo viewer, the
  // sign-in flow, messages, search, settings, and any popup or
  // overlay Facebook routes through an unexpected path — is left
  // alone. The old allowlist bounced legitimate Marketplace
  // features (location, search, categories all route through
  // "/"), which was the annoyance.
  function blocked(path) {
    if (path === '/' || path === '') return true;
    if (path.indexOf('/watch') === 0) return true;
    if (path.indexOf('/reel') === 0) return true;
    if (path.indexOf('/groups') === 0) return true;
    if (path.indexOf('/notifications') === 0) return true;
    if (path.indexOf('/gaming') === 0) return true;
    if (path.indexOf('/videos') === 0) return true;
    if (path.indexOf('/events') === 0) return true;
    if (path.indexOf('/stories') === 0) return true;
    if (path.indexOf('/saved') === 0) return true;
    if (path.indexOf('/memories') === 0) return true;
    if (path.indexOf('/profile.php') === 0) return true;
    if (path.indexOf('/friends') === 0) return true;
    if (path.indexOf('/pages') === 0) return true;
    return false;
  }
  if (S.stay) {
    // A Marketplace overlay is open (location, search, categories):
    // Facebook routes these through the home-feed path "/" — the
    // same path the guard bounces — so the guard has to stand down
    // while one is open, or the overlay gets kicked back to the
    // feed the moment it opens. Proved by the diagnostic (his
    // video, 2026-11-23): every bounce was "/", while the overlay
    // itself sat on /marketplace. Detect by the overlay's own
    // header text, which only exists while it is open and visible.
    function mpaOverlayOpen() {
      try {
        if (!document.body) return false;
        var markers = ['Location and radius', 'Search Marketplace', 'Buy & Sell Groups'];
        var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
        var node;
        while ((node = walker.nextNode())) {
          var v = node.nodeValue || '';
          for (var i = 0; i < markers.length; i++) {
            if (v.indexOf(markers[i]) !== -1) {
              var el = node.parentElement;
              if (el) {
                var r = el.getBoundingClientRect();
                if (r.width > 0 && r.height > 0) return true;
              }
            }
          }
        }
        return false;
      } catch (e) { return false; }
    }
    // The home feed, for the "/" bounce: Facebook routes
    // Marketplace overlays — and their sub-pickers, like the
    // location search and the radius list — through "/" too, so
    // the guard can't bounce "/" by path alone. It has to confirm
    // the page is actually the feed. The feed's composer and
    // stories are the tell; overlays and sub-pickers have neither.
    function isFacebookFeed() {
      try {
        if (!document.body) return false;
        var markers = ["What's on your mind?", 'Stories'];
        var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
        var node;
        while ((node = walker.nextNode())) {
          var v = node.nodeValue || '';
          for (var i = 0; i < markers.length; i++) {
            if (v.indexOf(markers[i]) !== -1) {
              var el = node.parentElement;
              if (el) {
                var r = el.getBoundingClientRect();
                if (r.width > 0 && r.height > 0) return true;
              }
            }
          }
        }
        return false;
      } catch (e) { return false; }
    }
    function guard() {
      try {
        if (!isFb() || !blocked(location.pathname)) return;
        var p = location.pathname;
        if (p === '/' || p === '') {
          // "/" is both the feed and the route Marketplace
          // overlays (and their sub-pickers) use — only bounce
          // when it's actually the feed, and no Marketplace
          // overlay is open.
          if (!isFacebookFeed() || mpaOverlayOpen()) return;
        }
        location.replace(HOME);
      } catch (e) {}
    }
    guard();
    setInterval(guard, 600);
    document.addEventListener('click', function (ev) {
      try {
        if (!isFb()) return;
        var t = ev.target;
        var a = t && t.closest ? t.closest('a[href]') : null;
        if (!a) return;
        var href = a.getAttribute('href');
        if (!href) return;
        var u;
        try { u = new URL(href, location.origin); } catch (e) { return; }
        if (u.origin !== location.origin) return;
        if (blocked(u.pathname)) {
          ev.preventDefault();
          ev.stopPropagation();
        }
      } catch (e) {}
    }, true);
  }
  // Open the Messenger app on message taps (Austin's ask,
  // 2026-11-24): on a listing, tapping Message (or Send in the
  // "Send seller a message" composer) hits Facebook's "Experience
  // the best of Marketplace on Facebook app" prompt on the mobile
  // web, which blocks messaging the seller. Instead the tap opens
  // the Messenger app to that seller. Installed once, independent
  // of the stay guard above (messaging should open Messenger even
  // with Stay off). The pre-filled composer text does NOT carry
  // over — Messenger has no deep link that pre-fills a message —
  // so he types it in Messenger.
  if (S.openMessenger) {
    try {
      document.addEventListener('click', function (ev) {
        try {
          if (!isFb()) return;
          if (location.pathname.indexOf('/marketplace/item/') !== 0) return;
          var t = ev.target;
          // The control: an anchor with a messages href, or the
          // Message/Send button found by walking up from the tap
          // (the bottom-row Message button can be a plain div, so
          // closest('a, button, [role="button"]') misses it — his
          // video, 2026-11-24: the prompt still fired on a tap).
          var user = null;
          var a = t && t.closest ? t.closest('a[href]') : null;
          if (a) user = __rfMessengerUserFromHref(a.getAttribute('href'));
          if (!user) {
            var ctrl = __rfFindMsgControl(t);
            if (!ctrl) return;
            user = __rfMessengerFindSeller();
          }
          ev.preventDefault();
          ev.stopPropagation();
          if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
          __rfMessengerPost(user);
        } catch (e) {}
      }, true);
    } catch (e) {}
  }
  // The 'Open app' bar: ported from the Facebook door's filter.
  // Find the innermost element carrying one of the known labels
  // and hide the bar it sits in (climb while ancestors stay short
  // and nearly full-width).
  function hide(el) {
    try {
      el.setAttribute('data-rf-hidden', '1');
      el.style.setProperty('display', 'none', 'important');
    } catch (e) {}
  }
  function hideBar(node) {
    var candidate = node, el = node, depth = 0;
    while (el && depth < 6) {
      el = el.parentElement; depth++;
      if (!el) break;
      if (el.clientWidth >= window.innerWidth * 0.9 &&
          el.clientHeight > 0 && el.clientHeight <= 160) {
        candidate = el;
      } else if (el.clientHeight > 160) {
        break;
      }
    }
    hide(candidate);
  }
  function sweepPromo() {
    if (!S.blockAppPromo || !isFb()) return;
    var ctas = document.querySelectorAll('a, button, [role="button"], div, span');
    for (var c = 0; c < ctas.length; c++) {
      var cel = ctas[c];
      if (cel.getAttribute('data-rf-hidden')) continue;
      var ctext = (cel.textContent || '').trim();
      if (ctext !== 'Open app' && ctext !== 'Open App' &&
          ctext !== 'Get the app' && ctext !== 'Use the app') continue;
      if (cel.querySelector && cel.querySelector('a, button, [role="button"], div, span')) continue;
      if (cel.clientHeight > 90) continue;
      hideBar(cel);
    }
  }
  // The branded header cover. The tab bar is found by signature:
  // a near-top, full-width, bar-height element grouping several
  // of Facebook's top destinations (home, friends, watch,
  // notifications, marketplace, groups, messages, menu). The
  // cover mirrors its rect exactly, so it rides with the bar
  // when Facebook slides it away and back.
  //
  // Round 1 of this finder never fired on Austin's phone: it
  // matched raw href strings against exact paths, but the mobile
  // site's nav links carry absolute URLs and path variants, so
  // nothing ever qualified. Round 2 parses every href properly,
  // matches on the first path segment, climbs from several seed
  // links instead of one, and falls back to a structural scan
  // (a top strip full of tappable icons) if the signature climb
  // finds nothing.
  function pathOf(a) {
    var href = a.getAttribute('href') || '';
    try {
      return new URL(href, location.origin).pathname;
    } catch (e) {
      return href.split('?')[0].split('#')[0];
    }
  }
  function isSigPath(p) {
    if (p === '/' || p === '/home.php') return true;
    var seg = p.split('/')[1] || '';
    return seg === 'friends' || seg === 'watch' ||
      seg === 'notifications' || seg === 'marketplace' ||
      seg === 'groups' || seg === 'messages' ||
      seg === 'messenger' || seg === 'menu' || seg === 'bookmarks';
  }
  function topSigLinks() {
    var out = [];
    var links = document.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (a.closest && a.closest('#rf-mpa-cover')) continue;
      if (!isSigPath(pathOf(a))) continue;
      var r = a.getBoundingClientRect();
      if (r.height === 0 || r.top < -20 || r.top > 180) continue;
      out.push(a);
    }
    return out;
  }
  // The bar, as proven by the in-page diagnostic on Austin's
  // phone (2026-11-23): the mobile nav is a [role="tablist"] of
  // [role="tab"] DIVS — aria-labels like "feed, 1,800 new, 1 of
  // 6", "messages, 3 of 6" — each about 71x50 at the very top,
  // inside a tablist that is ~94px tall because the sticky
  // header block continues into the page's own title row below
  // the icons. There are no anchors in it at all (sig=0), which
  // is why three rounds of link/shape finders missed. The cover
  // is pinned to the viewport top at the tabs' row height (the
  // icon row only, ~50px), so the title row underneath stays
  // visible and usable.
  function findTabBar() {
    var lists = document.querySelectorAll('[role="tablist"]');
    for (var i = 0; i < lists.length; i++) {
      var list = lists[i];
      var lr = list.getBoundingClientRect();
      // No lower bound on top: the nav can scroll above the
      // viewport fold, and the cover is pinned anyway (below).
      // Anything below the fold is not the nav.
      if (lr.top > 80) continue;
      if (lr.width < window.innerWidth * 0.9) continue;
      var tabs = list.querySelectorAll('[role="tab"]');
      if (tabs.length < 5) continue;
      // Facebook's main nav tabs announce their position
      // ("…, 3 of 6"); require that pattern on at least two so
      // a content tab strip scrolled to the top can't qualify.
      var positioned = 0;
      for (var t = 0; t < tabs.length; t++) {
        var al = tabs[t].getAttribute('aria-label') || '';
        if (/of \\d+/.test(al)) positioned++;
      }
      if (positioned >= 2) return list;
    }
    // Fallback: climb from signature links near the top (older
    // markup where the nav entries are real anchors).
    var sigs = topSigLinks();
    for (var s = 0; s < sigs.length && s < 6; s++) {
      var el = sigs[s], depth = 0;
      while (el && depth < 10) {
        el = el.parentElement;
        depth++;
        if (!el) break;
        var rr = el.getBoundingClientRect();
        if (rr.height > 110) break;
        if (rr.width >= window.innerWidth * 0.95 && rr.height >= 28) {
          var count = 0;
          for (var k = 0; k < sigs.length; k++) {
            if (el.contains(sigs[k])) count++;
          }
          if (count >= 3) return el;
        }
      }
    }
    return null;
  }
  // The rect to cover: the union of the bar's tabs when it has
  // any (the tablist element itself is taller than the icon
  // row), otherwise the element's own rect.
  function barRect(bar) {
    var tabs = bar.querySelectorAll
      ? bar.querySelectorAll('[role="tab"]')
      : [];
    var top = 1e9, bottom = -1e9, left = 1e9, right = -1e9;
    for (var i = 0; i < tabs.length; i++) {
      var r = tabs[i].getBoundingClientRect();
      if (r.height === 0 || r.width === 0) continue;
      if (r.top < top) top = r.top;
      if (r.bottom > bottom) bottom = r.bottom;
      if (r.left < left) left = r.left;
      if (r.right > right) right = r.right;
    }
    if (bottom < 0) return bar.getBoundingClientRect();
    return {
      top: top,
      bottom: bottom,
      left: left,
      right: right,
      width: right - left,
      height: bottom - top
    };
  }
  var cover = null;
  // Height of the icon row the last time it was measurable;
  // the cover keeps this height while pinned.
  var pinnedH = 50;
  function ensureCover() {
    if (cover && cover.isConnected) return cover;
    var host = document.body || document.documentElement;
    if (!host) return null;
    cover = document.createElement('div');
    cover.id = 'rf-mpa-cover';
    cover.style.cssText =
      'position:fixed;z-index:2147483647;display:none;align-items:center;' +
      'justify-content:center;gap:9px;box-sizing:border-box;' +
      'font-weight:800;font-size:21px;letter-spacing:0.2px;';
    var left = document.createElement('span');
    left.textContent = 'Reely';
    var img = document.createElement('img');
    img.src = LOGO_SRC;
    img.style.cssText =
      'height:30px;width:30px;border-radius:8px;display:block;';
    var right = document.createElement('span');
    right.textContent = 'Free';
    cover.appendChild(left);
    cover.appendChild(img);
    cover.appendChild(right);
    host.appendChild(cover);
    return cover;
  }
  function positionCover() {
    try {
      if (!S.brandHeader || !isFb()) {
        if (cover) cover.style.display = 'none';
        return;
      }
      var bar = findTabBar();
      if (!bar) {
        if (cover) cover.style.display = 'none';
        return;
      }
      var r = barRect(bar);
      if (r.height >= 24 && r.height <= 90) pinnedH = r.height;
      var c = ensureCover();
      if (!c) return;
      var bg = '';
      var fg = '';
      var ff = '';
      try {
        var bs = getComputedStyle(document.body);
        bg = bs.backgroundColor;
        fg = bs.color;
        ff = bs.fontFamily;
      } catch (e) {}
      if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') {
        bg = '#ffffff';
      }
      c.style.backgroundColor = bg;
      c.style.color = fg || '#111111';
      if (ff) c.style.fontFamily = ff;
      // Pinned: the strip stays at the viewport top while the
      // door is open, instead of tracking the bar's rect — the
      // bar scrolls off or drifts on scroll, and the strip used
      // to vanish with it. It hides only when the nav itself is
      // gone from the page (findTabBar returned null above).
      c.style.left = '0px';
      c.style.top = '0px';
      c.style.width = window.innerWidth + 'px';
      c.style.height = pinnedH + 'px';
      c.style.borderBottom = '1px solid rgba(128,128,128,0.35)';
      c.style.display = 'flex';
    } catch (e) {}
  }
  // Diagnostic lines (Austin's ask, 2026-11-24): what the door's
  // filter sees, behind the Settings toggle. stay = the guard is
  // on; overlay = a Marketplace overlay is open (location, search,
  // categories — all route through "/"); feed = the page is
  // actually the Facebook feed (what "/" bounces on); cover = the
  // Reely Free header strip is up; viewer = our photo viewer.
  function diagLines() {
    try {
      var cover = !!document.getElementById('rf-mpa-cover');
      var viewer = !!document.querySelector('[data-rf-viewer]');
      var lines = [
        'MPA path=' + (location.pathname || ''),
        'stay=' + (S.stay ? 'YES' : 'NO') +
          ' overlay=' + (mpaOverlayOpen() ? 'YES' : 'NO') +
          ' feed=' + (isFacebookFeed() ? 'YES' : 'NO'),
        'cover=' + (cover ? 'YES' : 'NO') +
          ' viewer=' + (viewer ? 'YES' : 'NO'),
      ];
      if (location.pathname.indexOf('/marketplace/item/') === 0) {
        var found = __rfMessengerFindSeller();
        lines[2] += ' seller=' + (found || 'none');
        lines.push('sellerLinks: ' + __rfSellerDiag());
        lines.push('sellerArea: ' + __rfSellerAreaHrefs());
        lines.push('buttons: ' + __rfMsgButtonDiag());
      }
      return lines;
    } catch (e) { return ['MPA diag error']; }
  }
  function apply() {
    try { sweepPromo(); } catch (e) {}
    try { positionCover(); } catch (e) {}
  }
  if (S.blockAppPromo || S.brandHeader) {
    apply();
    var pending = false;
    try {
      var obs = new MutationObserver(function () {
        if (!pending) {
          pending = true;
          setTimeout(function () { pending = false; apply(); }, 400);
        }
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {}
    setInterval(apply, 3000);
  }
  if (S.brandHeader) {
    var ticking = false;
    var onScroll = function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        positionCover();
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
  }
  // Photo viewer (our own): tapping a listing photo opens the
  // overlay instead of Facebook's viewer, which navigates away
  // and gets bounced by the stay-guard. Only while Stay in
  // Marketplace is on — with it off, Facebook's viewer works
  // natively.
  ${PHOTO_VIEWER_JS}
  if (S.stay) { installPhotoViewer(); }
  // Diagnostic panel (Settings toggle): refresh the shared panel
  // once a second with this door's lines. Only when the toggle is
  // on — the WebView remounts when the setting changes, so turning
  // it off drops the panel with the page reload. This interval is
  // separate from apply(), which only runs when the promo sweep
  // or header cover is on.
  if (S.diagnostics) {
    setInterval(function () { __rfDiag(diagLines()); }, 1000);
  }
  true;
})();
`;
}
