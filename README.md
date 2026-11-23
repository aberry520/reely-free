# Reely Free

Austin's personal "social lite": Facebook and YouTube in a WebView wrapper
with the addictive surfaces filtered out. Built with Expo (SDK 58), same
stack as Reseller HQ.

- **YouTube**: no Shorts (shelves, button, search results), lands on
  Subscriptions instead of the recommendation feed, no Up Next rail. A
  Shorts link someone sends opens as a normal watch page.
- **Facebook**: no Reels, no "Suggested for you" posts, no sponsored posts.
  Feed, groups and **Marketplace** stay. Messenger stays in its own app.
- **Settings**: per-platform toggles, saved on the device.
- **Feel**: the app follows the phone's light/dark setting (the sites do
  too). Facebook and YouTube open full-screen — no header, no toolbar — and
  a swipe up on the bar at the bottom center (same motion as the iPhone home
  gesture) goes back to the app's home screen. A tap on the bar works too.

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
