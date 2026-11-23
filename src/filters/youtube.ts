import type { FilterSettings } from '../lib/settings';
import { LOGO_MARK_DATA_URI } from './logo-data';

// Builds the JavaScript injected into m.youtube.com before page content
// loads. Rules target stable hooks (URLs, element tags, visible text) rather
// than class names, and a MutationObserver re-applies them as the feed
// lazy-loads. Everything is wrapped defensively: a filter bug must never
// break the page itself.
export function buildYouTubeScript(settings: FilterSettings): string {
  // Feature master off: the door is plain YouTube, no injection at all.
  if (!settings.featureYouTube) return 'true;';
  const s = JSON.stringify({
    blockShorts: settings.ytBlockShorts,
    landOnSubs: settings.ytLandOnSubs,
    hideUpNext: settings.ytHideUpNext,
    blockAppPromo: settings.ytBlockAppPromo,
    swipeDownBack: settings.ytSwipeDownBack,
    brandHeader: settings.ytBrandHeader,
  });
  const mark = JSON.stringify(LOGO_MARK_DATA_URI);

  return `
(function () {
  var S = ${s};
  var MARK = ${mark};
  function hide(el) {
    if (el && !el.getAttribute('data-rf-hidden')) {
      el.setAttribute('data-rf-hidden', '1');
      el.style.setProperty('display', 'none', 'important');
    }
  }
  // Removed-entry branding (Austin, 2026-11-23): the Shorts
  // button in the bottom pivot bar is no longer hidden — its icon
  // is replaced with the Reely Free mark (icon-only version, the
  // header/footer rule) and its label rewritten, so the slot stays
  // but is visibly Reely Free's. The button is inert: taps are
  // swallowed. Idempotent via the flag.
  function brandShorts(item) {
    try {
      if (!item || item.getAttribute('data-rf-branded')) return;
      item.setAttribute('data-rf-branded', '1');
      var first = item.querySelector('svg, img, i, yt-icon');
      var img = document.createElement('img');
      img.src = MARK;
      img.alt = 'Reely Free';
      img.setAttribute('data-rf-mark', '1');
      img.style.cssText =
        'width:24px;height:24px;border-radius:6px;display:block;' +
        'margin:auto;object-fit:cover;flex:none;';
      // In-place: the mark takes the Shorts icon's exact spot in
      // its own wrapper. (v1 appended it inside the button, which
      // stacked it off-line from the other pivot icons in his
      // screenshot.)
      var host = first && first.parentNode ? first.parentNode : item;
      if (first && first.parentNode) host.insertBefore(img, first);
      else item.appendChild(img);
      try {
        host.style.setProperty('display', 'flex', 'important');
        host.style.setProperty('align-items', 'center', 'important');
        host.style.setProperty('justify-content', 'center', 'important');
      } catch (e) {}
      var icons = item.querySelectorAll('svg, img, i, yt-icon');
      for (var q = 0; q < icons.length; q++) {
        if (icons[q] === img) continue;
        icons[q].style.setProperty('display', 'none', 'important');
      }
      // Label: 'Reely Free' in place of 'Shorts', so the slot
      // keeps the same icon-over-label shape as its neighbours
      // (v1 cleared the label, which left the mark floating
      // lower than every other pivot icon).
      var labels = item.querySelectorAll('span, div, p');
      for (var l = 0; l < labels.length; l++) {
        if ((labels[l].textContent || '').trim() === 'Shorts' &&
            !labels[l].querySelector('span, div, p')) {
          labels[l].textContent = 'Reely Free';
        }
      }
      item.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      }, true);
    } catch (e) {}
  }
  // Walk up from a link to the card/renderer that wraps it and hide that.
  function hideCard(node) {
    var el = node, depth = 0;
    while (el && depth < 6) {
      var tag = (el.tagName || '').toLowerCase();
      if (tag.indexOf('renderer') >= 0 || tag.indexOf('shelf') >= 0) { hide(el); return; }
      el = el.parentElement; depth++;
    }
    hide(node);
  }
  // Branded header (Austin's ask, 2026-11-23): the YouTube logo
  // in the top bar is swapped for the Reely Free mark. The link
  // itself is untouched, so tapping it still goes home; the
  // search and avatar controls beside it are untouched. The
  // bottom pivot bar's Home item is also an a[href="/"], but it
  // sits near the bottom of the screen, so the top-90px gate
  // excludes it.
  function brandHeaderLogo() {
    try {
      if (!S.brandHeader) return;
      var links = document.querySelectorAll('a[href="/"]');
      for (var i = 0; i < links.length; i++) {
        var link = links[i];
        if (link.getAttribute('data-rf-logo')) continue;
        var r = link.getBoundingClientRect();
        if (r.top < 0 || r.top > 90) continue;
        if (r.width < 20 || r.width > 220) continue;
        if (r.height < 20 || r.height > 60) continue;
        if (!link.querySelector('svg, img, yt-icon')) continue;
        while (link.firstChild) link.removeChild(link.firstChild);
        var img = document.createElement('img');
        img.src = MARK;
        img.alt = 'Reely Free';
        img.style.cssText =
          'height:24px;width:24px;border-radius:6px;display:block;';
        link.appendChild(img);
        link.setAttribute('data-rf-logo', '1');
        return;
      }
    } catch (e) {}
  }
  function apply() {
    try {
      var path = location.pathname;
      if (S.blockShorts) {
        var m = path.match(/^\\/shorts\\/([\\w-]{6,})/);
        if (m) { location.replace('/watch?v=' + m[1]); return; }
      }
      brandHeaderLogo();
      if (S.landOnSubs && path === '/') {
        location.replace('/feed/subscriptions');
        return;
      }
      if (S.blockShorts) {
        // Shorts shelves and items (mobile web custom elements).
        var shelves = document.querySelectorAll(
          'ytm-reel-shelf-renderer, ytm-reel-item-renderer, ' +
          'yt-shorts-lockup-view-model, ytm-shorts-lockup-view-model');
        for (var i = 0; i < shelves.length; i++) hide(shelves[i]);
        // Any card whose main link is a Short. The pivot bar's
        // Shorts button is not a card — it gets branded below,
        // never hidden.
        var links = document.querySelectorAll('a[href^="/shorts/"]');
        for (var j = 0; j < links.length; j++) {
          if (links[j].closest &&
              links[j].closest('ytm-pivot-bar-item-renderer')) continue;
          hideCard(links[j]);
        }
        // The Shorts button in the bottom pivot bar (matched by
        // its label): branded with the Reely Free mark instead of
        // hidden. Note branding rewrites the label to 'Reely
        // Free', so the text match only fires on the first pass —
        // the branded flag keeps later passes from touching it
        // again.
        var items = document.querySelectorAll('ytm-pivot-bar-item-renderer');
        for (var k = 0; k < items.length; k++) {
          if ((items[k].textContent || '').trim() === 'Shorts') brandShorts(items[k]);
        }
      }
      if (S.hideUpNext && path === '/watch') {
        var sections = document.querySelectorAll(
          'ytm-item-section-renderer, ytm-watch-next-results-renderer');
        for (var n = 0; n < sections.length; n++) {
          var head = (sections[n].textContent || '').trim().slice(0, 40);
          if (head.indexOf('Up next') === 0) hide(sections[n]);
        }
      }
      if (S.blockAppPromo) {
        // The 'Open App' pill in the header, and the 'Watch in YouTube app'
        // call-to-action inside the promo popup (hide its whole card).
        var btns = document.querySelectorAll('a, button, [role="button"]');
        for (var b = 0; b < btns.length; b++) {
          var t = (btns[b].textContent || '').trim();
          if (t === 'Open App' || t === 'Open app') {
            var wrap = btns[b].parentElement;
            hide(wrap && wrap.children.length === 1 ? wrap : btns[b]);
          } else if (t === 'Watch in YouTube app') {
            hideCard(btns[b]);
          }
        }
        // The 'Get the best experience' promo dialog itself; also release
        // the scroll lock YouTube puts on the page while it is up.
        var dialogs = document.querySelectorAll(
          '[role="dialog"], [role="alertdialog"], ' +
          'ytm-app-promo-dialog-renderer, ytm-dialog-renderer');
        for (var d = 0; d < dialogs.length; d++) {
          var dt = dialogs[d].textContent || '';
          if (dt.indexOf('Get the best experience') >= 0 ||
              dt.indexOf('Watch in YouTube app') >= 0) {
            hide(dialogs[d]);
            try {
              document.body.style.overflow = '';
              document.documentElement.style.overflow = '';
            } catch (e) {}
          }
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
  // Swipe down on the video to go back, like the app's mini-player gesture
  // (here the video stops — the web player can't float). The touch must
  // start on the player itself, so scrolling the comments never triggers
  // it. Two hard-won details: the listeners sit on window in the CAPTURE
  // phase because YouTube's own player handlers stop touch events from
  // bubbling up to document, and the drag is claimed (preventDefault) from
  // the first few pixels — wait any longer and the WebView's native
  // scrolling takes the gesture over and it can never be claimed back.
  if (S.swipeDownBack) {
    var gStartX = 0, gStartY = 0, gArmed = false, gFired = false;
    window.addEventListener('touchstart', function (e) {
      gArmed = false; gFired = false;
      try {
        if (location.pathname !== '/watch') return;
        var t = e.changedTouches && e.changedTouches[0];
        if (!t) return;
        var v = document.querySelector('video');
        if (!v) return;
        if (document.fullscreenElement || v.webkitDisplayingFullscreen) return;
        var r = v.getBoundingClientRect();
        if (r.height === 0) return;
        if (t.clientX >= r.left && t.clientX <= r.right &&
            t.clientY >= r.top && t.clientY <= r.bottom) {
          gArmed = true; gStartX = t.clientX; gStartY = t.clientY;
        }
      } catch (err) {}
    }, { passive: true, capture: true });
    window.addEventListener('touchmove', function (e) {
      if (!gArmed || gFired) return;
      try {
        var t = e.changedTouches && e.changedTouches[0];
        if (!t) return;
        var dx = t.clientX - gStartX, dy = t.clientY - gStartY;
        if (dy > 4 && e.cancelable) e.preventDefault();
        if (dy >= 80 && Math.abs(dy) > Math.abs(dx) * 1.5) {
          gFired = true; gArmed = false;
          window.history.back();
        }
      } catch (err) {}
    }, { passive: false, capture: true });
  }
  true;
})();
`;
}
