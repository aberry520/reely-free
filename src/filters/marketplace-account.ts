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
  // a near-top, full-width, bar-height element grouping at least
  // three of Facebook's top destinations (home, friends, watch,
  // notifications, marketplace, groups, messages, menu). The
  // cover mirrors its rect exactly, so it rides with the bar
  // when Facebook slides it away and back.
  var SIG = {
    '/': 1, '/friends': 1, '/friends/': 1, '/watch': 1, '/watch/': 1,
    '/notifications': 1, '/notifications/': 1, '/marketplace': 1,
    '/marketplace/': 1, '/groups': 1, '/groups/': 1, '/messages': 1,
    '/messages/': 1, '/menu': 1, '/menu/': 1
  };
  function sigPath(a) {
    var href = a.getAttribute('href') || '';
    return href.split('?')[0].split('#')[0];
  }
  function findTabBar() {
    var links = document.querySelectorAll('a[href]');
    var seed = null;
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (a.closest && a.closest('#rf-mpa-cover')) continue;
      if (!SIG[sigPath(a)]) continue;
      var r = a.getBoundingClientRect();
      if (r.height === 0 || r.top < -10 || r.top > 160) continue;
      seed = a;
      break;
    }
    if (!seed) return null;
    var el = seed, depth = 0;
    while (el && depth < 8) {
      var rr = el.getBoundingClientRect();
      if (rr.width >= window.innerWidth * 0.95 &&
          rr.height >= 30 && rr.height <= 90) {
        var inside = el.querySelectorAll('a[href]');
        var count = 0;
        for (var j = 0; j < inside.length; j++) {
          if (SIG[sigPath(inside[j])]) count++;
        }
        if (count >= 3) return el;
      }
      if (rr.height > 120) break;
      el = el.parentElement;
      depth++;
    }
    return null;
  }
  var cover = null;
  function ensureCover() {
    if (cover && cover.isConnected) return cover;
    var host = document.body || document.documentElement;
    if (!host) return null;
    cover = document.createElement('div');
    cover.id = 'rf-mpa-cover';
    cover.style.cssText =
      'position:fixed;z-index:99990;display:none;align-items:center;' +
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
  true;
})();
`;
}
