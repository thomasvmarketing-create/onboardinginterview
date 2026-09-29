// Admin endpoint for the owner's dashboard. Every request needs the header
//   x-admin-password: <value of the ADMIN_PASSWORD env var>
//   GET    /api/admin            -> { clients: [...] }
//   POST   /api/admin  { name }  -> { client }   (creates a new personal link)
//   DELETE /api/admin?c=CODE     -> { ok }
const crypto = require('crypto');
const { getClient, putClient, listClients, deleteClient } = require('../lib/store');
const { readJson, send, isCode } = require('../lib/http');

function authorized(req) {
  const expected = process.env.ADMIN_PASSWORD || '';
  const given = String(req.headers['x-admin-password'] || '');
  const a = crypto.createHash('sha256').update(expected).digest();
  const b = crypto.createHash('sha256').update(given).digest();
  return crypto.timingSafeEqual(a, b);
}

module.exports = async function handler(req, res) {
  try {
    if (!process.env.ADMIN_PASSWORD) return send(res, 503, { error: 'admin_password_not_set' });
    if (!authorized(req)) return send(res, 401, { error: 'wrong_password' });

    if (req.method === 'GET') {
      const clients = await listClients();
      clients.sort((x, y) => (y.updatedAt || y.createdAt || '').localeCompare(x.updatedAt || x.createdAt || ''));
      return send(res, 200, { clients });
    }

    if (req.method === 'POST') {
      const body = await readJson(req);
      const name = String(body.name || '').trim().slice(0, 120);
      if (!name) return send(res, 400, { error: 'name_required' });
      const client = {
        code: crypto.randomBytes(8).toString('hex'),
        name,
        createdAt: new Date().toISOString(),
        answers: {},
        status: 'new',
        startedAt: null,
        updatedAt: null,
        submittedAt: null,
      };
      await putClient(client);
      return send(res, 201, { client });
    }

    if (req.method === 'DELETE') {
      const code = String((req.query && req.query.c) || '');
      if (!isCode(code)) return send(res, 400, { error: 'bad_code' });
      if (!(await getClient(code))) return send(res, 404, { error: 'not_found' });
      await deleteClient(code);
      return send(res, 200, { ok: true });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return send(res, 405, { error: 'method_not_allowed' });
  } catch (e) {
    return send(res, e.status || 500, { error: e.status ? e.message : 'server_error' });
  }
};
