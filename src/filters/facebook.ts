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
  true;
})();
`;
}
