// Small helpers shared by the API routes.
const TOTAL = 17;
const MAX_ANSWER = 20000;

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

// Vercel's Node runtime usually parses JSON into req.body; fall back to reading the stream.
async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body || '{}'); } catch (e) { return {}; } }
  const chunks = [];
  let size = 0;
  for await (const c of req) { size += c.length; if (size > 1e6) break; chunks.push(c); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch (e) { return {}; }
}

function cleanAnswers(input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  for (let i = 1; i <= TOTAL; i++) {
    const id = 'q' + String(i).padStart(2, '0');
    if (typeof input[id] === 'string') out[id] = input[id].slice(0, MAX_ANSWER);
  }
  return out;
}

const isCode = code => /^[a-f0-9]{16}$/.test(code);

module.exports = { send, readJson, cleanAnswers, isCode, TOTAL };
