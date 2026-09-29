// Client endpoint: a client reads and saves their own interview using the code in their personal link.
//   GET  /api/client?c=CODE   -> { name, answers, status, startedAt, updatedAt, submittedAt }
//   PUT  /api/client?c=CODE   body { answers, submit? } -> { ok, updatedAt, status }
//   POST is accepted as PUT (used when the page saves while closing).
const { getClient, putClient } = require('../lib/store');
const { readJson, send, cleanAnswers, isCode } = require('../lib/http');

module.exports = async function handler(req, res) {
  try {
    const code = String((req.query && req.query.c) || '');
    if (!isCode(code)) return send(res, 400, { error: 'bad_code' });
    const client = await getClient(code);
    if (!client) return send(res, 404, { error: 'not_found' });

    if (req.method === 'GET') {
      return send(res, 200, {
        name: client.name,
        answers: client.answers || {},
        status: client.status,
        startedAt: client.startedAt || null,
        updatedAt: client.updatedAt || null,
        submittedAt: client.submittedAt || null,
      });
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      const body = await readJson(req);
      const now = new Date().toISOString();
      client.answers = cleanAnswers(body.answers);
      client.updatedAt = now;
      if (!client.startedAt) client.startedAt = now;
      if (body.submit === true) {
        client.status = 'submitted';
        client.submittedAt = now;
      } else if (client.status !== 'submitted') {
        client.status = 'in_progress';
      }
      await putClient(client);
      return send(res, 200, { ok: true, updatedAt: now, status: client.status });
    }

    res.setHeader('Allow', 'GET, PUT, POST');
    return send(res, 405, { error: 'method_not_allowed' });
  } catch (e) {
    return send(res, e.status || 500, { error: e.status ? e.message : 'server_error' });
  }
};
