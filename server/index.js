require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const https = require('https');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'web')));

// Basic config validation
function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.warn(`[CONFIG] Missing ${name}. Define it in .env`);
  }
  return v;
}

const JIRA_BASE_URL = (requireEnv('JIRA_BASE_URL') || '').replace(/\/$/, ''); // normalize: no trailing slash
const JIRA_EMAIL = process.env.JIRA_EMAIL || '';
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || '';
const JIRA_PAT = process.env.JIRA_PAT || '';
const JIRA_ACCOUNT_ID = process.env.JIRA_ACCOUNT_ID || '';
// Detect deployment type and API version
const IS_CLOUD = /\.atlassian\.net$/i.test(JIRA_BASE_URL);
const JIRA_API_VERSION = process.env.JIRA_API_VERSION || (IS_CLOUD ? '3' : '2');
const JIRA_AUTH_TYPE = (process.env.JIRA_AUTH_TYPE || (IS_CLOUD ? 'basic' : (JIRA_PAT ? 'bearer' : 'basic'))).toLowerCase();

// HTTPS agent with optional extra CA(s)
const EXTRA_CA_DIR = process.env.EXTRA_CA_DIR || '';
const NODE_EXTRA_CA_CERTS = process.env.NODE_EXTRA_CA_CERTS || '';
let caBundle;
try {
  if (NODE_EXTRA_CA_CERTS) {
    caBundle = fs.readFileSync(NODE_EXTRA_CA_CERTS);
  } else if (EXTRA_CA_DIR) {
    // read all .crt/.cer/.pem files from directory and concatenate
    const exts = new Set(['.crt', '.cer', '.pem']);
    const files = fs.readdirSync(EXTRA_CA_DIR)
      .filter(f => exts.has(path.extname(f).toLowerCase()))
      .map(f => path.join(EXTRA_CA_DIR, f));
    if (files.length) {
      caBundle = files.map(f => fs.readFileSync(f)).join('\n');
    }
  }
} catch (e) {
  console.warn('[TLS] Failed to load EXTRA_CA certs:', e.message);
}
const httpsAgent = caBundle ? new https.Agent({ ca: caBundle, rejectUnauthorized: true }) : undefined;

function fetchWithAgent(url, options = {}) {
  const opts = { ...options };
  if (httpsAgent && !opts.agent) opts.agent = httpsAgent;
  return fetch(url, opts);
}

async function parseResponse(r) {
  const ct = r.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return await r.json();
  }
  const text = await r.text();
  try { return JSON.parse(text); } catch {
    return { message: text.slice(0, 1000) };
  }
}

function jiraHeaders() {
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };
  if (JIRA_AUTH_TYPE === 'bearer') {
    if (!JIRA_PAT) console.warn('[CONFIG] Using bearer auth but JIRA_PAT is empty');
    headers['Authorization'] = `Bearer ${JIRA_PAT}`;
  } else {
    if (!JIRA_EMAIL || !JIRA_API_TOKEN) console.warn('[CONFIG] Using basic auth but JIRA_EMAIL or JIRA_API_TOKEN is empty');
    const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
    headers['Authorization'] = `Basic ${auth}`;
  }
  return headers;
}

// List open issues assigned to the current user (or by JQL)
app.get('/api/issues', async (req, res) => {
  try {
    const jql = req.query.jql || 'assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC';
    const url = `${JIRA_BASE_URL}/rest/api/${JIRA_API_VERSION}/search?jql=${encodeURIComponent(jql)}&maxResults=100`;
    const r = await fetchWithAgent(url, { headers: jiraHeaders() });
    const data = await parseResponse(r);
    if (!r.ok) return res.status(r.status).json(data);
    res.json((data.issues||[]).map(i => ({
      id: i.id,
      key: i.key,
      summary: i.fields.summary,
      issuetype: i.fields.issuetype?.name,
      status: i.fields.status?.name,
      project: i.fields.project?.key
    })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch issues' });
  }
});

// Get worklogs for an issue
app.get('/api/issues/:issueId/worklogs', async (req, res) => {
  try {
    const { issueId } = req.params;
    const url = `${JIRA_BASE_URL}/rest/api/${JIRA_API_VERSION}/issue/${issueId}/worklog`;
    const r = await fetchWithAgent(url, { headers: jiraHeaders() });
    const data = await parseResponse(r);
    if (!r.ok) return res.status(r.status).json(data);
    res.json(data.worklogs || []);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch worklogs' });
  }
});

// Create worklog on an issue
app.post('/api/issues/:issueId/worklogs', async (req, res) => {
  try {
    const { issueId } = req.params;
    const { started, timeSpentSeconds } = req.body;
    const body = {
      started, // e.g. '2025-09-04T10:00:00.000+0000'
      timeSpentSeconds,
      author: JIRA_ACCOUNT_ID ? { accountId: JIRA_ACCOUNT_ID } : undefined
    };
    const url = `${JIRA_BASE_URL}/rest/api/${JIRA_API_VERSION}/issue/${issueId}/worklog`;
    const r = await fetchWithAgent(url, { method: 'POST', headers: jiraHeaders(), body: JSON.stringify(body) });
    const data = await parseResponse(r);
    if (!r.ok) return res.status(r.status).json(data);
    res.status(201).json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create worklog' });
  }
});

// Update worklog
app.put('/api/issues/:issueId/worklogs/:worklogId', async (req, res) => {
  try {
    const { issueId, worklogId } = req.params;
    const { started, timeSpentSeconds } = req.body;
    const body = {
      started,
      timeSpentSeconds
    };
    const url = `${JIRA_BASE_URL}/rest/api/${JIRA_API_VERSION}/issue/${issueId}/worklog/${worklogId}`;
    const r = await fetchWithAgent(url, { method: 'PUT', headers: jiraHeaders(), body: JSON.stringify(body) });
    const data = await parseResponse(r);
    if (!r.ok) return res.status(r.status).json(data);
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update worklog' });
  }
});

// Delete worklog
app.delete('/api/issues/:issueId/worklogs/:worklogId', async (req, res) => {
  try {
    const { issueId, worklogId } = req.params;
    const url = `${JIRA_BASE_URL}/rest/api/${JIRA_API_VERSION}/issue/${issueId}/worklog/${worklogId}`;
    const r = await fetchWithAgent(url, { method: 'DELETE', headers: jiraHeaders() });
    if (!r.ok) {
      const data = await parseResponse(r).catch(() => ({}));
      return res.status(r.status).json(data);
    }
    res.status(204).send();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete worklog' });
  }
});

// Simple health check
app.get('/api/health', (_, res) => res.json({ ok: true }));

// Fallback to index.html for client routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'web', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
