# Admin Panel Bookmarklet

`bookmarklet.js` is the readable source. `bookmarklet.min.txt` is the actual `javascript:` URL — the whole file's content is the bookmark's URL.

## The error you were hitting

Pasting a `javascript:...` URL directly into the address bar and pressing Enter does not run it. Chrome, Edge and Firefox all strip the literal text `javascript:` the moment you paste it into the omnibox (an anti self-XSS protection), which leaves just the raw code sitting in the bar. The browser then treats what's left as a search/URL, which is exactly the ERR_NAME_NOT_RESOLVED / "This site can't be reached" screen you saw — it was trying to navigate to a "domain" made of your own JS code.

The fix isn't in the script — it's in how the bookmarklet gets installed. Do this instead:

1. Right-click your bookmarks bar and choose Add page (or Add bookmark).
2. Set the Name to `Reboot Cord Admin`.
3. Set the URL field to the entire single-line contents of `bookmarklet.min.txt`.
4. Save. While logged into Reboot Cord as an admin, click the bookmark itself (don't paste it into the address bar) — the panel opens as an overlay on the page.

If you already have an old "Reboot Cord Admin" bookmark saved from before, **edit that existing bookmark's URL** (or delete it and add a new one) — an old copy still pointing at the previous broken code is exactly what produces `Function statements require a function name` and `document.getelementbyid is not a function` when clicked, since it runs in whatever page you're on (which is why the error shows up tagged with `/dashboard:1`). Clicking the corrected bookmark fixes it; there's no separate site bug to chase here.

## What was fixed in the code itself

- `API_BASE` uses `window.location.origin`, so it targets whatever host you're logged into instead of a hardcoded domain.
- All `fetch` calls explicitly pass `credentials: 'include'`.
- `bookmarklet.min.txt` is a plain, valid `javascript:` URI (whitespace/newlines stripped, no characters escaped) with no corrupted template-literal backticks and no double-encoding.

## How it connects to the Discord bot

The panel and the bot both read/write the same server-side `db.inviteCodes` / `db.users` / `db.adminApiKeys` data through `server.js`. Invite codes the bot creates via `/createcode` appear in the panel's Active Invite Codes list on the next `fetchData()` call, no separate sync needed.

## Auth model

This panel authenticates with your existing site session cookie (`rc_tok`), the same as the site itself — you must be logged in as an admin in that browser tab for `/api/admin/*` to return real data. The Discord bot instead authenticates with an `rc_live_...` API key, since it has no browser session.
