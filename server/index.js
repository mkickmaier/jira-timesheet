require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const https = require('https');
const fs = require('fs');
const xlsx = require('xlsx');
const multer = require('multer');
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

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '..', 'example_files');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    // We'll rename it in the endpoint once we have the PI name
    cb(null, 'temp_' + file.originalname);
  }
});
const upload = multer({ storage: storage });

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

/**
 * Parses capacity from Excel file matching PI name.
 * Expected format: PI_CAPA_<PI_NAME>.xlsx in example_files/
 */
function getCapacityFromExcel(pi) {
  try {
    // Normalize PI name for filename (replace underscores with whatever is expected or just use as is)
    // The user mentioned PI_CAPA_2026_04.xlsx for PI 26_04. 
    // It seems they use 2026_04 in filename for 26_04 PI. 
    // Let's try multiple patterns.
    const possibleFilenames = [
      `PI_CAPA_20${pi}.xlsx`,
      `PI_CAPA_${pi}.xlsx`,
      `PI_CAPA_20${pi.replace('_', '')}.xlsx`
    ];

    let filePath = '';
    for (const name of possibleFilenames) {
      const p = path.join(__dirname, '..', 'example_files', name);
      if (fs.existsSync(p)) {
        filePath = p;
        break;
      }
    }

    if (!filePath) {
      console.log(`[CAPACITY] No Excel file found for PI ${pi}`);
      return null;
    }

    console.log(`[CAPACITY] Parsing Excel: ${filePath}`);
    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    if (!data.length) return null;

    // Row 0: Member names starting from col 4 (index 4)
    const membersList = data[0].slice(4).filter(name => name !== null && name !== undefined);
    const capacityMap = {}; // { memberName: { iterationName: capacityInSeconds } }

    membersList.forEach(name => {
      capacityMap[name] = {};
    });

    // Iterate rows to find iterations and their CAPA
    let currentIteration = null;
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (!row || !row.length) continue;

      // Check if this row starts an iteration (e.g. PI2026_04_01 in column 0)
      if (row[0] && typeof row[0] === 'string' && row[0].startsWith('PI')) {
        // Normalize iteration name: PI2026_04_01 -> 26_04_01
        currentIteration = row[0].replace(/^PI20/, '').replace(/^PI/, '');
      }

      // Check for CAPA row
      if (currentIteration && row[1] === 'CAPA') {
        membersList.forEach((name, idx) => {
          const val = row[idx + 4];
          if (typeof val === 'number') {
            capacityMap[name][currentIteration] = val * 3600; // convert hours to seconds
          }
        });
      }
    }

    return {
      members: membersList,
      capacity: capacityMap
    };
  } catch (e) {
    console.error('[CAPACITY] Excel parsing error:', e);
    return null;
  }
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

// Upload capacity Excel file
app.post('/api/capacity/upload', upload.single('file'), (req, res) => {
  try {
    const { pi } = req.body;
    if (!pi) return res.status(400).json({ error: 'PI name is required' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const ext = path.extname(req.file.originalname);
    if (ext !== '.xlsx') {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Only .xlsx files are allowed' });
    }

    // Expected format: PI_CAPA_20<pi>.xlsx
    const newFileName = `PI_CAPA_20${pi}.xlsx`;
    const newPath = path.join(__dirname, '..', 'example_files', newFileName);

    // If file exists, it will be overwritten
    fs.renameSync(req.file.path, newPath);

    console.log(`[CAPACITY] Uploaded and saved: ${newFileName}`);
    res.json({ message: 'File uploaded successfully', filename: newFileName });
  } catch (e) {
    console.error('[CAPACITY] Upload error:', e);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Get capacity data for a PI
app.get('/api/capacity', async (req, res) => {
  try {
    const { pi } = req.query;
    if (!pi) return res.status(400).json({ error: 'PI name is required' });

    // 1. Fetch sprints (iterations) matching the PI name
    // As per requirement, we iterate over sprint names <PI_name>_01, <PI_name>_02...
    // until the query returns no items, because JQL doesn't support placeholders for sprints.
    const allIssues = [];
    const iterationsFound = new Set();
    let iterationNum = 1;
    let keepFetching = true;

    while (keepFetching) {
      const sprintName = `${pi}_${String(iterationNum).padStart(2, '0')}`;
      const searchJql = `sprint = "${sprintName}"`;
      const searchUrl = `${JIRA_BASE_URL}/rest/api/${JIRA_API_VERSION}/search?jql=${encodeURIComponent(searchJql)}&fields=summary,assignee,timeestimate,customfield_10020,customfield_10001,sprint&maxResults=1000`;
      
      console.log(`[CAPACITY] Fetching Iteration ${iterationNum}: ${sprintName}`);
      const r = await fetchWithAgent(searchUrl, { headers: jiraHeaders() });
      const data = await parseResponse(r);
      
      if (!r.ok) {
        // If one fails, we log it but might want to stop or continue. 
        // Usually, if it's 400 because sprint doesn't exist, it means we reached the end.
        console.warn(`[CAPACITY] Iteration ${sprintName} fetch stopped or failed:`, data.errorMessages || data.message);
        keepFetching = false;
        break;
      }

      const issues = data.issues || [];
      if (issues.length === 0) {
        console.log(`[CAPACITY] No more issues found for ${sprintName}. Stopping.`);
        keepFetching = false;
      } else {
        console.log(`[CAPACITY] Found ${issues.length} issues for ${sprintName}`);
        // Attach the sprint name to each issue so we don't have to guess it later from complex fields
        issues.forEach(i => i._sprintName = sprintName);
        allIssues.push(...issues);
        iterationsFound.add(sprintName);
        iterationNum++;
      }
      
      // Safety break to avoid infinite loops
      if (iterationNum > 50) keepFetching = false;
    }

    const members = {};
    const iterations = new Set();

    allIssues.forEach(issue => {
      const assignee = issue.fields.assignee;
      if (!assignee) return;

      const assigneeName = assignee.displayName || assignee.name || 'Unassigned';
      const remainingEstimate = issue.fields.timeestimate || 0; // in seconds

      // Use the attached sprint name
      const sprintName = issue._sprintName;
      if (sprintName) {
        iterations.add(sprintName);
        
        if (!members[assigneeName]) {
          members[assigneeName] = { name: assigneeName, capacity: {} };
        }
        if (!members[assigneeName].capacity[sprintName]) {
          members[assigneeName].capacity[sprintName] = 0;
        }
        members[assigneeName].capacity[sprintName] += remainingEstimate;
      }
    });

    const sortedIterations = Array.from(iterations).sort();
    const membersArray = Object.values(members).sort((a, b) => a.name.localeCompare(b.name));

    // Try to get baseline capacity from Excel
    const excelData = getCapacityFromExcel(pi);

    res.json({
      pi,
      iterations: sortedIterations,
      members: membersArray,
      baselineCapacity: excelData
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch capacity data' });
  }
});

// Config endpoint
app.get('/api/config', (_, res) => res.json({ jiraBaseUrl: JIRA_BASE_URL }));

// Simple health check
app.get('/api/health', (_, res) => res.json({ ok: true }));

// Fallback to index.html for client routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'web', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
