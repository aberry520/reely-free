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
//
// With "stay in Marketplace" off, the script is inert and the door
// is just Facebook starting on Marketplace.
export function buildMarketplaceAccountScript(
  settings: FilterSettings,
): string {
  const s = JSON.stringify({
    enabled: settings.featureMarketplaceAccount,
    stay: settings.mpaStayInMarketplace,
    allowMessages: settings.mpaAllowMessages,
  });

  return `
(function () {
  var S = ${s};
  if (!S.enabled || !S.stay) { true; return; }
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
  true;
})();
`;
}
