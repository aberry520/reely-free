import type { FilterSettings } from '../lib/settings';

// Builds the JavaScript injected into instagram.com before page content
// loads. Same approach as the Facebook filter: stable hooks (URLs,
// <article> post units, visible label text) instead of class names,
// which Meta shuffles constantly, and a MutationObserver to re-apply
// as the feed lazy-loads. Everything is wrapped defensively: a filter
// bug must never break the page itself.
//
// Scope notes (v1, Austin's pick 2026-11-23 — Instagram added first of
// the candidate apps):
// - "Block Reels" kills the Reels FEED (the /reels/ surface redirects
//   home, its nav entry is hidden, and feed posts that are reels are
//   hidden). A single reel permalink (/reel/<id>/) someone deliberately
//   opens is left alone — same line the Facebook filter draws.
// - Explore: the nav entry is hidden and /explore redirects home.
// - Direct messages, profiles, search and stories are untouched.
export function buildInstagramScript(settings: FilterSettings): string {
  // Feature master off: the door is plain Instagram, no injection.
  if (!settings.featureInstagram) return 'true;';
  const s = JSON.stringify({
    blockReels: settings.igBlockReels,
    hideExplore: settings.igHideExplore,
    hideSuggested: settings.igHideSuggested,
    hideSponsored: settings.igHideSponsored,
    blockAppPromo: settings.igBlockAppPromo,
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
  // Hide the section a label belongs to (e.g. a "Suggested for you"
  // header): climb to the outermost ancestor that still looks like a
  // self-contained section — bounded height, reasonably wide.
  function hideSection(node) {
    var best = node, el = node, depth = 0;
    while (el && depth < 6) {
      el = el.parentElement; depth++;
      if (!el) break;
      var r = el.getBoundingClientRect();
      if (r.height > 0 && r.height <= window.innerHeight * 0.7 &&
          r.width >= window.innerWidth * 0.6) {
        best = el;
      } else if (r.height > window.innerHeight * 0.7) {
        break;
      }
    }
    hide(best);
  }
  // Hide the full-width bar a get-the-app button sits in.
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
      var path = location.pathname;
      if (S.blockReels && (path === '/reels' || path.indexOf('/reels/') === 0)) {
        location.replace('/');
        return;
      }
      if (S.hideExplore && (path === '/explore' || path.indexOf('/explore/') === 0)) {
        location.replace('/');
        return;
      }
      // Nav entries that lead to Reels / Explore: hide the entry.
      var navSel = [];
      if (S.blockReels) navSel.push('a[href="/reels/"], a[href^="/reels/"], [aria-label="Reels"]');
      if (S.hideExplore) navSel.push('a[href="/explore/"], a[href^="/explore/"], [aria-label="Explore"]');
      if (navSel.length) {
        var navEls = document.querySelectorAll(navSel.join(', '));
        for (var i = 0; i < navEls.length; i++) {
          var nav = navEls[i];
          var link = nav.closest ? (nav.closest('a') || nav) : nav;
          if (!link.closest || !link.closest('article')) hide(link);
        }
      }
      // Feed posts.
      var posts = document.querySelectorAll('article');
      for (var j = 0; j < posts.length; j++) {
        var post = posts[j];
        if (post.getAttribute('data-rf-hidden')) continue;
        var text = '';
        try { text = post.innerText || post.textContent || ''; } catch (e) {}
        if (S.blockReels && post.querySelector('a[href^="/reel/"]')) {
          hide(post); continue;
        }
        if (S.hideSuggested && text.indexOf('Suggested for you') >= 0) {
          hide(post); continue;
        }
        if (S.hideSponsored && /(^|\\s)Sponsored(\\s|$)/.test(text.slice(0, 300))) {
          hide(post); continue;
        }
      }
      // "Suggested for you" sections outside posts (account carousels,
      // follow suggestions on profiles): hide the whole section.
      if (S.hideSuggested) {
        var labels = document.querySelectorAll('div, span, h2, h3, h4');
        for (var k = 0; k < labels.length; k++) {
          var lab = labels[k];
          if (lab.getAttribute('data-rf-hidden')) continue;
          if ((lab.textContent || '').trim() !== 'Suggested for you') continue;
          if (lab.querySelector && lab.querySelector('div, span')) continue;
          if (lab.closest && lab.closest('article')) continue;
          hideSection(lab);
        }
      }
      // Get-the-app banners and bars, same labels Meta uses everywhere.
      if (S.blockAppPromo) {
        var ctas = document.querySelectorAll('a, button, [role="button"], div, span');
        for (var c = 0; c < ctas.length; c++) {
          var cel = ctas[c];
          if (cel.getAttribute('data-rf-hidden')) continue;
          var ctext = (cel.textContent || '').trim();
          if (ctext !== 'Open app' && ctext !== 'Open App' &&
              ctext !== 'Get the app' && ctext !== 'Use the app' &&
              ctext !== 'Open Instagram') continue;
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
