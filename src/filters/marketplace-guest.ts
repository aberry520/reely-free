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
    blockLoginBar: settings.mpGuestBlockLoginBar,
  });

  return `
(function () {
  var S = ${s};
  if (!S.dismissLogin && !S.blockLoginBar) { true; return; }
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
  // The bottom login prompt (his report, 2026-11-23): logged-out desktop
  // Marketplace pins a full-width bar to the bottom of the screen with
  // Log in / Create account buttons. It is not a dialog and has no
  // password field, so the wall-hiding above misses it. Find it by
  // shape: fixed to the bottom edge, nearly full width, bar height, and
  // carrying a login call-to-action — then hide the outermost such bar.
  // Anything holding listing links is never touched.
  function hideBottomLoginBar() {
    try {
      var els = document.querySelectorAll('div, section, footer, form');
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (el.getAttribute('data-rf-hidden')) continue;
        var pos = '';
        try { pos = window.getComputedStyle(el).position; } catch (e) {}
        if (pos !== 'fixed' && pos !== 'sticky') continue;
        var r = el.getBoundingClientRect();
        if (r.height < 24 || r.height > 160) continue;
        if (r.width < window.innerWidth * 0.9) continue;
        if (Math.abs(r.bottom - window.innerHeight) > 6) continue;
        if (isListingHolder(el)) continue;
        var text = el.textContent || '';
        if (text.indexOf('Log in') < 0 && text.indexOf('Log In') < 0 &&
            text.indexOf('Create new account') < 0 &&
            text.indexOf('Create account') < 0 &&
            text.indexOf('Sign up') < 0) continue;
        // Climb to the outermost ancestor that is still a bottom bar,
        // so padding/background wrappers go with it.
        var bar = el;
        var p = el.parentElement;
        while (p) {
          var pr = p.getBoundingClientRect();
          var ppos = '';
          try { ppos = window.getComputedStyle(p).position; } catch (e) {}
          if ((ppos === 'fixed' || ppos === 'sticky') &&
              pr.height >= 24 && pr.height <= 180 &&
              pr.width >= window.innerWidth * 0.9 &&
              Math.abs(pr.bottom - window.innerHeight) <= 6 &&
              !isListingHolder(p)) {
            bar = p; p = p.parentElement;
          } else break;
        }
        bar.setAttribute('data-rf-hidden', '1');
        bar.style.setProperty('display', 'none', 'important');
      }
    } catch (e) {}
  }
  function apply() {
    if (S.dismissLogin) {
      if (!tryClose()) hideLoginWalls();
    }
    if (S.blockLoginBar) hideBottomLoginBar();
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
