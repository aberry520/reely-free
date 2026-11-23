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
  // different markup to different clients and nests it deeply, so the
  // header is found at runtime by scanning the page: an element that
  // starts at the very top of the document (offsetTop, so scroll position
  // doesn't matter), is bar-shaped (full width, 36-96px tall), contains
  // no posts, and holds several controls including a home link or a
  // search box. The app header is TWO rows (wordmark bar + nav tab bar),
  // so from the first bar we climb to the container holding both rows
  // (at most ~150px tall) and pin that; if the rows share no container,
  // the second row is found directly below the first and pinned under
  // it. Two cases are handled: a header that scrolls away with the page
  // (we pin it ourselves, with padding on the parent so the feed doesn't
  // jump), and a header Facebook already keeps fixed but hides on scroll
  // down (we force it back into view on scroll up and hand it back on
  // scroll down).
  if (S.stickyHeader) {
    var items = null, hdrMode = '', hdrShown = false, totalHeight = 0;
    var lastY = 0, lastSearch = 0;
    function offsetTopOf(el) {
      var t = 0, n = el;
      while (n) { t += n.offsetTop || 0; n = n.offsetParent; }
      return t;
    }
    function looksLikeBar(el, minH, maxH) {
      var r = el.getBoundingClientRect();
      if (r.height < minH || r.height > maxH) return null;
      if (r.width < window.innerWidth * 0.95) return null;
      if (offsetTopOf(el) > 8) return null;
      if (el.querySelector && el.querySelector('[role="article"]')) return null;
      return r;
    }
    function findHeader() {
      if (items) return items;
      try {
        var all = document.querySelectorAll('div, header, nav, section');
        var bar = null, barRect = null;
        for (var i = 0; i < all.length; i++) {
          var el = all[i];
          var r = looksLikeBar(el, 36, 96);
          if (!r) continue;
          var controls = el.querySelectorAll('a, button, [role="button"], input');
          if (controls.length < 3) continue;
          var hasHome = !!el.querySelector('a[href="/"], a[href^="/?"], a[href*="facebook.com"]');
          var hasSearch = !!el.querySelector('input, [aria-label*="Search"]');
          if (!hasHome && !hasSearch) continue;
          bar = el; barRect = r;
          break;
        }
        if (!bar) return null;
        // Climb to a container that also holds the nav tab row.
        var box = bar;
        while (box.parentElement) {
          var p = box.parentElement;
          var pr = p.getBoundingClientRect();
          if (pr.height > 150 || pr.width < window.innerWidth * 0.95) break;
          if (offsetTopOf(p) > 8) break;
          if (p.querySelector && p.querySelector('[role="article"]')) break;
          box = p;
        }
        var pos = '';
        try { pos = window.getComputedStyle(box).position; } catch (e) {}
        hdrMode = (pos === 'fixed' || pos === 'sticky') ? 'site' : 'flow';
        items = [{ el: box, parent: box.parentElement, height: box.getBoundingClientRect().height, top: 0 }];
        // No climb happened and the container is just the one row: look
        // for the nav tab row sitting directly beneath it and pin it too.
        if (box === bar) {
          for (var j = 0; j < all.length; j++) {
            var el2 = all[j];
            if (el2 === bar || bar.contains(el2)) continue;
            var r2 = el2.getBoundingClientRect();
            if (r2.height < 30 || r2.height > 96) continue;
            if (r2.width < window.innerWidth * 0.95) continue;
            var ot = offsetTopOf(el2);
            if (ot < barRect.height - 10 || ot > barRect.height + 14) continue;
            if (el2.querySelector && el2.querySelector('[role="article"]')) continue;
            if (el2.querySelectorAll('a, button, [role="button"]').length < 3) continue;
            items.push({ el: el2, parent: el2.parentElement, height: r2.height, top: barRect.height });
            break;
          }
        }
        totalHeight = 0;
        for (var k = 0; k < items.length; k++) totalHeight += items[k].height;
        return items;
      } catch (e) {}
      return null;
    }
    function setShown(on) {
      if (!items || hdrShown === on) return;
      hdrShown = on;
      try {
        var pads = [];
        for (var i = 0; i < items.length; i++) {
          var it = items[i], el = it.el;
          if (hdrMode === 'site') {
            if (on) {
              el.style.setProperty('transform', 'none', 'important');
              el.style.setProperty('top', it.top + 'px', 'important');
              el.style.setProperty('opacity', '1', 'important');
              el.style.setProperty('visibility', 'visible', 'important');
            } else {
              el.style.removeProperty('transform');
              el.style.removeProperty('top');
              el.style.removeProperty('opacity');
              el.style.removeProperty('visibility');
            }
          } else if (on) {
            el.style.setProperty('position', 'fixed', 'important');
            el.style.setProperty('top', it.top + 'px', 'important');
            el.style.setProperty('left', '0', 'important');
            el.style.setProperty('right', '0', 'important');
            el.style.setProperty('z-index', '999', 'important');
            if (it.parent) {
              var found = null;
              for (var m = 0; m < pads.length; m++) if (pads[m][0] === it.parent) found = pads[m];
              if (found) found[1] += it.height; else pads.push([it.parent, it.height]);
            }
          } else {
            el.style.removeProperty('position');
            el.style.removeProperty('top');
            el.style.removeProperty('left');
            el.style.removeProperty('right');
            el.style.removeProperty('z-index');
            if (it.parent) it.parent.style.removeProperty('padding-top');
          }
        }
        if (hdrMode !== 'site' && on) {
          for (var n = 0; n < pads.length; n++) {
            pads[n][0].style.setProperty('padding-top', pads[n][1] + 'px', 'important');
          }
        }
      } catch (e) {}
    }
    document.addEventListener('scroll', function (e) {
      try {
        var target = e.target;
        var y = (target && target !== document && typeof target.scrollTop === 'number')
          ? target.scrollTop : (window.scrollY || 0);
        if (!items) {
          var now = Date.now();
          if (now - lastSearch < 800) { lastY = y; return; }
          lastSearch = now;
          if (!findHeader()) { lastY = y; return; }
        }
        if (y <= totalHeight) setShown(true);
        else if (y < lastY - 4) setShown(true);
        else if (y > lastY + 4) setShown(false);
        lastY = y;
      } catch (err) {}
    }, { passive: true, capture: true });
  }
  true;
})();
`;
}
