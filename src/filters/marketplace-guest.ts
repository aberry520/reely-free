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
    enabled: settings.featureGuestMarketplace,
    dismissLogin: settings.mpGuestDismissLogin,
    blockLoginBar: settings.mpGuestBlockLoginBar,
    nativeShare: settings.mpGuestNativeShare,
  });

  return `
(function () {
  var S = ${s};
  if (!S.enabled || (!S.dismissLogin && !S.blockLoginBar && !S.nativeShare)) { true; return; }
  // Native share (Austin's ask, 2026-11-23): Facebook's own share
  // flow is useless logged out — its dialog wants an account. So a
  // tap on a Share control never reaches Facebook: the click is
  // captured first, the listing's link is resolved (the item link of
  // the card the button belongs to; on a listing page, the page
  // itself; a sharer link's target if that's what was tapped), and
  // the link is posted out to the app, which opens the phone's own
  // share sheet with it. Installed once, independent of the apply()
  // loop below.
  if (S.nativeShare) {
    try {
      document.addEventListener('click', function (ev) {
        try {
          if (location.pathname.indexOf('/marketplace/') < 0) return;
          var t = ev.target;
          var ctrl = t && t.closest
            ? t.closest('a, button, [role="button"], [role="menuitem"]')
            : null;
          if (!ctrl) return;
          var url = null;
          var href = ctrl.getAttribute && ctrl.getAttribute('href');
          if (href && (href.indexOf('/sharer/') >= 0 ||
                       href.indexOf('dialog/share') >= 0 ||
                       href.indexOf('/share/') >= 0)) {
            try {
              var u = new URL(href, location.origin);
              url = u.searchParams.get('u') || u.searchParams.get('href') || null;
            } catch (e) {}
          }
          if (!url) {
            var label = ((ctrl.getAttribute && ctrl.getAttribute('aria-label')) || '').trim().toLowerCase();
            var text = (ctrl.textContent || '').trim().toLowerCase();
            var isShare = label === 'share' || text === 'share' ||
              label.indexOf('share ') === 0 || text.indexOf('share ') === 0 ||
              label.indexOf('share:') === 0 || text.indexOf('share:') === 0;
            if (!isShare) return;
            var el = ctrl;
            var guard = 0;
            while (el && guard < 14 && !url) {
              guard++;
              var a = el.querySelector
                ? el.querySelector('a[href*="/marketplace/item/"]')
                : null;
              if (a) url = a.href;
              el = el.parentElement;
            }
            if (!url) url = location.href;
          }
          if (!url || url.indexOf('http') !== 0) return;
          ev.preventDefault();
          ev.stopPropagation();
          if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(
              JSON.stringify({ type: 'rf-share', url: url })
            );
          }
        } catch (e) {}
      }, true);
    } catch (e) {}
  }
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
      // ONLY the marker rule lives here now. An earlier version also
      // forced 'html,body{overflow:auto !important;position:static
      // !important;...}' permanently to beat the modal's scroll lock —
      // and the bisect proved that override was poison: with both
      // toggles off (no stylesheet) he scrolled ~20 listings to the
      // wall, but with the filter on, scrolling silently died at the
      // end of the first batch (~12) every time, in every recording
      // since the override was added. Forcing overflow/position on
      // html+body from page load breaks Facebook's own scroll setup
      // (it never sees "near the bottom", so batch two never loads).
      // The lock is now beaten surgically in unlockScroll() instead:
      // only at the moment a wall has actually been hidden, and only
      // on the element actually locked.
      st.textContent =
        '[data-rf-hidden]{display:none !important;}';
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
      // Surgical lock release: only when we have actually hidden a
      // wall (a marked element exists) AND html/body are still locked
      // (computed overflow hidden — e.g. the lock came from a class,
      // which the inline cleanup above cannot remove). Then, and only
      // then, pin overflow auto inline. On a healthy page — including
      // while Facebook's own dialogs like Change location are open —
      // nothing is touched, so Facebook's scroll setup stays exactly
      // as it built it.
      if (document.querySelector('[data-rf-hidden]')) {
        for (var j = 0; j < els.length; j++) {
          var el2 = els[j];
          if (!el2) continue;
          var oy = '';
          try { oy = window.getComputedStyle(el2).overflowY; } catch (e) {}
          if (oy === 'hidden') {
            el2.style.setProperty('overflow-y', 'auto', 'important');
          }
          var pos = '';
          try { pos = window.getComputedStyle(el2).position; } catch (e) {}
          if (pos === 'fixed' && el2 === document.body) {
            el2.style.setProperty('position', 'static', 'important');
          }
        }
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
        // The scroll-depth wall (his first recording, rewatched
        // 2026-11-23 10:43): after ~24 listings a white wash fades in
        // and the page freezes mid-feed, well before any result cap.
        // That wall is a dialog with Log In / Create new account
        // BUTTONS and no password field at all, so the password-only
        // signature missed it cycle after cycle — the dialog never
        // stayed marked, and its backdrop never qualified for the
        // orphan sweep. Accept the button signature too: login wording
        // plus a create-account control, and never a listing holder.
        // (The Change location dialog has neither, so it stays usable.)
        var isWall = !!hasPassword;
        if (!isWall && d.querySelectorAll) {
          var dtext = d.textContent || '';
          var hasCreate = false;
          var ctrls = d.querySelectorAll('a, button, [role="button"]');
          for (var ci = 0; ci < ctrls.length; ci++) {
            var ct = (ctrls[ci].textContent || '').trim();
            if (ct === 'Create new account' || ct === 'Create account') {
              hasCreate = true;
              break;
            }
          }
          isWall = hasCreate &&
            (dtext.indexOf('Log in') >= 0 || dtext.indexOf('Log In') >= 0);
        }
        if (!isWall) continue;
        if (isListingHolder(d)) continue;
        d.setAttribute('data-rf-hidden', '1');
        d.style.setProperty('display', 'none', 'important');
        // Kill the wall's whole modal root, not just the dialog:
        // Facebook appends the modal as a direct child of body, with
        // the backdrop as the dialog's sibling inside that root. The
        // earlier rounds hid the dialog and hunted the backdrop by
        // shape, and the wash still survived — hiding the root takes
        // dialog, backdrop and any wrapper in one shot. The app's own
        // root is safe: it holds the listing links, and a root holding
        // listings is never marked.
        try {
          var root = d;
          while (root.parentElement &&
                 root.parentElement !== document.body &&
                 root.parentElement !== document.documentElement) {
            root = root.parentElement;
          }
          if (root && root !== d && root.parentElement === document.body &&
              !isListingHolder(root)) {
            root.setAttribute('data-rf-hidden', '1');
            root.style.setProperty('display', 'none', 'important');
          }
        } catch (e) {}
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
  // Probe what is ACTUALLY on top (same frozen report): instead of
  // guessing the blocker's shape, ask the browser which element a tap
  // at several screen points would hit. If that element lives inside a
  // full-screen fixed/absolute layer that holds no visible content and
  // no listing links, that layer is the blocker — mark it hidden. A
  // healthy page answers with listing content in normal flow (no such
  // layer above it), and a real overlay like the photo viewer holds
  // visible controls/media, so both are left alone.
  function probeBlockers() {
    try {
      var points = [
        [0.5, 0.35], [0.5, 0.65], [0.25, 0.5], [0.75, 0.5],
      ];
      for (var p = 0; p < points.length; p++) {
        var el = document.elementFromPoint(
          Math.floor(window.innerWidth * points[p][0]),
          Math.floor(window.innerHeight * points[p][1])
        );
        if (!el || el === document.documentElement || el === document.body) continue;
        var anc = el;
        var guard = 0;
        while (anc && anc !== document.body && guard < 16) {
          guard++;
          if (anc.getAttribute && anc.getAttribute('data-rf-hidden')) break;
          var pos = '';
          try { pos = window.getComputedStyle(anc).position; } catch (e) {}
          if (pos === 'fixed' || pos === 'absolute') {
            var r = anc.getBoundingClientRect();
            if (r.width >= window.innerWidth * 0.95 &&
                r.height >= window.innerHeight * 0.95) {
              if (isListingHolder(anc)) break;
              var text = '';
              try { text = (anc.innerText || '').trim(); } catch (e) {}
              var content = anc.querySelectorAll(
                'a, button, input, select, textarea, [role="button"], [role="link"], img, video, iframe'
              );
              var hasVisible = false;
              for (var k = 0; k < content.length; k++) {
                if (isEffectivelyVisible(content[k])) { hasVisible = true; break; }
              }
              if (!hasVisible && text.length === 0) {
                anc.setAttribute('data-rf-hidden', '1');
                anc.style.setProperty('display', 'none', 'important');
              }
              break;
            }
          }
          anc = anc.parentElement;
        }
      }
    } catch (e) {}
  }
  // NOTE (2026-11-23 10:48): a releaseScrollLocks helper that forced
  // overflow-y:auto on large locked containers lived here for one
  // build (b968862) and was REMOVED the same morning. His retest
  // recording showed the wash gone (the modal-root hide worked) but
  // scrolling now died after ~12 listings with the next row rendered
  // yet clipped — the signature of a nested scroll container
  // capturing the gesture: forcing a wrapper into a scroller made it
  // eat the swipe and exhaust its small range, and iOS WebViews do
  // not reliably chain that scroll back to the page. Mutating the
  // layout of containers we do not understand is worse than the lock
  // it was meant to release; the html/body stylesheet unlock stays,
  // and this helper does not come back without evidence the lock
  // actually lands on an inner container.
  // Post-wall freedom pass (his report, 2026-11-23 11:10: the popup
  // flashes and disappears — good — but the page is frozen after).
  // When Facebook opens its dialog it also sedates the page behind
  // it: the app behind a modal commonly gets some mix of an overflow
  // lock on the scroll container, pointer-events switched off,
  // touch-action none, or an inert attribute. Facebook restores all
  // of that when IT closes the dialog — but we hid the dialog out
  // from under it, so the restore never runs and the page stays
  // sedated even though nothing is visibly wrong. The surgical
  // unlock in unlockScroll() only covers html/body; this pass walks
  // the ancestor chain of the listings themselves — the exact
  // elements a swipe has to travel through — and undoes any sedation
  // found there. It runs only when a wall has actually been hidden,
  // and it only ever REMOVES a disabling state (never restructures
  // layout on a healthy page), which is what separates it from the
  // blanket container forcing that backfired earlier.
  function releasePage() {
    try {
      if (!document.querySelector('[data-rf-hidden]')) return;
      var link = document.querySelector('a[href*="/marketplace/item/"]');
      if (!link) return;
      var el = link;
      var guard = 0;
      while (el && el !== document.documentElement && guard < 40) {
        guard++;
        try {
          if (el.hasAttribute && el.hasAttribute('inert')) {
            el.removeAttribute('inert');
          }
          var cs = window.getComputedStyle(el);
          if (cs.pointerEvents === 'none') {
            el.style.setProperty('pointer-events', 'auto', 'important');
          }
          if (cs.touchAction === 'none') {
            el.style.setProperty('touch-action', 'auto', 'important');
          }
          if (cs.overflowY === 'hidden' &&
              el.scrollHeight > el.clientHeight + 24) {
            el.style.setProperty('overflow-y', 'auto', 'important');
          }
          if (cs.position === 'fixed' && el === document.body) {
            el.style.setProperty('position', 'static', 'important');
          }
        } catch (e) {}
        el = el.parentElement;
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
    if (S.dismissLogin || S.blockLoginBar) {
      hideOrphanBackdrops();
      probeBlockers();
    }
    unlockScroll();
    releasePage();
  }
  // Light pass for use mid-scroll: the wall hunt and the scroll
  // unlock only. The full apply() runs getComputedStyle sweeps over
  // thousands of nodes; running those on every scroll tick starves
  // the page's own scroll handling, so scroll events never call it.
  function applyLight() {
    ensureStyle();
    if (S.dismissLogin) {
      if (!tryClose()) hideLoginWalls();
    }
    unlockScroll();
    releasePage();
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
    // A re-applied scroll lock is an attribute change (style/class on
    // html or body), which the childList observer above cannot see —
    // watch those two elements' attributes too, same throttle.
    var attrObs = new MutationObserver(function () {
      if (!pending) {
        pending = true;
        setTimeout(function () { pending = false; apply(); }, 350);
      }
    });
    attrObs.observe(document.documentElement, { attributes: true });
    if (document.body) {
      attrObs.observe(document.body, { attributes: true });
    }
  } catch (e) {}
  // The scroll-depth wall fires WHILE scrolling, and attribute-only
  // changes (a lock class landing on the scroller) do not trip the
  // childList observer — re-check on scroll too, throttled.
  var scrollPending = false;
  try {
    window.addEventListener('scroll', function () {
      if (!scrollPending) {
        scrollPending = true;
        setTimeout(function () { scrollPending = false; applyLight(); }, 600);
      }
    }, true);
  } catch (e) {}
  setInterval(apply, 2500);
  true;
})();
`;
}
