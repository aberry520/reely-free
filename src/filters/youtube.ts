import type { FilterSettings } from '../lib/settings';

// Builds the JavaScript injected into m.youtube.com before page content
// loads. Rules target stable hooks (URLs, element tags, visible text) rather
// than class names, and a MutationObserver re-applies them as the feed
// lazy-loads. Everything is wrapped defensively: a filter bug must never
// break the page itself.
export function buildYouTubeScript(settings: FilterSettings): string {
  const s = JSON.stringify({
    blockShorts: settings.ytBlockShorts,
    landOnSubs: settings.ytLandOnSubs,
    hideUpNext: settings.ytHideUpNext,
    blockAppPromo: settings.ytBlockAppPromo,
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
  function apply() {
    try {
      var path = location.pathname;
      if (S.blockShorts) {
        var m = path.match(/^\\/shorts\\/([\\w-]{6,})/);
        if (m) { location.replace('/watch?v=' + m[1]); return; }
      }
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
        // Any card whose main link is a Short.
        var links = document.querySelectorAll('a[href^="/shorts/"]');
        for (var j = 0; j < links.length; j++) hideCard(links[j]);
        // The Shorts button in the bottom pivot bar (matched by its label).
        var items = document.querySelectorAll('ytm-pivot-bar-item-renderer');
        for (var k = 0; k < items.length; k++) {
          if ((items[k].textContent || '').trim() === 'Shorts') hide(items[k]);
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
  true;
})();
`;
}
