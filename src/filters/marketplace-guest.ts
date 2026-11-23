import type { FilterSettings } from '../lib/settings';

// Builds the JavaScript injected into the DESKTOP facebook.com/marketplace
// before page content loads, for the experimental guest door.
//
// Why desktop: the mobile site (m.facebook.com) hard-walls Marketplace
// behind a login. The desktop site has historically let a logged-out
// visitor dismiss the login prompt and browse/search listings — no
// messaging, saving, alerts or selling, those always need an account.
//
// What this script does, on a loop because Facebook re-throws the wall:
//  1. Clicks the login prompt's own Close (X) button when it appears —
//     using Facebook's dismiss path is safer than hiding its markup.
//  2. If a login dialog survives (contains a password field), hides the
//     dialog and its backdrop — but never anything holding actual
//     Marketplace listing links.
//  3. Releases the scroll lock the prompt puts on the page.
// Everything is wrapped defensively: a filter bug must never break the
// page itself. Controlled by the mpGuestDismissLogin setting; when off,
// the door is just the plain desktop site in a desktop-UA WebView.
export function buildMarketplaceGuestScript(
  settings: FilterSettings,
): string {
  const s = JSON.stringify({
    dismissLogin: settings.mpGuestDismissLogin,
  });

  return `
(function () {
  var S = ${s};
  if (!S.dismissLogin) { true; return; }
  function isListingHolder(el) {
    try {
      return !!(el.querySelector &&
        el.querySelector('a[href*="/marketplace/item/"]'));
    } catch (e) { return false; }
  }
  function unlockScroll() {
    try {
      var els = [document.documentElement, document.body];
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (!el) continue;
        if (el.style.overflow === 'hidden') el.style.removeProperty('overflow');
        if (el.style.position === 'fixed') el.style.removeProperty('position');
      }
    } catch (e) {}
  }
  function tryClose() {
    try {
      // The prompt's own close control: aria-labelled Close buttons, or a
      // button whose whole label is the multiplication X.
      var btns = document.querySelectorAll(
        '[aria-label="Close"], [aria-label="close"], [role="button"], button'
      );
      for (var i = 0; i < btns.length; i++) {
        var b = btns[i];
        var label = (b.getAttribute('aria-label') || '').toLowerCase();
        var text = (b.textContent || '').trim();
        if (label !== 'close' && text !== '\\u00d7' && text !== '\\u2715') continue;
        // Only inside or near a dialog/login context, never a random
        // Close on a listing photo viewer etc.
        var near = b.closest
          ? (b.closest('[role="dialog"], [role="alertdialog"], form') || b.parentElement)
          : b.parentElement;
        var nearText = near ? (near.textContent || '') : '';
        var nearForm = near && near.querySelector
          ? near.querySelector('input[type="password"], input[name="email"], input[name="pass"]')
          : null;
        if (!nearForm && nearText.indexOf('Log in') < 0 && nearText.indexOf('Log In') < 0) continue;
        b.click();
        return true;
      }
    } catch (e) {}
    return false;
  }
  function hideLoginWalls() {
    try {
      var dialogs = document.querySelectorAll(
        '[role="dialog"], [role="alertdialog"]'
      );
      for (var i = 0; i < dialogs.length; i++) {
        var d = dialogs[i];
        if (d.getAttribute('data-rf-hidden')) continue;
        var hasPassword = d.querySelector
          ? d.querySelector('input[type="password"]')
          : null;
        if (!hasPassword) continue;
        if (isListingHolder(d)) continue;
        d.setAttribute('data-rf-hidden', '1');
        d.style.setProperty('display', 'none', 'important');
        // Hide a dimmed backdrop sibling if one was left behind.
        var parent = d.parentElement;
        if (parent && !isListingHolder(parent)) {
          var kids = parent.children;
          for (var k = 0; k < kids.length; k++) {
            var sib = kids[k];
            if (sib === d) continue;
            var cs = '';
            try { cs = window.getComputedStyle(sib).position; } catch (e) {}
            if (cs === 'fixed' && !sib.querySelector('a, button, input')) {
              sib.setAttribute('data-rf-hidden', '1');
              sib.style.setProperty('display', 'none', 'important');
            }
          }
        }
      }
    } catch (e) {}
  }
  function apply() {
    if (!tryClose()) hideLoginWalls();
    unlockScroll();
  }
  apply();
  var pending = false;
  try {
    var obs = new MutationObserver(function () {
      if (!pending) {
        pending = true;
        setTimeout(function () { pending = false; apply(); }, 350);
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}
  setInterval(apply, 2500);
  true;
})();
`;
}
