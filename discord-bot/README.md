# Reboot Cord Discord Bot

## Why /createcode was failing

`POST /api/createcode` on the server requires an authenticated admin (see `requireAdmin` in `server.js`). The original bot script sent no credentials at all, so the server replied `403 Admin only`, `raise_for_status()` threw, and the bot fell back to "Failed to generate code. Please try again." That is exactly what the screenshot showed.

The fix: the bot now sends an `Authorization` header containing a site API key (`rc_live_...`) that belongs to an admin account. `/api/inbox/discord` had no auth at all before (anyone could inject fake staff messages into the inbox) and now requires the same admin key.

## Setup

1. Log in to the site with an account that has `admin: true`.
2. Open the dashboard's API page and generate a key (`POST /api/v1/apikeys`). It will look like `rc_live_...`. Copy it once — it is only shown at creation time.
3. Copy `.env.example` to `.env` and fill in:
   - `DISCORD_BOT_TOKEN` — your bot's token from the Discord developer portal.
   - `REBOOTCORD_API_KEY` — the `rc_live_...` key from step 2.
   - `SITE_URL` — defaults to `https://rebootcord.world`.
4. `pip install -r requirements.txt`
5. Load the `.env` file into the process environment (e.g. `python-dotenv`, a process manager, or your shell) and run `python bot.py`.

Codes created with `/createcode` are written to the same `db.inviteCodes` store the website and the admin bookmarklet read from, so they show up immediately in the bookmarklet's "Active Invite Codes" list and are valid at `/api/bot/validate` and the registration page right away.
