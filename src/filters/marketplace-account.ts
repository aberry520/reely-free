import type { FilterSettings } from '../lib/settings';

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
//
// With "stay in Marketplace" off, the stay rules stand down and
// the door is just Facebook starting on Marketplace (the promo
// rule still applies, like the Facebook door).
export function buildMarketplaceAccountScript(
  settings: FilterSettings,
): string {
  const s = JSON.stringify({
    enabled: settings.featureMarketplaceAccount,
    stay: settings.mpaStayInMarketplace,
    allowMessages: settings.mpaAllowMessages,
    blockAppPromo: settings.mpaBlockAppPromo,
  });

  return `
(function () {
  var S = ${s};
  if (!S.enabled) { true; return; }
  var HOME = 'https://www.facebook.com/marketplace';
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
  function apply() {
    try {
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
    } catch (e) {}
  }
  if (S.blockAppPromo) {
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
  true;
})();
`;
}
