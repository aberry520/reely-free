import type { FilterSettings } from '../lib/settings';
import { LOGO_MARK_DATA_URI } from './logo-data';

// Builds the JavaScript injected into facebook.com before page
// content loads, for the Marketplace door WITH his account
// (Austin's ask, 2026-11-23): he signs into Facebook as usual —
// this door shares the Facebook door's session — but the rest of
// Facebook is ignored. The door opens on Marketplace and stays
// there:
//
//  - A route guard runs on load and on a loop: any facebook.com
//    page outside the allowed set is replaced with Marketplace
//    home. That covers redirects (Facebook loves sending you to
//    the feed after login) and JS-driven navigation the tap guard
//    can't see.
//  - A capture-phase tap guard swallows taps on links that would
//    leave the allowed set, so the top nav (Home, Watch, groups,
//    profile) simply does nothing instead of bouncing him around.
//  - Allowed: Marketplace itself, the sign-in flow (/login,
//    /checkpoint, /recover, two-step — without those he could
//    never log in), and, behind its own toggle, message threads
//    (/messages, /messenger paths) for talking to buyers/sellers.
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
  });
  const logo = JSON.stringify(LOGO_MARK_DATA_URI);

  return `
(function () {
  var S = ${s};
  if (!S.enabled) { true; return; }
  var HOME = 'https://www.facebook.com/marketplace';
  var LOGO_SRC = ${logo};
  function isFb() {
    return /(^|\\.)facebook\\.com$/.test(location.hostname);
  }
  function allowed(path) {
    if (path.indexOf('/marketplace') === 0) return true;
    if (path.indexOf('/login') === 0) return true;
    if (path.indexOf('/checkpoint') === 0) return true;
    if (path.indexOf('/recover') === 0) return true;
    if (path.indexOf('/two_step_verification') === 0) return true;
    if (S.allowMessages) {
      if (path.indexOf('/messages') === 0) return true;
      if (path.indexOf('/messenger') === 0) return true;
    }
    return false;
  }
  if (S.stay) {
    function guard() {
      try {
        if (isFb() && !allowed(location.pathname)) {
          location.replace(HOME);
        }
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
        if (!allowed(u.pathname)) {
          ev.preventDefault();
          ev.stopPropagation();
        }
      } catch (e) {}
    }, true);
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
  // Count the outermost tappable icon-sized controls inside a
  // candidate strip (a control nested inside another control is
  // the same button, counted once).
  function isControl(n) {
    return n.matches &&
      n.matches('a, button, [role="button"], [role="link"]');
  }
  function iconControls(el) {
    var nodes = el.querySelectorAll(
      'a, button, [role="button"], [role="link"]');
    var er = el.getBoundingClientRect();
    var n = 0;
    for (var i = 0; i < nodes.length; i++) {
      var p = nodes[i].parentElement, nested = false;
      while (p && p !== el) {
        if (isControl(p)) { nested = true; break; }
        p = p.parentElement;
      }
      if (nested) continue;
      var r = nodes[i].getBoundingClientRect();
      if (r.width >= 20 && r.width <= 72 &&
          r.height >= 20 && r.height <= 72 &&
          Math.abs(r.top - er.top) <= 10) n++;
    }
    return n;
  }
  function findTabBar() {
    var sigs = topSigLinks();
    // Primary: climb from each signature link near the top to a
    // bar-shaped ancestor holding at least three of them.
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
    // Fallback (round 3): identify the bar by SHAPE alone. Two
    // rounds of link matching found nothing on Austin's phone —
    // the mobile nav icons are evidently not plain anchors at
    // all (script-driven buttons), so no signature link exists
    // to require. The bar's shape is unmistakable though: the
    // topmost full-width strip, bar-height, holding a row of at
    // least four icon-sized tappable controls. The Marketplace
    // title row below it holds only two controls (back, search)
    // and the chips row sits lower and uses wide pills, so
    // neither can qualify.
    var cands = document.querySelectorAll(
      'nav, header, [role="navigation"], [role="banner"], div');
    var best = null, bestCount = 3, bestTop = 1e9;
    for (var i = 0; i < cands.length; i++) {
      var c = cands[i];
      if (c.closest && c.closest('#rf-mpa-cover')) continue;
      var cr = c.getBoundingClientRect();
      if (cr.top < -5 || cr.top > 80) continue;
      if (cr.width < window.innerWidth * 0.95) continue;
      if (cr.height < 36 || cr.height > 80) continue;
      var n = iconControls(c);
      if (n < 4) continue;
      if (n > bestCount || (n === bestCount && cr.top < bestTop)) {
        best = c;
        bestCount = n;
        bestTop = cr.top;
      }
    }
    return best;
  }
  var cover = null;
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
      var r = bar.getBoundingClientRect();
      if (r.bottom <= 0 || r.top > 140 || r.height < 24) {
        if (cover) cover.style.display = 'none';
        return;
      }
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
      c.style.left = r.left + 'px';
      c.style.top = r.top + 'px';
      c.style.width = r.width + 'px';
      c.style.height = r.height + 'px';
      c.style.borderBottom = '1px solid rgba(128,128,128,0.35)';
      c.style.display = 'flex';
    } catch (e) {}
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
  // TEMPORARY diagnostic (2026-11-23): three rounds of tab-bar
  // detection missed on Austin's phone, so instead of guessing a
  // fourth, the page reports its actual top-region structure to
  // the app, which displays it for a screenshot. What element
  // sits under the icons (elementFromPoint chains), what the
  // signature scan sees, what the finder picked, and where the
  // cover ended up. Remove once the finder is proven.
  function desc(el) {
    if (!el || !el.tagName) return 'null';
    var r = el.getBoundingClientRect();
    var s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id.slice(0, 24);
    var role = el.getAttribute && el.getAttribute('role');
    if (role) s += '[' + role + ']';
    var al = el.getAttribute && el.getAttribute('aria-label');
    if (al) s += '("' + al.slice(0, 20) + '")';
    var tid = el.getAttribute &&
      (el.getAttribute('data-testid') || el.getAttribute('data-test-id'));
    if (tid) s += ' testid=' + tid.slice(0, 24);
    s += ' @' + Math.round(r.left) + ',' + Math.round(r.top) +
      ' ' + Math.round(r.width) + 'x' + Math.round(r.height);
    return s;
  }
  function chain(el, n) {
    var out = [];
    var e = el;
    for (var i = 0; i < n && e; i++) {
      out.push(desc(e));
      e = e.parentElement;
    }
    return out;
  }
  // The report is rendered INTO the page itself (v2): a red
  // beacon strip across the very top proves the new script is
  // actually running in the door — it depends on nothing but the
  // injection — and a dark panel at the bottom carries the full
  // report as plain text for a screenshot. (v1 posted the report
  // to the app for a native box; nothing appeared at all, which
  // left script-delivery and the message bridge indistinguishable.)
  function renderBeacon(text) {
    var host = document.body || document.documentElement;
    if (!host) return;
    var b = document.getElementById('rf-diag-beacon');
    if (!b) {
      b = document.createElement('div');
      b.id = 'rf-diag-beacon';
      b.style.cssText =
        'position:fixed;top:0;left:0;right:0;height:20px;' +
        'z-index:2147483647;background:#e11d48;color:#fff;' +
        'font:11px/20px monospace;text-align:center;';
      host.appendChild(b);
    }
    b.textContent = text;
  }
  function renderPanel(text) {
    var host = document.body || document.documentElement;
    if (!host) return;
    var panel = document.getElementById('rf-diag-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'rf-diag-panel';
      panel.style.cssText =
        'position:fixed;left:0;right:0;bottom:0;max-height:46%;' +
        'overflow:auto;z-index:2147483647;background:rgba(10,10,10,0.94);' +
        'color:#7dff8a;font:10px/1.5 monospace;padding:8px;' +
        'white-space:pre-wrap;word-break:break-all;';
      host.appendChild(panel);
    }
    panel.textContent = text;
  }
  function sendDiag() {
    try {
      var bar = null;
      try { bar = findTabBar(); } catch (e) {}
      var sigs = [];
      try { sigs = topSigLinks(); } catch (e) {}
      var hdrs = [];
      var hEls = document.querySelectorAll(
        'header, nav, [role="banner"], [role="navigation"]');
      for (var h = 0; h < hEls.length && h < 4; h++) {
        hdrs.push(desc(hEls[h]));
      }
      var sigPaths = sigs.map(function (a) { return pathOf(a); }).slice(0, 8);
      var coverDesc = cover
        ? desc(cover) + ' display=' + cover.style.display
        : 'not-created';
      renderBeacon(
        'RF-DIAG v2 sig=' + sigs.length +
        ' bar=' + (bar ? 'FOUND' : 'NONE') +
        ' brand=' + S.brandHeader);
      var lines = [
        'RF-DIAG v2',
        'path=' + location.pathname +
          ' vw=' + window.innerWidth + ' vh=' + window.innerHeight,
        'S brand=' + S.brandHeader + ' stay=' + S.stay +
          ' promo=' + S.blockAppPromo + ' msg=' + S.allowMessages,
        'sig=' + sigs.length + ' paths=' + sigPaths.join(' '),
        'bar=' + (bar ? desc(bar) : 'NONE') +
          ' icons=' + (bar ? iconControls(bar) : 0),
        'cover=' + coverDesc,
        'hdrs: ' + hdrs.join(' | '),
        'atHome: ' + chain(document.elementFromPoint(55, 44), 5).join(' > '),
        'atMid: ' + chain(document.elementFromPoint(200, 44), 5).join(' > '),
        'atBell: ' + chain(document.elementFromPoint(290, 44), 5).join(' > ')
      ].join('\\n');
      renderPanel(lines);
      if (window.ReactNativeWebView &&
          window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'rf-diag',
          text: lines
        }));
      }
    } catch (e) {}
  }
  if (S.brandHeader) {
    var diagSent = 0;
    var diagTimer = setInterval(function () {
      diagSent++;
      sendDiag();
      if (diagSent >= 4) clearInterval(diagTimer);
    }, 2000);
  }
  true;
})();
`;
}
