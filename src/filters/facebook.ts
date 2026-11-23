import type { FilterSettings } from '../lib/settings';

// Builds the JavaScript injected into facebook.com before page content
// loads. Rules target stable hooks (URLs, role="article", visible label
// text) rather than class names, which Facebook shuffles constantly. A
// MutationObserver re-applies them as the feed lazy-loads. Marketplace is
// deliberately never touched — Austin sells there. Everything is wrapped
// defensively: a filter bug must never break the page itself.
export function buildFacebookScript(settings: FilterSettings): string {
  const s = JSON.stringify({
    blockReels: settings.fbBlockReels,
    hideSuggested: settings.fbHideSuggested,
    hideSponsored: settings.fbHideSponsored,
    blockAppPromo: settings.fbBlockAppPromo,
    stickyHeader: settings.fbStickyHeader,
  });

  return `
(function () {
  var S = ${s};
  function hide(el) {
    if (el && !el.getAttribute('data-rf-hidden')) {
      el.setAttribute('data-rf-hidden', '1');
      el.style.setProperty('display', 'none', 'important');
    }
  }
  // Walk up from a link to a plausible card container and hide that.
  function hideCard(node) {
    var el = node, depth = 0, best = node;
    while (el && depth < 6) {
      el = el.parentElement; depth++;
      if (!el) break;
      var links = el.querySelectorAll ? el.querySelectorAll('a').length : 99;
      if (links <= 4) best = el; else break;
    }
    hide(best);
  }
  // Hide the full-width bar a get-the-app button sits in (the 'Open app'
  // bar fixed to the bottom of the feed): climb while ancestors stay
  // short and nearly full-width.
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
      if (S.blockReels && /^\\/reel\\//.test(location.pathname)) {
        location.replace('/');
        return;
      }
      // Nav / shortcut entries that lead to Reels: hide the link itself.
      if (S.blockReels) {
        var navLinks = document.querySelectorAll('a[href*="/reel/"]');
        for (var i = 0; i < navLinks.length; i++) {
          var inArticle = navLinks[i].closest
            ? navLinks[i].closest('[role="article"]') : null;
          if (!inArticle) hide(navLinks[i]);
        }
      }
      var posts = document.querySelectorAll('[role="article"]');
      for (var j = 0; j < posts.length; j++) {
        var post = posts[j];
        if (post.getAttribute('data-rf-hidden')) continue;
        var text = '';
        try { text = post.innerText || post.textContent || ''; } catch (e) {}
        if (S.blockReels && post.querySelector('a[href*="/reel/"]')) {
          hide(post); continue;
        }
        if (S.hideSuggested && text.indexOf('Suggested for you') >= 0) {
          hide(post); continue;
        }
        // The Sponsored label sits in the post header; only scan the head
        // of the text so a post merely mentioning the word stays visible.
        if (S.hideSponsored && /(^|\\s)Sponsored(\\s|$)/.test(text.slice(0, 300))) {
          hide(post); continue;
        }
      }
      // Reel cards outside articles (e.g. in Watch): hide by their link.
      if (S.blockReels) {
        var reelLinks = document.querySelectorAll('a[href*="/reel/"]');
        for (var k = 0; k < reelLinks.length; k++) {
          if (!reelLinks[k].getAttribute('data-rf-hidden')) hideCard(reelLinks[k]);
        }
      }
      // The 'Open app' bar and other get-the-app banners: find the
      // innermost element carrying one of the known labels and hide the
      // bar it sits in.
      if (S.blockAppPromo) {
        var ctas = document.querySelectorAll('a, button, [role="button"], div, span');
        for (var c = 0; c < ctas.length; c++) {
          var cel = ctas[c];
          if (cel.getAttribute('data-rf-hidden')) continue;
          var ctext = (cel.textContent || '').trim();
          if (ctext !== 'Open app' && ctext !== 'Open App' &&
              ctext !== 'Get the app' && ctext !== 'Use the app') continue;
          // Innermost match only, and plausibly a button (short, not a
          // whole post that happens to contain the words).
          if (cel.querySelector && cel.querySelector('a, button, [role="button"], div, span')) continue;
          if (cel.clientHeight > 90) continue;
          hideBar(cel);
        }
      }
    } catch (e) {}
  }
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
  // Header that comes back on scroll up, like the app. Facebook serves
  // different markup to different clients, so the header is found at
  // runtime rather than by a hard-coded selector: the first element that
  // starts at the very top of the document, is bar-shaped (full width,
  // 36-96px tall), and holds several controls including a home link or a
  // search box. If the site's own styling already keeps it fixed or
  // sticky, this leaves it completely alone. While pinned, the parent
  // gets matching top padding so the feed doesn't jump.
  if (S.stickyHeader) {
    var hdr = null, hdrParent = null, hdrHeight = 0, hdrPinned = false, lastY = 0;
    function findHeader() {
      if (hdr && document.contains(hdr)) return hdr;
      try {
        var cands = document.querySelectorAll('body > *, body > * > *, body > * > * > *');
        for (var i = 0; i < cands.length; i++) {
          var el = cands[i];
          var r = el.getBoundingClientRect();
          if (r.top + (window.scrollY || 0) > 4) continue;
          if (r.height < 36 || r.height > 96) continue;
          if (r.width < window.innerWidth * 0.95) continue;
          var pos = '';
          try { pos = window.getComputedStyle(el).position; } catch (e) {}
          if (pos === 'fixed' || pos === 'sticky') return null;
          var controls = el.querySelectorAll('a, button, [role="button"], input');
          if (controls.length < 3) continue;
          var hasHome = !!el.querySelector('a[href="/"], a[href^="/?"], a[href*="facebook.com/?"]');
          var hasSearch = !!el.querySelector('input, [aria-label*="Search"]');
          if (!hasHome && !hasSearch) continue;
          hdr = el; hdrParent = el.parentElement; hdrHeight = r.height;
          return hdr;
        }
      } catch (e) {}
      return null;
    }
    function setPinned(on) {
      if (!hdr || hdrPinned === on) return;
      hdrPinned = on;
      try {
        if (on) {
          hdr.style.setProperty('position', 'fixed', 'important');
          hdr.style.setProperty('top', '0', 'important');
          hdr.style.setProperty('left', '0', 'important');
          hdr.style.setProperty('right', '0', 'important');
          hdr.style.setProperty('z-index', '999', 'important');
          if (hdrParent) hdrParent.style.setProperty('padding-top', hdrHeight + 'px', 'important');
        } else {
          hdr.style.removeProperty('position');
          hdr.style.removeProperty('top');
          hdr.style.removeProperty('left');
          hdr.style.removeProperty('right');
          hdr.style.removeProperty('z-index');
          if (hdrParent) hdrParent.style.removeProperty('padding-top');
        }
      } catch (e) {}
    }
    document.addEventListener('scroll', function (e) {
      try {
        var target = e.target;
        var y = (target && target !== document && typeof target.scrollTop === 'number')
          ? target.scrollTop : (window.scrollY || 0);
        if (!findHeader()) { lastY = y; return; }
        if (y <= hdrHeight) setPinned(false);
        else if (y < lastY - 4) setPinned(true);
        else if (y > lastY + 4) setPinned(false);
        lastY = y;
      } catch (err) {}
    }, { passive: true, capture: true });
  }
  true;
})();
`;
}
