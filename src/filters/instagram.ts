import type { FilterSettings } from '../lib/settings';

// Builds the JavaScript injected into instagram.com before page content
// loads. Same approach as the Facebook filter: stable hooks (URLs,
// <article> post units, visible label text) instead of class names,
// which Meta shuffles constantly, and a MutationObserver to re-apply
// as the feed lazy-loads. Everything is wrapped defensively: a filter
// bug must never break the page itself.
//
// v2 fix (his first-test recording, 2026-11-23): after ~a minute of
// scrolling the feed glitched into a long black void, then recovered
// further down. Cause: Instagram's mobile feed RECYCLES its post
// elements — the same <article> node is refilled with new posts as
// you scroll — and v1's hiding was sticky: once a node was marked
// hidden it stayed hidden forever, so recycled nodes carried the
// hide into whatever post loaded next, blanking more and more of the
// feed the longer he scrolled. v2 re-evaluates every post on every
// pass and UN-hides a node whose current content no longer matches
// any rule — hiding follows the content, never the node. The same
// recording exposed two label misses, also fixed: ads here are
// labelled "Ad" (not only "Sponsored"), and the suggestions header
// reads "Suggestions for you" (with an s).
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
  function unhide(el) {
    if (el && el.getAttribute('data-rf-hidden')) {
      el.removeAttribute('data-rf-hidden');
      el.style.removeProperty('display');
    }
  }
  // An ad carries its label as a small standalone element under the
  // account name: "Ad" or "Sponsored". Leaf elements only, exact text,
  // so a caption merely containing the words never matches.
  function hasAdLabel(post) {
    var leaves = post.querySelectorAll('span, div');
    for (var i = 0; i < leaves.length; i++) {
      var leaf = leaves[i];
      if (leaf.children && leaf.children.length > 0) continue;
      var t = (leaf.textContent || '').trim();
      if (t === 'Ad' || t === 'Sponsored') return true;
    }
    return false;
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
      // Feed posts. NEVER skip a marked post: Instagram recycles
      // these nodes, so every pass re-decides from the CURRENT
      // content and un-hides a node that no longer matches (see the
      // v2 note at the top of this file).
      var posts = document.querySelectorAll('article');
      for (var j = 0; j < posts.length; j++) {
        var post = posts[j];
        var text = '';
        try { text = post.innerText || post.textContent || ''; } catch (e) {}
        var shouldHide = false;
        if (S.blockReels && post.querySelector('a[href^="/reel/"]')) {
          shouldHide = true;
        } else if (S.hideSuggested &&
            (text.indexOf('Suggested for you') >= 0 ||
             text.indexOf('Suggestions for you') >= 0)) {
          shouldHide = true;
        } else if (S.hideSponsored && hasAdLabel(post)) {
          shouldHide = true;
        }
        if (shouldHide) hide(post); else unhide(post);
      }
      // "Suggested for you" sections outside posts (account carousels,
      // follow suggestions on profiles): hide the whole section.
      if (S.hideSuggested) {
        var labels = document.querySelectorAll('div, span, h2, h3, h4');
        for (var k = 0; k < labels.length; k++) {
          var lab = labels[k];
          if (lab.getAttribute('data-rf-hidden')) continue;
          var labText = (lab.textContent || '').trim();
          if (labText !== 'Suggested for you' && labText !== 'Suggestions for you') continue;
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
