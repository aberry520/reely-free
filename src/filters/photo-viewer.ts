// Shared in-page photo viewer for the two Marketplace doors.
//
// Why our own viewer: Facebook's photo viewer is unreliable
// inside these doors. In the guest door the listing photo is a
// link to the item page itself (tap = no-op — proven by the
// 2026-11-23 diagnostic: tap hits the img, URL never changes,
// no viewer layer ever appears, our sweeps hide nothing). In the
// with-account door the viewer navigates away and the stay-guard
// bounces it back to the feed. So photo taps open OUR viewer
// instead: a full-screen overlay with the tapped photo, close,
// prev/next and swipe. It never changes the page URL, so no
// guard or navigation can interfere. Back closes the viewer
// instead of leaving the page (a history state is pushed on
// open; popstate closes the overlay).
//
// The fragment is a plain JS string: it defines
// installPhotoViewer() (no auto-call — each door calls it where
// its own rules say the viewer applies) and is interpolated into
// the door's injected script. It must contain no backticks and no
// ${...}, and every backslash in the emitted JS is doubled here
// (the standing template-literal lesson).
export const PHOTO_VIEWER_JS = `
  function installPhotoViewer() {
    try {
      if (window.__rfViewerInstalled) return;
      window.__rfViewerInstalled = true;
      var photos = [];
      var index = 0;
      var open = false;
      var pushed = false;
      var overlay = null;
      function itemId() {
        var m = location.pathname.match(/\\/marketplace\\/item\\/(\\d+)/);
        return m ? m[1] : null;
      }
      function collect() {
        var id = itemId();
        var out = [];
        if (!id) return out;
        var imgs = document.querySelectorAll('img');
        for (var i = 0; i < imgs.length; i++) {
          var im = imgs[i];
          var a = im.closest ? im.closest('a[href]') : null;
          if (!a) continue;
          var href = a.getAttribute('href') || '';
          if (href.indexOf('/marketplace/item/' + id) < 0) continue;
          var src = im.currentSrc || im.src || '';
          if (!src || src.indexOf('http') !== 0) continue;
          if (out.indexOf(src) < 0) out.push(src);
        }
        return out;
      }
      function show(i) {
        if (!overlay || !photos.length) return;
        index = (i + photos.length) % photos.length;
        var img = overlay.querySelector('img[data-rf-pv-photo]');
        if (img) img.src = photos[index];
        var count = overlay.querySelector('[data-rf-pv-count]');
        if (count) {
          count.textContent = photos.length > 1
            ? (index + 1) + ' / ' + photos.length : '';
        }
        var prev = overlay.querySelector('[data-rf-pv-prev]');
        var next = overlay.querySelector('[data-rf-pv-next]');
        if (prev) prev.style.display = photos.length > 1 ? '' : 'none';
        if (next) next.style.display = photos.length > 1 ? '' : 'none';
      }
      function closeViewer() {
        if (!open) return;
        open = false;
        if (overlay && overlay.parentElement) {
          overlay.parentElement.removeChild(overlay);
        }
        overlay = null;
      }
      function openViewer(src) {
        photos = collect();
        if (!photos.length) photos = [src];
        index = photos.indexOf(src);
        if (index < 0) index = 0;
        if (overlay) closeViewer();
        overlay = document.createElement('div');
        overlay.setAttribute('data-rf-viewer', '1');
        overlay.style.cssText =
          'position:fixed;left:0;top:0;right:0;bottom:0;z-index:2147483647;' +
          'background:rgba(0,0,0,0.96);display:flex;align-items:center;' +
          'justify-content:center;';
        var img = document.createElement('img');
        img.setAttribute('data-rf-pv-photo', '1');
        img.style.cssText =
          'max-width:100vw;max-height:100vh;object-fit:contain;' +
          'display:block;';
        img.src = photos[index];
        overlay.appendChild(img);
        var closeBtn = document.createElement('div');
        closeBtn.setAttribute('data-rf-pv-close', '1');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText =
          'position:absolute;left:12px;top:12px;width:44px;height:44px;' +
          'border-radius:22px;background:rgba(255,255,255,0.2);color:#fff;' +
          'font-size:24px;line-height:44px;text-align:center;';
        overlay.appendChild(closeBtn);
        var prev = document.createElement('div');
        prev.setAttribute('data-rf-pv-prev', '1');
        prev.textContent = '‹';
        prev.style.cssText =
          'position:absolute;left:8px;top:50%;margin-top:-24px;width:48px;' +
          'height:48px;border-radius:24px;background:rgba(255,255,255,0.2);' +
          'color:#fff;font-size:32px;line-height:44px;text-align:center;';
        overlay.appendChild(prev);
        var next = document.createElement('div');
        next.setAttribute('data-rf-pv-next', '1');
        next.textContent = '›';
        next.style.cssText =
          'position:absolute;right:8px;top:50%;margin-top:-24px;width:48px;' +
          'height:48px;border-radius:24px;background:rgba(255,255,255,0.2);' +
          'color:#fff;font-size:32px;line-height:44px;text-align:center;';
        overlay.appendChild(next);
        var count = document.createElement('div');
        count.setAttribute('data-rf-pv-count', '1');
        count.style.cssText =
          'position:absolute;left:0;right:0;bottom:16px;color:#fff;' +
          'font-size:14px;text-align:center;';
        overlay.appendChild(count);
        (document.body || document.documentElement).appendChild(overlay);
        open = true;
        show(index);
        try {
          history.pushState({ rfViewer: 1 }, '', location.href);
          pushed = true;
        } catch (e) {}
        var startX = 0, startY = 0;
        overlay.addEventListener('touchstart', function (e) {
          var t = e.changedTouches && e.changedTouches[0];
          if (t) { startX = t.clientX; startY = t.clientY; }
        }, { passive: true });
        overlay.addEventListener('touchend', function (e) {
          var t = e.changedTouches && e.changedTouches[0];
          if (!t) return;
          var dx = t.clientX - startX, dy = t.clientY - startY;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
            show(index + (dx < 0 ? 1 : -1));
          }
        }, { passive: true });
        overlay.addEventListener('click', function (e) {
          var t = e.target;
          if (!t) return;
          var goBack = false;
          if (t.hasAttribute && t.hasAttribute('data-rf-pv-close')) {
            goBack = true;
            closeViewer();
          } else if (t.hasAttribute && t.hasAttribute('data-rf-pv-prev')) {
            show(index - 1);
          } else if (t.hasAttribute && t.hasAttribute('data-rf-pv-next')) {
            show(index + 1);
          } else if (t === overlay) {
            goBack = true;
            closeViewer();
          }
          if (goBack && pushed) {
            pushed = false;
            try { history.back(); } catch (e2) {}
          }
        });
      }
      window.addEventListener('popstate', function () {
        if (open) {
          pushed = false;
          closeViewer();
        }
      });
      // Capture-phase tap intercept, on item pages only: the
      // tapped photo (main photo or thumbnail — any img whose link
      // points at THIS item) opens our viewer instead of whatever
      // Facebook would do with the tap. Related listings below
      // point at other items, so their taps pass through untouched.
      document.addEventListener('click', function (ev) {
        try {
          if (!itemId()) return;
          var t = ev.target;
          var img = null;
          if (t && t.tagName === 'IMG') img = t;
          else {
            var at = null;
            try { at = document.elementFromPoint(ev.clientX, ev.clientY); } catch (e) {}
            if (at && at.tagName === 'IMG') img = at;
            else if (t && t.querySelector) img = t.querySelector('img');
          }
          if (!img) return;
          var a = img.closest ? img.closest('a[href]') : null;
          if (!a) return;
          var href = a.getAttribute('href') || '';
          if (href.indexOf('/marketplace/item/' + itemId()) < 0) return;
          var src = img.currentSrc || img.src || '';
          if (!src) return;
          ev.preventDefault();
          ev.stopPropagation();
          if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
          openViewer(src);
        } catch (e) {}
      }, true);
    } catch (e) {}
  }
`;
