# Onboarding Questions

Client onboarding interview for Videos That Convert. Clients answer 17 questions by talking or typing, their answers save as they go, and you see every client's answers on a password-protected dashboard.

Live site: https://onboardinginterview.vercel.app

## How it works

- **Your dashboard:** `/admin`. Sign in with your password, add a client by name, and you get their personal link (copied automatically). The dashboard shows each client's progress, their full answers, and lets you copy or download them.
- **Client link:** `/?c=<code>`. Each client gets their own link with no sign-in. They see only their own interview.
- **Voice answers:** each question has a **Record your answer** button. The browser turns speech into text as they talk (Chrome, Edge and Safari, including iPhone and Android). The first time, the browser asks to use the microphone. In browsers without speech-to-text (such as Firefox), the page shows how to use keyboard dictation instead.
- **Saving:** answers save to the server about a second after the client stops talking or typing, and on every Next/Back. If the server can't be reached, answers keep saving on the client's device and send once they reopen the link.

## One-time setup in Vercel

1. **Connect storage.** In the Vercel project, open **Storage**, choose **Create Database**, pick **Upstash for Redis** (the free plan is plenty), and connect it to this project. This adds the `KV_REST_API_URL` and `KV_REST_API_TOKEN` variables for you.
2. **Set your password.** Open **Settings -> Environment Variables** and add `ADMIN_PASSWORD` with the password you want for the dashboard.
3. **Redeploy.** In **Deployments**, open the menu on the latest deployment and choose **Redeploy**.

Until both are set, `/admin` shows these steps instead of the dashboard.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | The client interview page. |
| `admin.html` | Your dashboard. |
| `assets/questions.js` | The 17 questions and their helper text. Edit wording here; keep the order, since answers are stored by position (`q01`...`q17`). |
| `assets/style.css` | Shared styles. |
| `api/client.js` | Loads and saves one client's answers, by their link code. |
| `api/admin.js` | Dashboard API: list clients, create a link, delete a client. Requires the `x-admin-password` header. |
| `lib/store.js` | Storage (Upstash Redis REST API; `MEMORY_STORE=1` for local testing). |
| `tests/` | Local server and end-to-end browser tests. |
| `claude-artifact/` | The earlier versions built as Claude artifact pages (onboarding interview and script interview). Not deployed. |
| `skills/client-script-interview/SKILL.md` | The Claude skill for script interviews. Not deployed. |

## Running locally

```bash
MEMORY_STORE=1 ADMIN_PASSWORD=test node tests/server.js
# open http://localhost:3000/admin (password: test)
```

## Tests

Requires Node 18+ and Playwright with Chromium:

```bash
npm install --no-save playwright
npx playwright install chromium
node tests/site.test.js
```

The tests cover: dashboard sign-in, creating client links, invalid links, voice recording (simulated speech recognition), autosave, resuming on another device, sending, the dashboard's answer view and download, browsers without speech-to-text, a blocked microphone, the server being unreachable, the setup screens, and deleting a client.
