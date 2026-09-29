// End-to-end tests for the website version. Runs the site locally with in-memory storage.
// Requires Playwright + Chromium:  npm i playwright && npx playwright install chromium
// Run: node tests/site.test.js
process.env.MEMORY_STORE = '1';
process.env.ADMIN_PASSWORD = 'test-pass';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const { start } = require('./server');
const { listClients, getClient } = require('../lib/store');

const PORT = 3417, BASE = 'http://localhost:' + PORT;
const SHOTS = path.join(__dirname, 'screenshots'); fs.mkdirSync(SHOTS, { recursive: true });
let failures = 0;
function assert(c, m) { if (!c) { failures++; console.log('FAIL:', m); } else console.log('ok:', m); }

// Fake browser speech recognition: emits an interim result, then a final one, and keeps listening until stopped.
const FAKE_SR = ({ mode }) => {
  if (mode === 'none') { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; return; }
  class FakeSR {
    start() {
      window.__srStarts = (window.__srStarts || 0) + 1;
      setTimeout(() => {
        if (mode === 'blocked') { this.onerror && this.onerror({ error: 'not-allowed' }); this.onend && this.onend(); return; }
        const phrase = window.__nextPhrase || 'we help busy professionals buy rentals';
        this.onresult && this.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: phrase.split(' ').slice(0, 2).join(' ') }], { isFinal: false })] });
        setTimeout(() => this.onresult && this.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: phrase }], { isFinal: true })] }), 150);
      }, 100);
    }
    stop() { setTimeout(() => this.onend && this.onend(), 50); }
  }
  window.SpeechRecognition = FakeSR; window.webkitSpeechRecognition = FakeSR;
};

async function page(b, opts = {}) {
  const ctx = await b.newContext({ viewport: opts.viewport || { width: 1200, height: 900 }, colorScheme: opts.scheme || 'light' });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  if (opts.apiDown) await ctx.route(/\/api\/client/, r => r.abort());
  await ctx.addInitScript(FAKE_SR, { mode: opts.sr || 'fake' });
  const p = await ctx.newPage();
  p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  return p;
}

(async () => {
  const server = await start(PORT);
  const b = await chromium.launch();

  // ---- Dashboard: sign in, create a client link
  const a = await page(b);
  await a.goto(BASE + '/admin');
  assert(await a.isVisible('text=Sign in'), 'dashboard asks for password');
  await a.fill('#pw', 'nope'); await a.click('button:has-text("Sign in")');
  await a.waitForSelector('text=didn’t work');
  assert(true, 'wrong password rejected');
  await a.fill('#pw', 'test-pass'); await a.click('button:has-text("Sign in")');
  await a.waitForSelector('text=Client interviews');
  assert(await a.waitForSelector('text=No clients yet',{timeout:5000}).then(()=>true,()=>false), 'empty dashboard');
  await a.fill('#newname', 'Maya Torres'); await a.click('button:has-text("Create link")');
  await a.waitForSelector('.trow.admin:has-text("Maya Torres")');
  const clients = await listClients();
  assert(clients.length === 1 && /^[a-f0-9]{16}$/.test(clients[0].code), 'client created with a private 16-character code');
  const CODE = clients[0].code;

  // ---- Client links that don't work
  const x = await page(b);
  await x.goto(BASE + '/');
  assert(await x.isVisible('text=Open your personal interview link'), 'homepage without a code explains it needs a personal link');
  await x.goto(BASE + '/?c=0123456789abcdef');
  await x.waitForSelector('text=isn’t active');
  assert(true, 'unknown code shows link-not-active');

  // ---- Client: record, type, autosave
  const c = await page(b);
  await c.goto(BASE + '/?c=' + CODE);
  await c.waitForSelector('text=Hi Maya');
  assert(await c.isVisible('text=Each question has a record button'), 'welcome explains recording');
  await c.click('button:has-text("Start the interview")');
  assert(await c.isVisible('button.rec:has-text("Record your answer")'), 'record button on question');
  await c.click('button.rec');
  await c.waitForSelector('button.rec.on:has-text("Stop recording")');
  await c.waitForFunction(() => document.querySelector('textarea.answer').value.includes('busy professionals'));
  assert(await c.inputValue('textarea.answer') === 'We help busy professionals buy rentals', 'speech turns into text (capitalized)');
  await c.click('button.rec');
  await c.waitForSelector('button.rec:not(.on):has-text("Record more")');
  assert(true, 'stop recording works; button offers Record more');
  await c.evaluate(() => { window.__nextPhrase = 'mostly W2 earners in Phoenix'; });
  await c.click('button.rec'); await c.waitForFunction(() => document.querySelector('textarea.answer').value.includes('Phoenix'));
  await c.click('button.rec');
  assert(await c.inputValue('textarea.answer') === 'We help busy professionals buy rentals mostly W2 earners in Phoenix', 'second recording appends to the answer');
  await c.waitForTimeout(1600);
  assert(((await getClient(CODE)).answers.q01 || '').includes('Phoenix'), 'answer autosaved to server');
  assert(await c.textContent('#status') === 'Saved', 'status shows Saved');
  await c.click('.dock button:has-text("Next")');
  await c.fill('textarea.answer', 'To get booked calls.');
  await c.click('.dock button:has-text("Next")');
  assert((await getClient(CODE)).answers.q02 === 'To get booked calls.', 'typed answer saved on Next');
  await c.screenshot({ path: path.join(SHOTS, 'client-question.png') });

  // ---- Resume on another device (fresh browser storage)
  const c2 = await page(b, { viewport: { width: 390, height: 844 }, scheme: 'dark' });
  await c2.goto(BASE + '/?c=' + CODE);
  await c2.waitForSelector('text=Pick up right where you left off');
  assert(await c2.isVisible('text=2 of 17 answered'), 'resumes from the server on a new device');
  await c2.click('button:has-text("Continue")');
  assert(await c2.evaluate(() => document.documentElement.scrollWidth) <= 390, 'no sideways scroll on a phone');
  await c2.screenshot({ path: path.join(SHOTS, 'client-phone-dark.png') });

  // ---- Review and send
  await c.click('.rail button:nth-child(17)');
  await c.fill('textarea.answer', 'No crypto talk.');
  await c.click('button:has-text("Review answers")');
  assert(await c.locator('.chip.red').count() === 14, 'review flags the 14 blank questions');
  await c.click('button:has-text("Send my answers")');
  await c.waitForSelector('text=Your answers have been sent');
  const saved = await getClient(CODE);
  assert(saved.status === 'submitted' && saved.submittedAt && saved.answers.q17 === 'No crypto talk.', 'sent: status and all answers on server');

  // ---- Dashboard shows the answers
  await a.click('button:has-text("Refresh")');
  await a.waitForSelector('.trow.admin:has-text("Sent")');
  assert(await a.isVisible('text=3 / 17'), 'dashboard shows progress');
  await a.screenshot({ path: path.join(SHOTS, 'dashboard.png') });
  await a.click('button:has-text("View")');
  assert(await a.isVisible('text=No crypto talk.') && await a.isVisible('text=W2 earners in Phoenix'), 'dashboard shows full answers');
  const [dl] = await Promise.all([a.waitForEvent('download'), a.click('button:has-text("Download .md")')]);
  assert(dl.suggestedFilename() === 'onboarding-maya-torres.md', 'download named after client');

  // ---- Browsers without speech recognition, blocked mic, server unreachable
  const n = await page(b, { sr: 'none' });
  await n.goto(BASE + '/?c=' + CODE); await n.waitForSelector('text=Pick up');
  await n.click('button:has-text("Continue")');
  assert(await n.locator('button.rec').count() === 0 && await n.isVisible('text=Talk instead of typing'), 'no record button where the browser can’t transcribe; dictation tip instead');
  const m = await page(b, { sr: 'blocked' });
  await m.goto(BASE + '/?c=' + CODE); await m.waitForSelector('text=Pick up');
  await m.click('button:has-text("Continue")'); await m.click('button.rec');
  await m.waitForSelector('text=Microphone access is blocked');
  assert(await m.isVisible('button.rec:not(.on)'), 'blocked microphone: clear message, button resets');
  const o = await page(b, { apiDown: true });
  await o.goto(BASE + '/?c=' + CODE);
  await o.waitForSelector('text=saving on this device');
  await o.click('button:has-text("Start")'); await o.fill('textarea.answer', 'offline answer');
  assert((await o.textContent('#status')).includes('this device'), 'server unreachable: saves on device and says so');

  // ---- Setup screens when Vercel isn't configured yet
  process.env.MEMORY_STORE = '0';
  await a.click('button:has-text("All clients")'); await a.click('button:has-text("Refresh")');
  await a.waitForSelector('text=Connect storage');
  assert(true, 'dashboard shows storage setup steps when storage isn’t connected');
  process.env.MEMORY_STORE = '1'; delete process.env.ADMIN_PASSWORD;
  await a.click('button:has-text("Check again")');
  await a.waitForSelector('text=Set your dashboard password');
  assert(true, 'dashboard shows password setup steps when ADMIN_PASSWORD is missing');
  process.env.ADMIN_PASSWORD = 'test-pass';

  // ---- Delete
  await a.click('button:has-text("Check again")'); await a.waitForSelector('text=Client interviews');
  await a.click('button:has-text("View")'); await a.click('button:has-text("Delete client")'); await a.click('button:has-text("Click again")');
  await a.waitForSelector('text=No clients yet');
  assert(!(await getClient(CODE)), 'delete removes the client');

  const errs = [a, x, c, c2, n, m, o].flatMap(p => p.errs);
  assert(errs.length === 0, 'no page errors ' + errs.join('; '));
  await b.close(); server.close();
  console.log(failures ? failures + ' FAILED' : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
