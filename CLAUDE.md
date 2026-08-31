# SPENDI — project context

Personal travel spending tracker (PWA). Owner: Sam. Built iteratively with Claude; keep it simple.

## Architecture — do not change without asking
- **Single-file app**: everything (HTML + CSS + JS) lives in `index.html`. No frameworks, no build step, no npm. Keep it that way.
- `sw.js`: service worker. Network-first with a 2.5s timeout then cache fallback, so a deploy shows up the next time the app is opened while no signal still opens instantly. Installs with `cache: "reload"` (GitHub Pages sets a 10-minute browser cache, which otherwise lets a deploy cache the *previous* version's files). Cross-origin requests are passed straight through so a fetched rate is never answered from cache.
- Deployed on **GitHub Pages** from `main` branch root. User opens it as an iOS home-screen app (Add to Home Screen from Safari).
- **Persistence**: `localStorage` only, key `spendi_v2`. No backend, no accounts. The only network call is the opt-in ₪ rate lookup (rule 4); nothing else touches the network at runtime.

## Data model (localStorage `spendi_v2`)
```json
{
  "trips": [{ "id": 123, "name": "Japan", "currency": "JPY", "ilsRate": 0.024, "budget": 300000, "entries": [
    { "id": 456, "amount": 4500, "method": "Cash", "category": "Food & Drink", "note": "", "date": "2026-12-01" }
  ]}],
  "activeTripId": 123,
  "methods": [{ "name": "Cash", "color": "#F5C518" }, { "name": "Card", "color": "#1A73E8" }],
  "lastMethod": "Cash",
  "lastCategory": "Food & Drink"
}
```
- Never break backward compatibility with stored data. If the schema changes, write a migration in `load()` (see existing v1→v2 migration pattern).

## Hard rules
1. **iOS home-screen apps suppress `alert()` / `confirm()` / `prompt()`.** Never use them. Use inline notices (`.panel-err`), in-app banners, or two-tap confirm patterns (see `menuDelete`).
2. **Bump the cache version in `sw.js`** (currently `spendi-v3`; go to `spendi-v4` next) on EVERY deployed change, or phones keep serving the stale cached version.
3. **Auto-save**: every state mutation must call `persist()` immediately. There is no save button by design.
4. **Offline-first**: the app must load and work fully with no signal. The only network call allowed is the ₪ rate lookup, and only when the user taps "↻ Fetch" (`open.er-api.com`, no API key, all 33 listed currencies). It must never run on load, never block anything, and always fall back to typing the rate by hand. Rates are still stored per trip — nothing is fetched at render time.
5. Currency is set at trip creation and never editable afterward. Rate to ₪ (`ilsRate`) is mandatory for non-ILS trips (validated in `createTrip` and `saveTripSettings`). Note this means the auto-created "General" trip (USD, no rate) cannot be saved from settings until a rate is entered — that is intended, not a bug.
6. A slow rate lookup must never write into the field after the user has changed currency or left the panel. `fetchRate` guards this with a request id plus a `stillWanted` check; keep that if you touch it, because a silently wrong rate corrupts every ₪ figure in the trip.
7. All money displayed with `Intl.NumberFormat`. ₪ equivalents shown small next to trip totals, budget, and in the trips menu.

## Design
- Colors: background `#0a0a14`, cards `#11111f`, yellow accent `#F5C518`, blue `#1A73E8`, borders `#2a2a3e`.
- Mobile-first, max-width 480px. Big tap targets. Name is SPENDI (all caps) — title, logo, and `apple-mobile-web-app-title`.

## Testing
Before considering any change done, test with Playwright (python) against a local server:
```bash
python3 -m http.server 8765 -d . &
# then playwright: load http://localhost:8765/, exercise the changed flow,
# reload to verify localStorage persistence, and test offline via context.set_offline(True)
```
Always verify: (a) no page errors, (b) data survives reload, (c) app loads offline.

## Deploy
Commit + push to `main`. GitHub Pages redeploys automatically in ~1 minute. Remind the user to open the app once while online so the service worker picks up the new version.

## Known gaps (intentional, don't "fix" unprompted)
- No backup/export yet — data dies with the phone. Planned next.
- No sync between devices. Single-device by design.
- localStorage is wiped if the user clears Safari website data.
