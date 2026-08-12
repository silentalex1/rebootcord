# Admin Panel Bookmarklet

`bookmarklet.js` is the readable source. `bookmarklet.min.txt` is the actual `javascript:` URL to paste into a browser bookmark's URL field.

## What was fixed

- The version you sent had a corrupted `%60` in the middle of the CSS template literal instead of a real backtick, which would throw a syntax error the moment it ran. Rebuilt from a real backtick.
- `API_BASE` was hardcoded to `https://rebootcord.world`. It now uses `window.location.origin`, so it targets whatever host you're actually logged into and never sends the session cookie somewhere unintended.
- All `fetch` calls now explicitly pass `credentials: 'include'`.

## How it connects to the Discord bot

The panel and the bot both read/write the same server-side `db.inviteCodes` / `db.users` / `db.adminApiKeys` data through `server.js`. Invite codes the bot creates via `/createcode` appear in the panel's "Active Invite Codes" list on the next `fetchData()` call (it re-fetches after every action, and on load), no separate sync needed. Nothing here needed to change for that to work — it already shared state.

## Auth model

This panel authenticates with your existing site session cookie (`rc_tok`), the same as the site itself — you must be logged in as an admin in that browser tab for `/api/admin/*` to return real data. The Discord bot instead authenticates with an `rc_live_...` API key (see `discord-bot/README.md`), since it has no browser session.
