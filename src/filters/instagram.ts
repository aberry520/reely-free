import type { FilterSettings } from '../lib/settings';
import { LOGO_FULL_DATA_URI, LOGO_MARK_DATA_URI } from './logo-data';

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
// - The Reels feed redirects home and its nav entry carries the
//   Reely Free mark instead of the Reels icon (branded, inert)
//   (unchanged from v1 — that part never caused trouble). Explore is
//   different (his follow-up, 2026-11-23): Search lives ON the Explore
//   page, so the page and its nav entry stay — instead a Reely
//   Free logo cover sits over the browse grid under the search
//   bar (the grid itself is left untouched underneath), leaving a
//   working search page with no content to fall into. Search results
//   themselves are deliberate, so they show normally.
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
  const logo = JSON.stringify(LOGO_FULL_DATA_URI);
  const mark = JSON.stringify(LOGO_MARK_DATA_URI);

  return `
(function () {
  var S = ${s};
  var LOGO = ${logo};
  var MARK = ${mark};
  function hide(el) {
    if (el && !el.getAttribute('data-rf-hidden')) {
      el.setAttribute('data-rf-hidden', '1');
      el.style.setProperty('display', 'none', 'important');
    }
  }
  // Removed-entry branding (Austin, 2026-11-23): a nav entry for a
  // removed rabbit hole (Reels) is no longer hidden — its icon is
  // replaced with the Reely Free mark (icon-only version, the
  // header/footer rule), so the slot stays but is visibly Reely
  // Free's. The entry is inert: taps are swallowed here as well as
  // by the global reel-tap block below. Idempotent via the flag.
  function brandIcon(el) {
    try {
      if (!el || el.getAttribute('data-rf-branded')) return;
      el.setAttribute('data-rf-branded', '1');
      var icons = el.querySelectorAll('svg, img, i');
      for (var q = 0; q < icons.length; q++) {
        icons[q].style.setProperty('display', 'none', 'important');
      }
      var img = document.createElement('img');
      img.src = MARK;
      img.alt = 'Reely Free';
      img.setAttribute('data-rf-mark', '1');
      img.style.cssText =
        'width:26px;height:26px;border-radius:7px;display:block;' +
        'margin:auto;object-fit:cover;';
      el.appendChild(img);
      el.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      }, true);
    } catch (e) {}
  }
  // Explore cover (Austin's idea, 2026-11-23, after the grid-hide
  // didn't take on his phone): don't hide or remove ANYTHING — lay a
  // fixed cover over the grid area instead. The grid stays in the
  // page exactly as Instagram built it (nothing for its scroller to
  // trip over), it's just not visible and can't be tapped. The cover
  // starts below the search bar and stops above the bottom nav, so
  // both stay usable, and it steps aside while the search box has
  // focus so search suggestions are never trapped under it.
  function searchInput() {
    try {
      return document.querySelector(
        'input[placeholder*="Search" i], input[type="search"], input[name="query"]'
      );
    } catch (e) { return null; }
  }
  function ensureCover() {
    try {
      var cover = document.getElementById('rf-explore-cover');
      if (!cover) {
        cover = document.createElement('div');
        cover.id = 'rf-explore-cover';
        // The placeholder where content was removed carries the
        // logo (Austin, 2026-11-23): the full mark + wordmark as an
        // image — WebView pages can't reach local app assets, so it
        // rides in as a data URI (see logo-data.ts).
        var logoImg = document.createElement('img');
        logoImg.src = LOGO;
        logoImg.alt = 'Reely Free';
        logoImg.style.cssText =
          'width:min(210px,58vw);height:auto;border-radius:26px;' +
          'display:block;';
        var sub = document.createElement('div');
        sub.textContent = 'Explore is off — search above still works.';
        sub.style.cssText = 'font-size:15px;opacity:0.65;margin-top:14px;';
        cover.appendChild(logoImg);
        cover.appendChild(sub);
        cover.style.cssText =
          'position:fixed;left:0;right:0;z-index:999;' +
          'display:flex;flex-direction:column;align-items:center;' +
          'justify-content:center;text-align:center;padding:24px;';
        (document.body || document.documentElement).appendChild(cover);
      }
      positionCover(cover);
      return cover;
    } catch (e) { return null; }
  }
  function positionCover(cover) {
    try {
      if (!cover) cover = document.getElementById('rf-explore-cover');
      if (!cover) return;
      // Match the page's own colors so it reads as a blank page, in
      // whichever theme the phone is using.
      var bg = '';
      try { bg = window.getComputedStyle(document.body).backgroundColor; } catch (e) {}
      if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') bg = '#000';
      cover.style.backgroundColor = bg;
      var dark = true;
      try {
        var parts = bg.match(/[\\d.]+/g);
        if (parts && parts.length >= 3) {
          var lum = (parseFloat(parts[0]) * 299 + parseFloat(parts[1]) * 587 +
                     parseFloat(parts[2]) * 114) / 1000;
          dark = lum < 140;
        }
      } catch (e) {}
      cover.style.color = dark ? '#fff' : '#111';
      // Top: just under the search bar (or the top of the screen if
      // the bar has scrolled away / can't be found).
      var top = 0;
      var input = searchInput();
      if (input) {
        var r = input.getBoundingClientRect();
        if (r.bottom > 0) top = Math.floor(r.bottom) + 6;
      }
      // Bottom: just above the bottom nav bar — it must stay
      // tappable so he can leave Explore. (First cut measured <nav>
      // elements directly and missed Instagram's footer entirely,
      // so the cover ran to the bottom of the screen and blocked
      // Home/Profile — his screenshot, 2026-11-23.) Now: climb from
      // the footer's own links to the bar pinned at the bottom, and
      // if nothing is found, still leave a 60px strip — the cover
      // must never reach the bottom edge.
      var bottom = 0;
      try {
        var anchors = document.querySelectorAll(
          'a[href="/"], a[href="/explore/"], a[href^="/direct/"]'
        );
        for (var a = 0; a < anchors.length && !bottom; a++) {
          var node = anchors[a];
          var d = 0;
          while (node && d < 9) {
            node = node.parentElement; d++;
            if (!node) break;
            var nr = node.getBoundingClientRect();
            if (nr.height >= 36 && nr.height <= 110 &&
                nr.width >= window.innerWidth * 0.7 &&
                Math.abs(nr.bottom - window.innerHeight) <= 8) {
              bottom = window.innerHeight - Math.floor(nr.top);
              break;
            }
          }
        }
      } catch (e) {}
      if (!bottom) bottom = 60;
      cover.style.top = top + 'px';
      cover.style.bottom = bottom + 'px';
      // While he's actually searching, step aside entirely.
      var searching = !!(input && document.activeElement === input);
      cover.style.display = searching ? 'none' : 'flex';
    } catch (e) {}
  }
  function removeCover() {
    try {
      var cover = document.getElementById('rf-explore-cover');
      if (cover && cover.parentElement) cover.parentElement.removeChild(cover);
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
      // Explore: the page stays (Search lives there) — a cover sits
      // over the browse grid, on the plain Explore page only, never
      // on search results. Anywhere else the cover is removed.
      var onExplore = path === '/explore' || path === '/explore/';
      if (S.hideExplore && onExplore) {
        ensureCover();
      } else {
        removeCover();
      }
      // Nav entries that lead to Reels: the entry stays, branded
      // with the Reely Free mark instead of the Reels icon (it used
      // to be hidden; Austin asked for the mark in its place,
      // 2026-11-23). Nav is static chrome, not feed content, so
      // this never caused the scrolling problem. The Explore entry
      // stays untouched: it's the way into Search.
      var navSel = [];
      if (S.blockReels) navSel.push('a[href="/reels/"], a[href^="/reels/"], [aria-label="Reels"]');
      if (navSel.length) {
        var navEls = document.querySelectorAll(navSel.join(', '));
        for (var i = 0; i < navEls.length; i++) {
          var nav = navEls[i];
          var link = nav.closest ? (nav.closest('a') || nav) : nav;
          if (!link.closest || !link.closest('article')) brandIcon(link);
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
  // Keep the cover glued under the search bar while scrolling.
  var coverPending = false;
  try {
    window.addEventListener('scroll', function () {
      if (!coverPending) {
        coverPending = true;
        setTimeout(function () {
          coverPending = false;
          positionCover(null);
        }, 250);
      }
    }, true);
  } catch (e) {}
  setInterval(apply, 2500);
  true;
})();
`;
}
