// Shared diagnostic panel for all five doors (Austin's ask,
// 2026-11-24): a Settings toggle ("Diagnostic panels") shows a
// small panel at the bottom of each door reporting what that
// door's filter sees — the page, the videos, what got blocked or
// covered. Used when adding or debugging a feature, so a
// temporary one-off diagnostic panel never has to be pushed and
// removed again (the YouTube PiP button took three rounds of
// that, and the panel is what finally found the Trusted Types
// block on innerHTML).
//
// The fragment is a plain JS string: it defines __rfDiag(lines)
// (no auto-call — each door calls it on its own interval with
// its own lines, or with null to hide the panel) and is
// interpolated into the door's injected script. It must contain
// no backticks and no ${...}, and every backslash in the emitted
// JS is doubled here (the standing template-literal lesson).
// It uses textContent, never innerHTML — YouTube enforces
// Trusted Types, so an innerHTML assignment throws.
export const DIAG_JS = `
  function __rfDiag(lines) {
    try {
      var el = document.getElementById('rf-diag');
      if (!lines || !lines.length) { if (el) el.remove(); return; }
      if (!el) {
        el = document.createElement('div');
        el.id = 'rf-diag';
        el.style.cssText =
          'position:fixed;left:8px;right:8px;bottom:8px;z-index:2147483647;' +
          'background:rgba(0,0,0,0.88);color:#fff;' +
          'font-family:monospace;font-size:11px;line-height:1.5;' +
          'padding:8px 10px;border-radius:8px;white-space:pre-wrap;' +
          'pointer-events:none;';
        (document.body || document.documentElement).appendChild(el);
      }
      el.textContent = lines.join('\\n');
    } catch (e) {}
  }
`;
