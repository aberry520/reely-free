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
  // Branded header (Austin's ask, 2026-11-23; centered, refined
  // the same day): the logo-slot swap never landed — the original
  // logo still showed — and he wants the header top-middle, not
  // left. So the header is now an independent element pinned to
  // the top center of the viewport: "Reely [mark] Free", sitting
  // in the empty middle of the top bar between the logo and the
  // search icon. It never finds or touches the site's own header,
  // so it can't miss and can't break it. It is
  // pointer-events:none, so it can never eat a tap, and it only
  // shows on Home and Subscriptions, where the top bar is the
  // standard one; on watch/search pages it hides so it never
  // covers a title.
  function brandHeaderCenter() {
    try {
      var el = document.getElementById('rf-brand-center');
      var p = location.pathname || '/';
      var onMain = (p === '/' || p === '' ||
        p === '/feed/subscriptions');
      if (!S.brandHeader || !onMain) {
        if (el) el.remove();
        return;
      }
      if (el && el.isConnected) return;
      // The words were black-on-black in dark mode: the body's
      // text color is the browser default (black) on both doors,
      // not the theme's text color. Pick the color from the page
      // background instead — dark background gets light text,
      // light background gets dark text.
      var fg = '#f5f5f5';
      try {
        var els = [document.body, document.documentElement];
        for (var i = 0; i < els.length; i++) {
          var bg = getComputedStyle(els[i]).backgroundColor || '';
          var m = bg.match(/rgba?\\((\\d+)[,\\s]+(\\d+)[,\\s]+(\\d+)(?:[,\\s]+([\\d.]+))?\\)/);
          if (m && (m[4] === undefined || +m[4] > 0)) {
            var lum = 0.2126 * (+m[1]) + 0.7152 * (+m[2]) + 0.0722 * (+m[3]);
            fg = lum < 128 ? '#f5f5f5' : '#111111';
            break;
          }
        }
      } catch (e) {}
      el = document.createElement('div');
      el.id = 'rf-brand-center';
      el.style.cssText =
        'position:fixed;left:50%;top:26px;' +
        'transform:translate(-50%,-50%);' +
        'display:flex;align-items:center;gap:6px;' +
        'font-weight:800;font-size:14px;letter-spacing:0.2px;' +
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;' +
        'color:' + (fg || '#111111') + ';pointer-events:none;' +
        'white-space:nowrap;z-index:2147483647;';
      var left = document.createElement('span');
      left.textContent = 'Reely';
      var img = document.createElement('img');
      img.src = MARK;
      img.alt = 'Reely Free';
      img.style.cssText =
        'height:20px;width:20px;border-radius:5px;display:block;';
      var right = document.createElement('span');
      right.textContent = 'Free';
      el.appendChild(left);
      el.appendChild(img);
      el.appendChild(right);
      (document.body || document.documentElement).appendChild(el);
    } catch (e) {}
  }
  // The video to PiP — not just the first <video> in the page
  // (YouTube can have several: ads, previews, a hidden one).
  // Prefer the one already in PiP, else the largest playing,
  // visible one. With requirePlaying false, the largest visible
  // video regardless of play state (used when the button is tapped
  // after the video was paused).
  function findPipVideo(requirePlaying) {
    try {
      if (document.pictureInPictureElement) return document.pictureInPictureElement;
      var vids = document.querySelectorAll('video');
      var best = null, bestArea = 0;
      for (var i = 0; i < vids.length; i++) {
        var v = vids[i];
        if (requirePlaying && (v.paused || v.ended || v.readyState <= 1)) continue;
        var r = v.getBoundingClientRect();
        var area = r.width * r.height;
        if (area <= 0) continue;
        if (area > bestArea) { bestArea = area; best = v; }
      }
      return best;
    } catch (e) { return null; }
  }
  // PiP button (Austin, 2026-11-24): YouTube's own PiP button in
  // fullscreen drops PiP immediately — the fullscreen exit
  // re-initializes the player and kills the PiP session — while
  // swiping up to the home screen leaves a working PiP window. So
  // this button triggers PiP directly on the INLINE playing video,
  // skipping the fullscreen-exit dance entirely. It only shows on
  // /watch while a video is playing (or already in PiP), sits on
  // the video's top-right corner, and toggles PiP off when tapped
  // while PiP is active. Hidden in fullscreen, where the native
  // player already has its own PiP button.
  function maintainPipButton() {
    try {
      var btn = document.getElementById('rf-pip-btn');
      var onWatch = (location.pathname || '') === '/watch';
      var v = findPipVideo(true);
      var inPip = !!document.pictureInPictureElement;
      var playing = !!v && !v.paused && !v.ended && v.readyState > 1;
      var inFs = !!document.fullscreenElement ||
        !!(v && v.webkitDisplayingFullscreen);
      if (!onWatch || !v || inFs || (!playing && !inPip)) {
        if (btn) btn.remove();
        return;
      }
      if (!btn) {
        btn = document.createElement('button');
        btn.id = 'rf-pip-btn';
        btn.setAttribute('aria-label', 'Picture in Picture');
        btn.style.cssText =
          'position:fixed;z-index:2147483647;width:40px;height:40px;' +
          'border-radius:20px;border:0;padding:0;' +
          'background:rgba(0,0,0,0.55);display:flex;' +
          'align-items:center;justify-content:center;';
        btn.innerHTML =
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none">' +
          '<rect x="2" y="4" width="20" height="14" rx="2" stroke="#fff" stroke-width="2"/>' +
          '<rect x="12" y="12" width="8" height="6" rx="1" fill="#fff"/>' +
          '</svg>';
        btn.addEventListener('click', function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          try {
            var vid = findPipVideo(true) || findPipVideo(false);
            if (!vid) return;
            if (document.pictureInPictureElement) {
              document.exitPictureInPicture();
            } else {
              if (vid.paused) vid.play();
              if (vid.requestPictureInPicture) vid.requestPictureInPicture();
            }
          } catch (e) {}
        }, true);
        (document.body || document.documentElement).appendChild(btn);
      }
      // Glue it to the video's top-right corner.
      var r = v.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        btn.style.left = Math.max(8, r.right - 48) + 'px';
        btn.style.top = Math.max(8, r.top + 8) + 'px';
        btn.style.display = 'flex';
      } else {
        btn.style.display = 'none';
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
      brandHeaderCenter();
      maintainPipButton();
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
  // Keep the PiP button glued to the video while scrolling (apply
  // only runs every 3s, so a scroll would otherwise leave the
  // button floating over the comments for a moment).
  var pipScrollPending = false;
  window.addEventListener('scroll', function () {
    if (pipScrollPending) return;
    pipScrollPending = true;
    requestAnimationFrame(function () {
      pipScrollPending = false;
      maintainPipButton();
    });
  }, { passive: true });
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
