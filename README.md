# Reely Free

Austin's personal "social lite": Facebook and YouTube in a WebView wrapper
with the addictive surfaces filtered out. Built with Expo (SDK 58), same
stack as Reseller HQ.

- **YouTube**: no Shorts (shelves, button, search results), lands on
  Subscriptions instead of the recommendation feed, no Up Next rail. A
  Shorts link someone sends opens as a normal watch page. The "Get the best
  experience" app popup and the header's Open App button are hidden too.
  Swiping down on a playing video goes back to the feed, like the app's
  mini-player gesture — except the video stops, because the web player
  can't float over the page (the one thing the real app does that a
  WebView can't).
- **Facebook**: no Reels, no "Suggested for you" posts, no sponsored posts,
  and the "Open app" bar at the bottom of the feed is hidden. Feed, groups
  and **Marketplace** stay. Messenger stays in its own app.
- Links that try to open the real apps (fb://, youtube://, App Store) are
  refused by the WebView itself, so a banner that slips past a filter still
  can't kick him out of the app.
- **Settings**: per-platform toggles, saved on the device.
- **Feel**: the app follows the phone's light/dark setting (the sites do
  too). Facebook and YouTube open full-screen — no header, no toolbar. Four
  ways back home, each with its own on/off switch in Settings: the floating
  home button (draggable, snaps to a side, remembers its spot), swipe up
  from the bottom, swipe in from the left edge, swipe in from the right
  edge. Bottom swipe defaults off because iOS reserves the whole bottom
  edge for itself and kept stealing it; if all four are off, the button
  stays anyway so a site screen is never a dead end. A smaller floating
  back button appears only when the page has somewhere to go back to
  (video → feed), and it has its own switch too.

The filters are injected JavaScript (`src/filters/`) that target stable
hooks — URLs, element tags, visible label text — not class names, and
re-apply via a MutationObserver as the feeds lazy-load. When a site changes
its markup, the fix goes in those two files.

## Run it (on Austin's PC)

```powershell
cd $HOME\Repos\Personal\reely-free   # wherever the repo is cloned
& "C:\Program Files\nodejs\npm.cmd" install --legacy-peer-deps
& "C:\Program Files\nodejs\npx.cmd" expo start
```

Scan the QR code with Expo Go (same Wi-Fi). Sign in to Facebook and YouTube
inside the app once; the WebView keeps the login.

## Notes

- Personal use only. Logging in through a wrapper is against Meta's and
  YouTube's terms in the same way SocialLite is; occasional "was this you?"
  login checkpoints are possible.
- The icon is still Reseller HQ's placeholder art for now.
