import type { FilterSettings } from '../lib/settings';
import { LOGO_FULL_DATA_URI, LOGO_MARK_DATA_URI } from './logo-data';

// Builds the JavaScript injected into facebook.com before page content
// loads. Rules target stable hooks (URLs, role="article", visible label
// text) rather than class names, which Facebook shuffles constantly. A
// MutationObserver re-applies them as the feed lazy-loads. Marketplace is
// deliberately never touched — Austin sells there. Everything is wrapped
// defensively: a filter bug must never break the page itself.
export function buildFacebookScript(settings: FilterSettings): string {
  // Feature master off: the door is plain Facebook, no injection at all.
  if (!settings.featureFacebook) return 'true;';
  const s = JSON.stringify({
    blockReels: settings.fbBlockReels,
    hideSuggested: settings.fbHideSuggested,
    hideSponsored: settings.fbHideSponsored,
    blockAppPromo: settings.fbBlockAppPromo,
    stickyHeader: settings.fbStickyHeader,
  });
  const mark = JSON.stringify(LOGO_MARK_DATA_URI);
  const logo = JSON.stringify(LOGO_FULL_DATA_URI);

  return `
(function () {
  var S = ${s};
  var MARK = ${mark};
  var LOGO = ${logo};
  function hide(el) {
    if (el && !el.getAttribute('data-rf-hidden')) {
      el.setAttribute('data-rf-hidden', '1');
      el.style.setProperty('display', 'none', 'important');
    }
  }
  // Removed-entry branding (Austin, 2026-11-23): a nav/shortcut
  // entry for a removed rabbit hole (Reels) is no longer hidden —
  // its icon is replaced with the Reely Free mark (icon-only
  // version, the header/footer rule), so the slot stays but is
  // visibly Reely Free's. The entry is inert: taps are swallowed.
  // Idempotent via the flag; the reel-card sweep below skips
  // branded entries so they are never hidden as "cards".
  function brandIcon(el) {
    try {
      if (!el || el.getAttribute('data-rf-branded')) return;
      var first = el.querySelector('svg, img, i');
      if (!first) {
        // No classic icon node (the top video tab survived the
        // /watch branding in f3b7463 — his retest, 2026-11-23 —
        // because this layout renders the tab icon as a plain
        // styled box, not an svg/img/i). Fall back to a stand-in:
        // a text-free, icon-sized descendant sitting near the
        // entry's center (the notification badge is also small,
        // but it carries text and sits in a corner, so both checks
        // exclude it).
        var er = el.getBoundingClientRect();
        if (er.width > 0) {
          var ecx = er.left + er.width / 2, ecy = er.top + er.height / 2;
          var all = el.querySelectorAll('*');
          for (var n = 0; n < all.length; n++) {
            var cand = all[n];
            if ((cand.textContent || '').trim() !== '') continue;
            var cr = cand.getBoundingClientRect();
            if (cr.width < 14 || cr.width > 52 ||
                cr.height < 14 || cr.height > 52) continue;
            var ccx = cr.left + cr.width / 2, ccy = cr.top + cr.height / 2;
            if (Math.abs(ccx - ecx) <= er.width * 0.35 &&
                Math.abs(ccy - ecy) <= er.height * 0.35) {
              first = cand;
              break;
            }
          }
        }
      }
      // Icon entries only: a plain text link (e.g. a /watch link
      // typed into a comment) has no icon to replace — leave it.
      if (!first) return;
      el.setAttribute('data-rf-branded', '1');
      var img = document.createElement('img');
      img.src = MARK;
      img.alt = 'Reely Free';
      img.setAttribute('data-rf-mark', '1');
      img.style.cssText =
        'width:24px;height:24px;border-radius:6px;display:block;' +
        'margin:auto;object-fit:cover;flex:none;';
      // Placement: in a tab-sized entry the mark is centered in the
      // entry itself (absolute) — the in-place insert landed it in
      // the icon's corner, overlapping the old icon (his screenshot,
      // 2026-11-23: "close but wonky"). In a wide list-style entry it
      // takes the original icon's spot in its own wrapper instead
      // (v1 appended it to the end of the link, which landed it
      // outside the nav slot entirely).
      var entryRect = el.getBoundingClientRect();
      if (entryRect.width > 0 && entryRect.width <= 120) {
        try {
          if (window.getComputedStyle(el).position === 'static') {
            el.style.setProperty('position', 'relative');
          }
        } catch (e) {}
        img.style.cssText +=
          'position:absolute;left:50%;top:50%;' +
          'transform:translate(-50%,-50%);margin:0;';
        el.appendChild(img);
      } else {
        var host = first && first.parentNode ? first.parentNode : el;
        if (first && first.parentNode) host.insertBefore(img, first);
        else el.appendChild(img);
        try {
          host.style.setProperty('display', 'flex', 'important');
          host.style.setProperty('align-items', 'center', 'important');
          host.style.setProperty('justify-content', 'center', 'important');
        } catch (e) {}
      }
      // Remove the old icon completely — his words: "remove the
      // icon and replace it with ours." The old icon survived the
      // svg/img/i hiding because this layout draws it as a CSS
      // background on a wrapper. So: strip background images from
      // the entry and everything inside it, and hide every
      // descendant that carries no text (icon boxes and their
      // wrappers). Text labels and the count badge carry text, so
      // they stay.
      try { el.style.setProperty('background-image', 'none', 'important'); } catch (e) {}
      var nodes = el.querySelectorAll('*');
      for (var q = 0; q < nodes.length; q++) {
        var nd = nodes[q];
        if (nd === img || (nd.contains && nd.contains(img))) continue;
        // Never touch thin line elements: the tab bar's bottom
        // rule is a per-tab divider element, and the first cut of
        // this sweep hid the branded tab's segment, leaving a gap
        // in the header bar's underline (his screenshot,
        // 2026-11-23). Icons are never this thin in both
        // dimensions; dividers are thin in one.
        var nr2 = nd.getBoundingClientRect();
        if (nr2.height <= 4 || nr2.width <= 4) continue;
        try { nd.style.setProperty('background-image', 'none', 'important'); } catch (e) {}
        if ((nd.textContent || '').trim() === '') {
          nd.style.setProperty('display', 'none', 'important');
        }
      }
      el.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      }, true);
    } catch (e) {}
  }
  // Reels SECTIONS in the feed (Austin's screenshot, 2026-11-23):
  // a unit headed "Reels" with a big reel card under it slipped
  // past the post sweep entirely (it isn't a role=article post and
  // its card has no /reel/ link to catch). First attempt collapsed
  // the unit to a placeholder bar by hiding its children — but the
  // unit-finding climb escaped the section on his phone and the
  // hiding blanked the whole feed (his recording). His call: leave
  // the section exactly as it is and COVER it, the way the
  // Instagram Explore grid is covered. Nothing inside the section
  // is hidden, moved or removed — a branded panel sits on top of
  // it, so Facebook's feed machinery is never fought. The climb is
  // hard-bounded (height and link count checked at every step and
  // on the result) so it can never walk out into the feed column:
  // an oversized "unit" is simply left alone.
  // The section header ROW (icon + "Reels" + menu): climb from
  // the text to the first full-width, row-tall ancestor.
  function findHeaderRow(hd) {
    try {
      var row = hd, i = 0;
      while (row && i < 4) {
        var r = row.getBoundingClientRect();
        if (r.width >= window.innerWidth * 0.85 && r.height <= 72) return row;
        row = row.parentElement; i++;
      }
    } catch (e) {}
    return null;
  }
  // Does root hold a reel CARD? Media inside the header row does
  // NOT count — the header's own icon is itself a /reel/ link on
  // this layout, which is exactly what fooled the first version:
  // the climb "found media" inside the header and stopped there,
  // so the unit it measured was the 40px header and the height
  // guard then rejected it (Austin's screenshot: no cover at all).
  function hasCardMedia(root, headerRow) {
    try {
      var vids = root.querySelectorAll('video');
      for (var i = 0; i < vids.length; i++) {
        if (!headerRow.contains(vids[i])) return true;
      }
      var imgs = root.querySelectorAll('img');
      for (var j = 0; j < imgs.length; j++) {
        if (headerRow.contains(imgs[j])) continue;
        var ir = imgs[j].getBoundingClientRect();
        if (ir.height >= 150 && ir.width >= 200) return true;
      }
      var links = root.querySelectorAll('a[href*="/reel/"]');
      for (var k = 0; k < links.length; k++) {
        if (!headerRow.contains(links[k])) return true;
      }
    } catch (e) {}
    return false;
  }
  function findReelsUnit(headerRow) {
    try {
      var unit = headerRow.parentElement, depth = 0;
      while (unit && depth < 6) {
        var r = unit.getBoundingClientRect();
        if (r.height > 1400) return null;
        if (hasCardMedia(unit, headerRow)) {
          if (r.height < 80) return null;
          if (unit.querySelectorAll &&
              unit.querySelectorAll('a').length > 24) return null;
          return unit;
        }
        unit = unit.parentElement; depth++;
      }
    } catch (e) {}
    return null;
  }
  function buildCover(heightPx) {
    var cover = document.createElement('div');
    cover.setAttribute('data-rf-cover', '1');
    var bg = '';
    try { bg = window.getComputedStyle(document.body).backgroundColor; } catch (e) {}
    if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') bg = '#ffffff';
    cover.style.cssText =
      'position:absolute;left:0;top:0;right:0;z-index:50;' +
      'display:flex;align-items:center;justify-content:center;' +
      (heightPx ? ('height:' + heightPx + 'px;') : 'bottom:0;');
    cover.style.backgroundColor = bg;
    var img = document.createElement('img');
    img.src = LOGO;
    img.alt = 'Reely Free';
    img.style.cssText =
      'width:200px;max-width:70%;display:block;border-radius:18px;';
    cover.appendChild(img);
    return cover;
  }
  function coverReelsUnit(unit) {
    try {
      if (!unit || unit.querySelector('[data-rf-cover]')) return;
      unit.setAttribute('data-rf-covered', '1');
      try {
        if (window.getComputedStyle(unit).position === 'static') {
          unit.style.setProperty('position', 'relative');
        }
      } catch (e) {}
      unit.appendChild(buildCover(0));
    } catch (e) {}
  }
  // Fallback when the section has no wrapper of its own (header
  // and cards are plain siblings in the feed column): hang the
  // cover off the header row itself, sized to span the header
  // plus the card siblings that follow it, stopping at the first
  // sibling that is a normal post.
  function coverFromRow(headerRow) {
    try {
      var top = headerRow.getBoundingClientRect().top;
      var bottom = headerRow.getBoundingClientRect().bottom;
      var n = headerRow.nextElementSibling, count = 0;
      while (n && count < 3) {
        var nt = '';
        try { nt = n.innerText || n.textContent || ''; } catch (e) {}
        if (n.getAttribute && n.getAttribute('role') === 'article' &&
            /Comments/.test(nt)) break;
        var nr = n.getBoundingClientRect();
        if (nr.height > 0) bottom = Math.max(bottom, nr.bottom);
        if (bottom - top > 1400) return;
        n = n.nextElementSibling; count++;
      }
      if (!count) return;
      headerRow.setAttribute('data-rf-covered', '1');
      try {
        if (window.getComputedStyle(headerRow).position === 'static') {
          headerRow.style.setProperty('position', 'relative');
        }
      } catch (e) {}
      headerRow.appendChild(buildCover(Math.round(bottom - top)));
    } catch (e) {}
  }
  // Is this video sitting inside the full-screen viewer layer?
  // The viewer (whether it opens as its own page or as an overlay
  // on the feed) wraps the video in a fixed/absolute layer that
  // covers nearly the whole viewport. A feed video — however big
  // the post is — lives in normal flow and never has such an
  // ancestor. This, not the video's size, is the reliable line
  // between "in the feed" and "clicked into the video".
  function videoInViewerLayer(vid) {
    try {
      var el = vid, depth = 0;
      while (el && depth < 10) {
        var cs = window.getComputedStyle(el);
        if (cs && (cs.position === 'fixed' || cs.position === 'absolute')) {
          var r = el.getBoundingClientRect();
          if (r.width >= window.innerWidth * 0.9 &&
              r.height >= window.innerHeight * 0.85) return true;
        }
        el = el.parentElement; depth++;
      }
    } catch (e) {}
    return false;
  }
  function viewerRoute() {
    try {
      if (/^\\/reel\\//.test(location.pathname)) return true;
      if (location.pathname.indexOf('video.php') >= 0) return true;
      if (location.pathname.indexOf('/watch') === 0 &&
          /[?&]v=/.test(location.search)) return true;
    } catch (e) {}
    return false;
  }
  // Find the viewer's container around a starting element (a
  // touch target, or a video). Two shapes qualify:
  //  - a fixed/absolute layer covering essentially the whole
  //    screen that holds a video (the overlay viewer), or
  //  - a full-screen scroller whose slides are each exactly as
  //    tall as the scroller and hold videos (the paged viewer —
  //    "swiping" there is literally this element scrolling
  //    between slides). Scroll-snap confirms it; without snap,
  //    two direct full-height video slides are required.
  // The feed's scroller matches neither: its posts vary in
  // height and it has no snap. Returns null outside the viewer.
  function findViewerContext(fromEl) {
    try {
      var el = fromEl, depth = 0;
      while (el && depth < 14) {
        var cs = window.getComputedStyle(el);
        if (cs && el.getBoundingClientRect) {
          var r = el.getBoundingClientRect();
          var wideEnough = r.width >= window.innerWidth * 0.9;
          if (wideEnough && r.height >= window.innerHeight * 0.95 &&
              (cs.position === 'fixed' || cs.position === 'absolute') &&
              el.querySelector && el.querySelector('video')) {
            return el;
          }
          if (wideEnough && r.height >= window.innerHeight * 0.85 &&
              (cs.overflowY === 'auto' || cs.overflowY === 'scroll')) {
            var counter = { n: 0 };
            var countIn = function (parent) {
              var kids = parent.children;
              for (var i = 0; i < kids.length; i++) {
                var kr = kids[i].getBoundingClientRect();
                if (kr.height > 0 &&
                    Math.abs(kr.height - r.height) <= r.height * 0.03 &&
                    kids[i].querySelector &&
                    kids[i].querySelector('video')) counter.n++;
              }
            };
            countIn(el);
            var directSlides = counter.n;
            var snap = cs.scrollSnapType && cs.scrollSnapType !== 'none';
            if (snap && directSlides < 1) {
              var kids3 = el.children;
              for (var g = 0; g < kids3.length; g++) countIn(kids3[g]);
            }
            if ((snap && counter.n >= 1) ||
                (!snap && directSlides >= 2)) return el;
          }
        }
        el = el.parentElement; depth++;
      }
    } catch (e) {}
    return null;
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
  // Videos vs the viewer (Austin's call, 2026-11-23): the first
  // cut (5738c8c) blocked feed videos from opening at all, because
  // the full-screen viewer serves an endless swipe-through stream.
  // He asked for the middle ground instead: videos open and play
  // like before, but the swipe is disabled, so the viewer stays on
  // the one video that was tapped. Reels stay fully blocked —
  // a reel has no single-video mode; its viewer IS the stream.
  if (S.blockReels) {
    document.addEventListener('click', function (e) {
      try {
        if (location.pathname.indexOf('/marketplace') === 0) return;
        var t = e.target;
        if (!t || t.nodeType !== 1) return;
        // Branded entries already swallow their own taps.
        if (t.closest && t.closest('[data-rf-branded]')) return;
        var a = t.closest ? t.closest('a') : null;
        if (a) {
          var href = a.getAttribute('href') || '';
          if (href.indexOf('/reel/') >= 0) {
            e.preventDefault();
            e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
          }
        }
      } catch (err) {}
    }, true);
    // Swipe disabling: at touchstart, work out where the gesture
    // lives — a single-video route (all viewer), or the viewer
    // container around the touch point (findViewerContext). In
    // the feed it finds nothing and the gesture is never touched.
    // The earlier build hunted for the <video> from the touch
    // target and gated on it being in a layer; taps land on
    // overlay elements the hunt missed, so the block never fired
    // and the viewer kept swiping (Austin's recording). Vertical
    // moves inside the context are swallowed in capture phase;
    // taps, horizontal drags (the seek bar) and scrollable
    // sub-panels without a video (the comments sheet) are not.
    // Austin's alternative, kept as feedback on top of the
    // block: when a swipe is swallowed, flash the Reely Free
    // icon in the middle of the viewer for a moment, so the
    // block reads as intentional rather than a frozen app.
    // Self-throttling: it won't re-show while one is visible.
    function flashSwipeIcon() {
      try {
        if (document.querySelector('[data-rf-swipe-icon]')) return;
        var d = document.createElement('div');
        d.setAttribute('data-rf-swipe-icon', '1');
        d.style.cssText =
          'position:fixed;left:50%;top:50%;z-index:9999;' +
          'transform:translate(-50%,-50%);pointer-events:none;' +
          'opacity:1;transition:opacity 0.35s;';
        var im = document.createElement('img');
        im.src = MARK;
        im.alt = 'Reely Free';
        im.style.cssText =
          'width:84px;height:84px;border-radius:20px;display:block;' +
          'box-shadow:0 4px 24px rgba(0,0,0,0.35);';
        d.appendChild(im);
        document.body.appendChild(d);
        setTimeout(function () {
          d.style.opacity = '0';
          setTimeout(function () {
            if (d.parentNode) d.parentNode.removeChild(d);
          }, 400);
        }, 550);
      } catch (err) {}
    }
    var swipeStart = null;
    var gestureCtx = null;
    document.addEventListener('touchstart', function (e) {
      try {
        gestureCtx = null;
        if (!e.touches || e.touches.length !== 1) {
          swipeStart = null;
          return;
        }
        swipeStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        if (location.pathname.indexOf('/marketplace') === 0) return;
        gestureCtx = viewerRoute() ? document.body
          : findViewerContext(e.target);
      } catch (err) { swipeStart = null; gestureCtx = null; }
    }, { capture: true, passive: true });
    document.addEventListener('touchmove', function (e) {
      try {
        if (!swipeStart || !gestureCtx) return;
        var t = e.target;
        if (!t || t.nodeType !== 1) return;
        if (gestureCtx !== document.body && !gestureCtx.contains(t)) return;
        // A scrollable sub-panel inside the viewer that holds no
        // video (the comments sheet, a list) keeps its scroll.
        var el = t;
        while (el && el !== gestureCtx) {
          var cs = null;
          try { cs = window.getComputedStyle(el); } catch (err2) {}
          if (cs && (cs.overflowY === 'auto' || cs.overflowY === 'scroll') &&
              el.scrollHeight > el.clientHeight + 40 &&
              !(el.querySelector && el.querySelector('video'))) return;
          el = el.parentElement;
        }
        var dx = e.touches[0].clientX - swipeStart.x;
        var dy = e.touches[0].clientY - swipeStart.y;
        if (Math.abs(dy) < 12 || Math.abs(dy) <= Math.abs(dx)) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        flashSwipeIcon();
      } catch (err) {}
    }, { capture: true, passive: false });
  }
  function apply() {
    try {
      // Reel routes reached any other way (notifications, shared
      // links, back/forward) still go home — a reel only exists
      // as the swipe stream. Watch/video routes now stay: they
      // open the single video, with the swipe disabled above.
      if (S.blockReels && /^\\/reel\\//.test(location.pathname)) {
        location.replace('/');
        return;
      }
      // Nav / shortcut entries that lead to Reels: the entry
      // stays, branded with the Reely Free mark instead of the
      // Reels icon (it used to be hidden; Austin asked for the
      // mark in its place, 2026-11-23). The top tab bar's video
      // entry is a /watch link, not a /reel one — the first cut
      // only matched /reel/, so the tab kept its own icon (his
      // screenshot: the film/play tab, 4th from the left, still
      // unbranded) — so /watch entries outside posts are branded
      // too. Watch links INSIDE a post are left to the post rules
      // and the viewer lockdown.
      if (S.blockReels) {
        var navLinks = document.querySelectorAll(
          'a[href*="/reel/"], a[href*="/watch"]');
        for (var i = 0; i < navLinks.length; i++) {
          var inArticle = navLinks[i].closest
            ? navLinks[i].closest('[role="article"]') : null;
          if (!inArticle) brandIcon(navLinks[i]);
        }
        // The same tab, found by label and position instead of
        // link: if this layout's video tab isn't a /watch anchor
        // at all (a role=tab / button the page navigates itself),
        // the sweep above never sees it. Any tab-sized element in
        // the top tab-bar region whose accessible label says
        // Reels / Watch / Video gets branded the same way.
        var labelled = document.querySelectorAll(
          '[aria-label], [role="tab"], [role="button"]');
        for (var b = 0; b < labelled.length; b++) {
          var cand2 = labelled[b];
          if (cand2.getAttribute('data-rf-branded')) continue;
          var label = (cand2.getAttribute('aria-label') || '') + ' ' +
                      (cand2.getAttribute('title') || '');
          if (!/reel|watch|video/i.test(label)) continue;
          if (/marketplace|notification|messenger|friend|home|group/i.test(label)) continue;
          if (cand2.closest && cand2.closest('[role="article"]')) continue;
          var br = cand2.getBoundingClientRect();
          var docTop = br.top + (window.scrollY || 0);
          if (docTop > 280 || br.width < 28 || br.width > 120 ||
              br.height < 24 || br.height > 90) continue;
          // Brand the clickable entry, not an inner wrapper: climb
          // to the anchor/tab/button that owns this label.
          var entry = cand2;
          var up = 0;
          while (entry && up < 4) {
            if (entry.tagName === 'A' ||
                entry.getAttribute('role') === 'tab' ||
                entry.getAttribute('role') === 'button') break;
            entry = entry.parentElement; up++;
          }
          brandIcon(entry || cand2);
        }
        // Freeze the viewer's slide scroller while it's open:
        // if "swiping" is really that scroller scrolling between
        // full-height slides, overflow:hidden pins it to the
        // current video outright (the gesture block is the
        // backstop for drag-driven viewers). Anything frozen is
        // restored the moment it stops being the viewer.
        try {
          var frozenNow = [];
          var vidsNow = document.querySelectorAll('video');
          for (var fv = 0; fv < vidsNow.length; fv++) {
            var fctx = findViewerContext(vidsNow[fv]);
            if (fctx && fctx !== document.body) {
              if (!fctx.getAttribute('data-rf-frozen')) {
                fctx.setAttribute('data-rf-frozen', '1');
                fctx.style.setProperty('overflow-y', 'hidden', 'important');
              }
              if (frozenNow.indexOf(fctx) < 0) frozenNow.push(fctx);
            }
          }
          var frozenAll = document.querySelectorAll('[data-rf-frozen]');
          for (var fz = 0; fz < frozenAll.length; fz++) {
            if (frozenNow.indexOf(frozenAll[fz]) < 0) {
              frozenAll[fz].removeAttribute('data-rf-frozen');
              frozenAll[fz].style.removeProperty('overflow-y');
            }
          }
        } catch (e) {}
        // Back button, top-left, only while inside the video
        // viewer (Austin's ask): this viewer's own chrome has no
        // back control, and with swiping disabled the way out
        // should be obvious. history.back() mirrors the hub's
        // Back satellite — it closes the overlay viewer or
        // leaves the single-video page, back to the feed.
        try {
          var viewerOpen2 = viewerRoute();
          if (!viewerOpen2) {
            var bv = document.querySelectorAll('video');
            for (var bi = 0; bi < bv.length; bi++) {
              if (videoInViewerLayer(bv[bi]) ||
                  findViewerContext(bv[bi])) {
                viewerOpen2 = true; break;
              }
            }
          }
          var backBtn = document.querySelector('[data-rf-back]');
          if (viewerOpen2 && !backBtn) {
            backBtn = document.createElement('div');
            backBtn.setAttribute('data-rf-back', '1');
            backBtn.setAttribute('role', 'button');
            backBtn.setAttribute('aria-label', 'Back');
            backBtn.style.cssText =
              'position:fixed;left:12px;top:12px;z-index:100000;' +
              'width:40px;height:40px;border-radius:50%;' +
              'background:rgba(0,0,0,0.45);display:flex;' +
              'align-items:center;justify-content:center;' +
              'cursor:pointer;';
            backBtn.innerHTML =
              '<svg width="22" height="22" viewBox="0 0 24 24" fill="none">' +
              '<path d="M15 5 L8 12 L15 19" stroke="#ffffff" ' +
              'stroke-width="2.4" stroke-linecap="round" ' +
              'stroke-linejoin="round"/></svg>';
            backBtn.addEventListener('click', function (ev) {
              try {
                ev.preventDefault();
                ev.stopPropagation();
              } catch (e) {}
              try { history.back(); } catch (e) {}
            }, true);
            document.body.appendChild(backBtn);
          } else if (!viewerOpen2 && backBtn) {
            backBtn.parentNode.removeChild(backBtn);
          }
        } catch (e) {}
        // Reels sections: find the "Reels" header and cover its
        // unit with the branded panel. The section itself is left
        // completely untouched underneath. Wrapped so a failure
        // here can never break the rest of the pass.
        // FEED ONLY: on a video page the same "Reels" header
        // belongs to the up-next rail, and the first cover build
        // happily covered the player with it (Austin's recording:
        // tapping a video showed the logo page instead of the
        // video). Viewer routes skip the sweep entirely, and a
        // header living inside a full-screen fixed layer (the
        // in-page viewer overlay) is never covered either.
        try {
          var onViewer = /^\\/reel\\//.test(location.pathname) ||
            location.pathname.indexOf('video.php') >= 0 ||
            (location.pathname.indexOf('/watch') === 0 &&
             /[?&]v=/.test(location.search));
          // The overlay form of the viewer keeps the feed URL,
          // so the route check can't see it — but a video inside
          // a full-screen layer gives it away. While any viewer
          // is open the sweep stands down completely: the
          // viewer's own "Reels" title bar was covered by this
          // sweep in Austin's recording, hiding the very video
          // he had clicked into.
          var viewerOpen = onViewer;
          if (!viewerOpen) {
            var allVids = document.querySelectorAll('video');
            for (var av = 0; av < allVids.length; av++) {
              if (videoInViewerLayer(allVids[av])) {
                viewerOpen = true; break;
              }
            }
          }
          var heads = viewerOpen ? [] : document.querySelectorAll(
            'div, span, h2, h3, h4, [role="heading"]');
          for (var hh = 0; hh < heads.length; hh++) {
            var hd = heads[hh];
            if (hd.children && hd.children.length > 1) continue;
            var ht = (hd.textContent || '').trim();
            if (ht !== 'Reels' && ht !== 'Reels and short videos') continue;
            if (hd.closest && hd.closest('[data-rf-covered]')) continue;
            var hr2 = hd.getBoundingClientRect();
            if (hr2.height > 48) continue;
            var row2 = findHeaderRow(hd);
            if (!row2) continue;
            if (row2.querySelector('[data-rf-cover]')) continue;
            var anc2 = row2, inFixedLayer = false;
            for (var ai = 0; ai < 8 && anc2; ai++) {
              try {
                if (window.getComputedStyle(anc2).position === 'fixed' &&
                    anc2.getBoundingClientRect().height >=
                      window.innerHeight * 0.7) {
                  inFixedLayer = true; break;
                }
              } catch (e) {}
              anc2 = anc2.parentElement;
            }
            if (inFixedLayer) continue;
            var unit2 = findReelsUnit(row2);
            if (unit2) coverReelsUnit(unit2);
            else coverFromRow(row2);
          }
        } catch (e) {}
      }
      var posts = document.querySelectorAll('[role="article"]');
      for (var j = 0; j < posts.length; j++) {
        var post = posts[j];
        if (post.getAttribute('data-rf-hidden')) continue;
        var text = '';
        try { text = post.innerText || post.textContent || ''; } catch (e) {}
        // A post wrapping a covered Reels section keeps the
        // cover — don't hide the whole post out from under it.
        var hasSection = !!(post.querySelector &&
          post.querySelector('[data-rf-covered]'));
        if (S.blockReels && !hasSection && post.querySelector('a[href*="/reel/"]')) {
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
      // Branded nav entries are not cards — never hide them.
      if (S.blockReels) {
        var reelLinks = document.querySelectorAll('a[href*="/reel/"]');
        for (var k = 0; k < reelLinks.length; k++) {
          if (reelLinks[k].getAttribute('data-rf-hidden')) continue;
          if (reelLinks[k].closest &&
              reelLinks[k].closest('[data-rf-branded]')) continue;
          hideCard(reelLinks[k]);
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
  // (at most ~150px tall) and pin that; if the tab row lives elsewhere,
  // it is found by its link signature — it is the only element that
  // groups Marketplace / Watch / Notifications / Groups destinations
  // together — and pinned directly underneath the first bar. Two cases are handled: a header that scrolls away with the page
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
        var all = document.querySelectorAll('div, header, nav, section, ul');
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
        var boxHeight = box.getBoundingClientRect().height;
        items = [{ el: box, parent: box.parentElement, height: boxHeight, top: 0 }];
        // If the nav tab row is not inside what we pinned, find it by
        // its link signature and pin it directly underneath.
        var tab = null, tabHeight = 0;
        for (var j = 0; j < all.length; j++) {
          var el2 = all[j];
          if (el2 === box || box.contains(el2)) continue;
          var r2 = el2.getBoundingClientRect();
          if (r2.height < 28 || r2.height > 80) continue;
          if (r2.width < window.innerWidth * 0.95) continue;
          var ot2 = offsetTopOf(el2);
          if (ot2 < boxHeight - 24 || ot2 > boxHeight + 64) continue;
          if (el2.querySelector && el2.querySelector('[role="article"]')) continue;
          var kinds = 0, seen = {};
          var links2 = el2.querySelectorAll('a');
          for (var m2 = 0; m2 < links2.length; m2++) {
            var h = links2[m2].getAttribute('href') || '';
            var kind = h.indexOf('marketplace') >= 0 ? 'mp'
              : h.indexOf('/watch') >= 0 ? 'w'
              : h.indexOf('notifications') >= 0 ? 'n'
              : h.indexOf('/groups') >= 0 ? 'g'
              : h.indexOf('friends') >= 0 ? 'f' : '';
            if (kind && !seen[kind]) { seen[kind] = 1; kinds++; }
          }
          if (kinds < 2 && links2.length < 4) continue;
          if (!tab || r2.height < tabHeight) { tab = el2; tabHeight = r2.height; }
        }
        if (tab) {
          items.push({ el: tab, parent: tab.parentElement, height: tabHeight, top: boxHeight });
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
