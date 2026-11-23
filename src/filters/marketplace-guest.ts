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
  // Persistent hide: an inline display:none can be wiped when Facebook's
  // React re-renders the node (his recording, 2026-11-23: the panel was
  // hidden, then popped back). A stylesheet rule keyed on the marker
  // attribute survives inline-style resets, so once an element is marked
  // it stays hidden. Re-injected from apply() if the page drops it.
  function ensureStyle() {
    try {
      if (document.getElementById('rf-guest-style')) return;
      var st = document.createElement('style');
      st.id = 'rf-guest-style';
      st.textContent = '[data-rf-hidden]{display:none !important;}';
      (document.head || document.documentElement).appendChild(st);
    } catch (e) {}
  }
  ensureStyle();
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
  // The big login panel (his screenshot, 2026-11-23 10:05): a tall white
  // panel — "Log in or sign up for Facebook to connect with friends…"
  // over a blue Log In button, "or", and a green Create new account
  // button. The bottom-bar rule missed it twice over: the panel is far
  // taller than a bar (~a third of the screen) and it sits in the page
  // flow under the listings rather than fixed to the viewport. Find it
  // by its signature instead of its shape: the container that holds
  // BOTH a "Log In" control and a "Create new account" control, is
  // wide, and holds no listing links. Climb from either button to the
  // outermost such container and hide that. The lone Log In button in
  // the page header (top right, same screenshot) is hidden on its own.
  function hideLoginPanel() {
    try {
      var ctrls = document.querySelectorAll('a, button, [role="button"]');
      for (var i = 0; i < ctrls.length; i++) {
        var c = ctrls[i];
        if (c.getAttribute('data-rf-hidden')) continue;
        if (c.closest && c.closest('[data-rf-hidden]')) continue;
        var t = (c.textContent || '').trim();
        var isLogin = t === 'Log In' || t === 'Log in';
        var isCreate = t === 'Create new account' || t === 'Create account';
        if (!isLogin && !isCreate) continue;
        // Innermost only: a wrapper whose text is exactly the label
        // because it wraps the real button would double-count.
        if (c.querySelector && c.querySelector('a, button, [role="button"]')) continue;
        var r0 = c.getBoundingClientRect();
        // Header Log In button: near the top of the page, hide just it.
        if (isLogin && r0.top >= 0 && r0.top < 140 && r0.height <= 60) {
          c.setAttribute('data-rf-hidden', '1');
          c.style.setProperty('display', 'none', 'important');
          continue;
        }
        // Panel: climb while ancestors still hold both controls, stay
        // wide, stay under ~80% of the viewport tall, and never swallow
        // listings. The climb must NOT stop at narrow ancestors: in his
        // screenshot the two buttons sit in a centered column about
        // half the panel's width, so the first ancestors are narrow and
        // only the panel itself is wide — record any ancestor that
        // qualifies and keep climbing to the outermost one, stopping
        // only at a listing holder or when height runs away (ancestors
        // only get taller from there).
        var best = null;
        var el = c.parentElement;
        var depth = 0;
        while (el && depth < 12) {
          depth++;
          if (isListingHolder(el)) break;
          var r = el.getBoundingClientRect();
          if (r.height > window.innerHeight * 0.85) break;
          if (r.width >= window.innerWidth * 0.8) {
            var hasLogin = false, hasCreate = false;
            var inner = el.querySelectorAll('a, button, [role="button"]');
            for (var k = 0; k < inner.length; k++) {
              var it = (inner[k].textContent || '').trim();
              if (it === 'Log In' || it === 'Log in') hasLogin = true;
              if (it === 'Create new account' || it === 'Create account') hasCreate = true;
            }
            if (hasLogin && hasCreate) best = el;
          }
          el = el.parentElement;
        }
        if (best) {
          best.setAttribute('data-rf-hidden', '1');
          best.style.setProperty('display', 'none', 'important');
        }
      }
    } catch (e) {}
  }
  // Orphaned backdrop (his recording, 2026-11-23 10:20): after a few
  // actions Facebook throws a modal login prompt; the filter hides the
  // dialog itself, but the full-screen grey wash behind it is a
  // SEPARATE element and stays — covering everything and eating every
  // tap. Sweep for it: a fixed/absolute element covering essentially
  // the whole viewport that contains nothing visible — no text, no
  // links, buttons, inputs, images or video once hidden elements are
  // discounted. Only runs when we have actually hidden something (a
  // marked element exists), and anything holding listing links is
  // never touched, so a real overlay like the photo viewer (which has
  // visible controls and an image) is safe.
  function isEffectivelyVisible(el) {
    try {
      if (el.closest && el.closest('[data-rf-hidden]')) return false;
      var r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return false;
      var cs = window.getComputedStyle(el);
      return cs.display !== 'none' && cs.visibility !== 'hidden';
    } catch (e) { return false; }
  }
  function hideOrphanBackdrops() {
    try {
      if (!document.querySelector('[data-rf-hidden]')) return;
      var els = document.querySelectorAll('div, section');
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (el.getAttribute('data-rf-hidden')) continue;
        var pos = '';
        try { pos = window.getComputedStyle(el).position; } catch (e) {}
        if (pos !== 'fixed' && pos !== 'absolute') continue;
        var r = el.getBoundingClientRect();
        if (r.width < window.innerWidth * 0.95) continue;
        if (r.height < window.innerHeight * 0.95) continue;
        if (isListingHolder(el)) continue;
        var text = '';
        try { text = (el.innerText || '').trim(); } catch (e) {}
        if (text.length > 0) continue;
        var content = el.querySelectorAll(
          'a, button, input, select, textarea, [role="button"], [role="link"], img, video, iframe'
        );
        var blocked = false;
        for (var k = 0; k < content.length; k++) {
          if (isEffectivelyVisible(content[k])) { blocked = true; break; }
        }
        if (blocked) continue;
        el.setAttribute('data-rf-hidden', '1');
        el.style.setProperty('display', 'none', 'important');
      }
    } catch (e) {}
  }
  function apply() {
    ensureStyle();
    if (S.dismissLogin) {
      if (!tryClose()) hideLoginWalls();
    }
    if (S.blockLoginBar) {
      hideBottomLoginBar();
      hideLoginPanel();
    }
    if (S.dismissLogin || S.blockLoginBar) hideOrphanBackdrops();
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
