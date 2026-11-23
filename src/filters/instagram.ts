import type { FilterSettings } from '../lib/settings';

// Builds the JavaScript injected into instagram.com before page content
// loads. Stable hooks only (URLs, visible label text) instead of class
// names, which Meta shuffles constantly. Everything is wrapped
// defensively: a filter bug must never break the page itself.
//
// v3 — show everything, block the rabbit holes (Austin's direction,
// 2026-11-23). v1 hid feed posts (reels / suggested / sponsored) and
// the feed broke: after ~a minute of scrolling it glitched into a
// long black void. v2's re-evaluate-and-unhide fix did NOT cure it —
// his retest showed the same void. Whatever the precise mechanism
// (recycled post nodes and/or the feed's own layout bookkeeping),
// display:none on feed posts fights Instagram's scroller and loses.
// So v3 hides NOTHING in the feed: reels and suggested posts show
// like everything else. Instead, the endless-scroll surfaces are
// closed off:
// - The Reels feed and Explore redirect home; their nav entries are
//   hidden (unchanged from v1 — that part never caused trouble).
// - Tapping a reel anywhere (feed, profile, search) is intercepted
//   and does nothing, so you can't fall into the swipe-through reel
//   viewer. Direct /reel/<id>/ URLs redirect home too.
// - Tapping into a suggested post is intercepted the same way.
// Likes, comments, profiles, DMs, search and stories are untouched,
// and sponsored posts simply show (the sponsored hide toggle is
// gone — hiding them used the same feed-hiding that broke scrolling).
export function buildInstagramScript(settings: FilterSettings): string {
  // Feature master off: the door is plain Instagram, no injection.
  if (!settings.featureInstagram) return 'true;';
  const s = JSON.stringify({
    blockReels: settings.igBlockReels,
    hideExplore: settings.igHideExplore,
    blockSuggested: settings.igHideSuggested,
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
  // The click block: capture-phase, so a blocked tap never reaches
  // Instagram's own handlers. Installed once.
  try {
    document.addEventListener('click', function (ev) {
      try {
        var t = ev.target;
        if (!t || !t.closest) return;
        if (S.blockReels) {
          var reelLink = t.closest(
            'a[href^="/reel/"], a[href^="/reels/"], ' +
            'a[href*="instagram.com/reel/"], a[href*="instagram.com/reels/"]'
          );
          if (reelLink) {
            ev.preventDefault();
            ev.stopPropagation();
            if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
            return;
          }
        }
        if (S.blockSuggested && t.closest('a')) {
          var art = t.closest('article');
          if (art) {
            var txt = '';
            try { txt = art.innerText || art.textContent || ''; } catch (e) {}
            if (txt.indexOf('Suggested for you') >= 0 ||
                txt.indexOf('Suggestions for you') >= 0) {
              ev.preventDefault();
              ev.stopPropagation();
              if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
              return;
            }
          }
        }
      } catch (e) {}
    }, true);
  } catch (e) {}
  function apply() {
    try {
      var path = location.pathname;
      if (S.blockReels &&
          (path === '/reels' || path.indexOf('/reels/') === 0 ||
           path.indexOf('/reel/') === 0)) {
        location.replace('/');
        return;
      }
      if (S.hideExplore && (path === '/explore' || path.indexOf('/explore/') === 0)) {
        location.replace('/');
        return;
      }
      // Nav entries that lead to Reels / Explore: hide the entry.
      // (Nav is static chrome, not feed content — hiding it never
      // caused the scrolling problem.)
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
