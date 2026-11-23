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
// - The Reels feed redirects home and its nav entry is hidden
//   (unchanged from v1 — that part never caused trouble). Explore is
//   different (his follow-up, 2026-11-23): Search lives ON the Explore
//   page, so the page and its nav entry stay — instead the browse
//   grid under the search bar is hidden, leaving a working search
//   page with no content to fall into. Search results themselves are
//   deliberate, so they show normally.
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
  // Explore grid hiding: on the plain Explore page, find the browse
  // grid (the container holding many post/reel links) and hide it —
  // but never a container that also holds the search box, which sits
  // at the top and must stay usable. Marked with data-rf-explore as
  // well as the usual marker, so leaving the page can undo exactly
  // these hides if Instagram reuses the container elsewhere (e.g.
  // for search results).
  function hideExploreGrid() {
    try {
      var links = document.querySelectorAll(
        'a[href^="/p/"], a[href^="/reel/"], a[href^="/reels/"]'
      );
      if (links.length < 4) return;
      var el = links[0];
      var best = null;
      var depth = 0;
      while (el && depth < 10) {
        el = el.parentElement; depth++;
        if (!el) break;
        if (el.querySelector && el.querySelector('input')) break;
        var count = el.querySelectorAll
          ? el.querySelectorAll('a[href^="/p/"], a[href^="/reel/"], a[href^="/reels/"]').length
          : 0;
        if (count >= 4) best = el;
      }
      if (best && !best.getAttribute('data-rf-hidden')) {
        best.setAttribute('data-rf-explore', '1');
        hide(best);
      }
    } catch (e) {}
  }
  function unhideExploreGrid() {
    try {
      var marked = document.querySelectorAll('[data-rf-explore]');
      for (var i = 0; i < marked.length; i++) {
        marked[i].removeAttribute('data-rf-explore');
        marked[i].removeAttribute('data-rf-hidden');
        marked[i].style.removeProperty('display');
      }
    } catch (e) {}
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
      // Explore: the page stays (Search lives there) — only its
      // browse grid is hidden, and only on the plain Explore page,
      // never on search results. Anywhere else, undo an explore hide
      // in case the container got reused.
      var onExplore = path === '/explore' || path === '/explore/';
      if (S.hideExplore && onExplore) {
        hideExploreGrid();
      } else {
        unhideExploreGrid();
      }
      // Nav entries that lead to Reels: hide the entry. (Nav is
      // static chrome, not feed content — hiding it never caused
      // the scrolling problem. The Explore entry stays: it's the
      // way into Search.)
      var navSel = [];
      if (S.blockReels) navSel.push('a[href="/reels/"], a[href^="/reels/"], [aria-label="Reels"]');
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
