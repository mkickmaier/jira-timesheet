const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Helper function to read secret from file (Podman/Docker secrets)
function readSecret(secretName) {
  const secretPath = `/run/secrets/${secretName}`;
  try {
    if (fs.existsSync(secretPath)) {
      const secret = fs.readFileSync(secretPath, 'utf8').trim();
      if (secret) {
        console.log(`[SECRETS] Loaded ${secretName} from secret file`);
        return secret;
      }
    }
  } catch (err) {
    console.error(`[SECRETS] Error reading secret ${secretName}: ${err.message}`);
  }
  return null;
}

// Load secrets into environment if available
const jiraPat = readSecret('jira_pat');
if (jiraPat) {
  process.env.JIRA_PAT = jiraPat;
}
const express = require('express');
const fetch = require('node-fetch');
const https = require('https');
const multer = require('multer');
const readline = require('readline');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3001;

/**
 * Prompts user for missing configuration and saves it to .env
 */
async function setupConfig() {
  const envPath = path.join(process.pkg ? process.cwd() : path.join(__dirname, '..'), '.env');
  
  // Reload env if file exists (in case it was just created/updated)
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
  }

  let email = process.env.JIRA_EMAIL;
  let pat = process.env.JIRA_PAT;
  let baseUrl = process.env.JIRA_BASE_URL;

  if (email && pat && baseUrl) return;

  console.log('\n--- Jira Time Tracking Setup ---');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (query) => new Promise((resolve) => rl.question(query, resolve));

  if (!baseUrl) {
    baseUrl = await question('Enter Jira Base URL (e.g., https://your-domain.atlassian.net): ');
    process.env.JIRA_BASE_URL = baseUrl;
  }
  if (!email) {
    email = await question('Enter Jira E-Mail: ');
    process.env.JIRA_EMAIL = email;
  }
  if (!pat) {
    pat = await question('Enter Jira PAT (Personal Access Token): ');
    process.env.JIRA_PAT = pat;
  }

  rl.close();

  const envContent = [
    `JIRA_BASE_URL=${baseUrl}`,
    `JIRA_EMAIL=${email}`,
    `JIRA_PAT=${pat}`,
    `JIRA_AUTH_TYPE=bearer`,
    `PORT=${PORT}`,
    `EXTRA_CA_DIR=.\\Frequentis-Certificates`
  ].join('\n');

  try {
    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log(`[CONFIG] Saved configuration to ${envPath}\n`);
  } catch (err) {
    console.error(`[CONFIG] Failed to save .env file: ${err.message}`);
  }
}

async function startServer() {
  await setupConfig();

  // Re-evaluate constants after setup
  const JIRA_BASE_URL = (process.env.JIRA_BASE_URL || '').replace(/\/$/, '');
  const JIRA_EMAIL = process.env.JIRA_EMAIL || '';
  const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || '';
  const JIRA_PAT = process.env.JIRA_PAT || '';
  const JIRA_ACCOUNT_ID = process.env.JIRA_ACCOUNT_ID || '';
  const IS_CLOUD = /\.atlassian\.net$/i.test(JIRA_BASE_URL);
  const JIRA_API_VERSION = process.env.JIRA_API_VERSION || (IS_CLOUD ? '3' : '2');
  const JIRA_AUTH_TYPE = (process.env.JIRA_AUTH_TYPE || (IS_CLOUD ? 'basic' : (JIRA_PAT ? 'bearer' : 'basic'))).toLowerCase();

  app.use(express.json());

// Basic config validation
function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    // console.warn(`[CONFIG] Missing ${name}. Define it in .env`);
  }
  return v;
}

// These are now inside startServer or accessed via process.env directly in routes
function getJiraConfig() {
  const baseUrl = (process.env.JIRA_BASE_URL || '').replace(/\/$/, '');
  const isCloud = /\.atlassian\.net$/i.test(baseUrl);
  const pat = process.env.JIRA_PAT || '';
  const authType = (process.env.JIRA_AUTH_TYPE || (isCloud ? 'basic' : (pat ? 'bearer' : 'basic'))).toLowerCase();
  return {
    baseUrl,
    email: process.env.JIRA_EMAIL || '',
    apiToken: process.env.JIRA_API_TOKEN || '',
    pat,
    accountId: process.env.JIRA_ACCOUNT_ID || '',
    isCloud,
    apiVersion: process.env.JIRA_API_VERSION || (isCloud ? '3' : '2'),
    authType
  };
}

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

// Multer for member pictures
const memberPicStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const baseDir = process.pkg ? process.cwd() : path.join(__dirname, '..');
    const dir = path.join(baseDir, 'uploads', 'members');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const memberName = req.body.memberName || 'unknown';
    const ext = path.extname(file.originalname);
    // Sanitize member name for filename
    const safeName = memberName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    // Use timestamp to ensure unique filename and avoid caching issues on replace
    const timestamp = Date.now();
    cb(null, `${safeName}_${timestamp}${ext}`);
  }
});
const uploadMemberPic = multer({ storage: memberPicStorage });

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
  const config = getJiraConfig();
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };
  if (config.authType === 'bearer') {
    if (!config.pat) console.warn('[CONFIG] Using bearer auth but JIRA_PAT is empty');
    headers['Authorization'] = `Bearer ${config.pat}`;
  } else {
    if (!config.email || !config.apiToken) console.warn('[CONFIG] Using basic auth but JIRA_EMAIL or JIRA_API_TOKEN is empty');
    const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
    headers['Authorization'] = `Basic ${auth}`;
  }
  return headers;
}


// Extract capacity from Planning data
function getCapacityFromPlanning(pi, iterationDates) {
  const data = getPlanningData(pi);
  console.log('[PLANNING] Extracting capacity from planning data:', data);
  if (!data || !data.members || !data.days) return null;

  const types = getPlanningTypes();
  const reductionMap = {};
  types.forEach(t => {
    reductionMap[t.id] = t.reduction !== undefined ? t.reduction : (t.type === 'absence' ? 100 : 0);
  });

  const membersList = data.members;
  const memberSettings = data.memberSettings || {};
  const capacityMap = {}; // { memberName: { iterationName: capacityInSeconds } }
  const dayBreakdown = {}; // { memberName: { iterationName: [{ date, status, reduction, baseHours, actualHours, isContractDay }] } }

  if (iterationDates && Object.keys(iterationDates).length > 0) {
    for (const [itName, dates] of Object.entries(iterationDates)) {
      if (!dates.startDate || !dates.endDate) continue;

      const s = new Date(dates.startDate);
      const e = new Date(dates.endDate);
      s.setHours(0, 0, 0, 0);
      e.setHours(0, 0, 0, 0);

      for (let d = new Date(s); d < e; d.setDate(d.getDate() + 1)) {
        // Use local date components to avoid timezone shifts when generating the date string
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        membersList.forEach(member => {
          if (!capacityMap[member]) capacityMap[member] = {};
          if (!capacityMap[member][itName]) capacityMap[member][itName] = 0;
          if (!dayBreakdown[member]) dayBreakdown[member] = {};
          if (!dayBreakdown[member][itName]) dayBreakdown[member][itName] = [];

          const dayData = (data.days[dateStr] && data.days[dateStr][member]) || 'none';
          const status = (typeof dayData === 'object') ? dayData.status : dayData;
          const settings = memberSettings[member] || { hoursPerDay: 8, availability: 100, workingDays: [1, 2, 3, 4, 5] };
          const isContractDay = settings.workingDays.includes(d.getDay());

          let baseHours = settings.hoursPerDay * (settings.availability / 100);
          let reduction = reductionMap[status] || 0;
          let actualHours = isContractDay ? (baseHours * (1 - (reduction / 100))) : 0;

          capacityMap[member][itName] += Math.round(actualHours * 3600);

          dayBreakdown[member][itName].push({
            date: dateStr,
            status,
            reduction,
            baseHours,
            actualHours,
            isContractDay
          });
        });
      }
    }

    return {
      members: membersList,
      capacity: capacityMap,
      dayBreakdown: dayBreakdown
    };
  }

  // Fallback if no iterationDates provided
  const piName = pi;
  const startStr = data.startDate;
  const endStr = data.endDate;

  if (startStr && endStr) {
    const start = new Date(startStr);
    const end = new Date(endStr);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      // Use local date components to avoid timezone shifts when generating the date string
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const dayCount = Math.floor((d - start) / (24 * 60 * 60 * 1000));
      const itNum = Math.floor(dayCount / 14) + 1;
      const itName = `${piName}_${itNum.toString().padStart(2, '0')}`;

      membersList.forEach(member => {
        if (!capacityMap[member]) capacityMap[member] = {};
        if (!capacityMap[member][itName]) capacityMap[member][itName] = 0;
        if (!dayBreakdown[member]) dayBreakdown[member] = {};
        if (!dayBreakdown[member][itName]) dayBreakdown[member][itName] = [];

        const dayData = (data.days[dateStr] && data.days[dateStr][member]) || 'none';
        const status = (typeof dayData === 'object') ? dayData.status : dayData;
        const settings = memberSettings[member] || { hoursPerDay: 8, availability: 100, workingDays: [1, 2, 3, 4, 5] };
        const isContractDay = settings.workingDays.includes(d.getDay());

        let baseHours = settings.hoursPerDay * (settings.availability / 100);
        let reduction = reductionMap[status] || 0;
        let actualHours = isContractDay ? (baseHours * (1 - (reduction / 100))) : 0;

        capacityMap[member][itName] += Math.round(actualHours * 3600);

        dayBreakdown[member][itName].push({
          date: dateStr,
          status,
          reduction,
          baseHours,
          actualHours,
          isContractDay
        });
      });
    }

    return {
      members: membersList,
      capacity: capacityMap,
      dayBreakdown: dayBreakdown
    };
  }

  // Fallback: If we had a way to map dates to iterations, we could calculate it here.
  // For now, the requirement is "An absence needs also a configuration how much it reduces a team members working hours as percentage."
  // The UI should use this configuration when calculating capacity.

  return null;
}

// Read the permanent member and team configuration
function getPermanentConfig() {
  try {
    const baseDir = process.pkg ? process.cwd() : path.join(__dirname, '..');
    const filePath = path.join(baseDir, 'data', 'member_and_team_config.json');
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) {
    console.error('[CONFIG] Read permanent config error:', e);
  }
  // Default fallback if absolutely nothing exists
  return {
    members: [],
    teams: { 'Unassigned': [] },
    memberSettings: {},
    pictures: {}
  };
}

// Save the permanent member and team configuration
function savePermanentConfig(config) {
  try {
    const baseDir = process.pkg ? process.cwd() : path.join(__dirname, '..');
    const dir = path.join(baseDir, 'data');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, 'member_and_team_config.json');
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('[CONFIG] Save permanent config error:', e);
    return false;
  }
}

function getDailyDataPath() {
  const baseDir = process.pkg ? process.cwd() : path.join(__dirname, '..');
  return path.join(baseDir, 'data', 'daily_data.json');
}

// Clean up days older than 90 days (3 months)
function pruneOldDailyData(days) {
  if (!days) return {};
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  ninetyDaysAgo.setHours(0, 0, 0, 0);

  let prunedCount = 0;
  for (const key of Object.keys(days)) {
    const parts = key.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        const keyDate = new Date(y, m - 1, d);
        if (keyDate < ninetyDaysAgo) {
          delete days[key];
          prunedCount++;
        }
      }
    }
  }
  if (prunedCount > 0) {
    console.log(`[DAILY_DATA] Pruned ${prunedCount} daily status records older than 90 days.`);
  }
  return days;
}

// Read planning JSON file with merged permanent config
function getPlanningData(pi) {
  try {
    const dailyDataPath = getDailyDataPath();
    let fileData = {};
    if (fs.existsSync(dailyDataPath)) {
      fileData = JSON.parse(fs.readFileSync(dailyDataPath, 'utf8'));
    }

    if (fileData.days) {
      fileData.days = pruneOldDailyData(fileData.days);
    }

    const permConfig = getPermanentConfig();

    return {
      pi,
      startDate: fileData.startDate || '',
      endDate: fileData.endDate || '',
      days: fileData.days || {},
      members: permConfig.members || [],
      teams: permConfig.teams || {},
      memberSettings: permConfig.memberSettings || {},
      pictures: permConfig.pictures || {}
    };
  } catch (e) {
    console.error('[PLANNING] Read error:', e);
  }
  return null;
}

// Save planning JSON file splitting details into daily_data and permanent files
function savePlanningData(pi, data) {
  try {
    const baseDir = process.pkg ? process.cwd() : path.join(__dirname, '..');
    const dir = path.join(baseDir, 'data');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Save permanent config fields
    const permConfig = {
      members: data.members || [],
      teams: data.teams || {},
      memberSettings: data.memberSettings || {},
      pictures: data.pictures || {}
    };
    savePermanentConfig(permConfig);

    // Prune before saving daily_data
    let prunedDays = pruneOldDailyData(data.days || {});

    // Save only to the daily_data file
    const dailyData = {
      startDate: data.startDate || '',
      endDate: data.endDate || '',
      days: prunedDays
    };

    const filePath = getDailyDataPath();
    fs.writeFileSync(filePath, JSON.stringify(dailyData, null, 2), 'utf8');
    saveLastPi(pi);
    return true;
  } catch (e) {
    console.error('[PLANNING] Save error:', e);
    return false;
  }
}

// Get/Save last accessed PI
function getLastPi() {
  try {
    const baseDir = process.pkg ? process.cwd() : path.join(__dirname, '..');
    const filePath = path.join(baseDir, 'data', 'last_pi.json');
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return data.pi || '';
    }
  } catch (e) {
    console.error('[PLANNING] Read last PI error:', e);
  }
  return '';
}

function getPlanningTypes() {
  try {
    const baseDir = process.pkg ? process.cwd() : path.join(__dirname, '..');
    const filePath = path.join(baseDir, 'data', 'planning_types.json');
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) {
    console.error('[PLANNING] Read types error:', e);
  }
  // Default types
  return [
    { id: 'none', label: '', color: '#fff', type: 'absence', reduction: 0 },
    { id: 'ooo', label: 'OoO', color: '#7030a0', type: 'absence', reduction: 100 },
    { id: 'urlaub', label: 'Urlaub', color: '#a6a6a6', type: 'absence', reduction: 100 },
    { id: 'feiertag', label: 'Feiertag', color: '#7030a0', type: 'absence', reduction: 100 },
    { id: 'ho', label: 'HO', color: '#92d050', type: 'information', reduction: 0 },
    { id: 'planning', label: 'Planning', color: '#ffff00', type: 'information', reduction: 0 },
    { id: 'sbb', label: 'SBB', color: '#ffccff', type: 'information', reduction: 0 },
    { id: 'rollout', label: 'Rollout', color: '#00b0f0', type: 'information', reduction: 0 },
    { id: 'release', label: 'Release', color: '#00ffff', type: 'information', reduction: 0 },
    { id: 'freetext', label: 'Free Text', color: '#ff9900', type: 'information', reduction: 0 }
  ];
}

function savePlanningTypes(types) {
  try {
    const baseDir = process.pkg ? process.cwd() : path.join(__dirname, '..');
    const dir = path.join(baseDir, 'data');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, 'planning_types.json');
    fs.writeFileSync(filePath, JSON.stringify(types, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('[PLANNING] Save types error:', e);
    return false;
  }
}

function saveLastPi(pi) {
  try {
    const baseDir = process.pkg ? process.cwd() : path.join(__dirname, '..');
    const dir = path.join(baseDir, 'data');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, 'last_pi.json');
    fs.writeFileSync(filePath, JSON.stringify({ pi }, null, 2), 'utf8');
  } catch (e) {
    console.error('[PLANNING] Save last PI error:', e);
  }
}

// Get planning data for a PI
app.get('/api/planning', (req, res) => {
  const { pi } = req.query;
  if (!pi) return res.status(400).json({ error: 'PI name is required' });
  const data = getPlanningData(pi) || { pi, members: [], days: {} };
  saveLastPi(pi);
  res.json(data);
});

// Get the last accessed PI name
app.get('/api/planning/last', (req, res) => {
  const pi = getLastPi();
  res.json({ pi });
});

// Get planning types
app.get('/api/planning/types', (req, res) => {
  res.json(getPlanningTypes());
});

// Save planning types
app.post('/api/planning/types', (req, res) => {
  const types = req.body;
  if (!Array.isArray(types)) return res.status(400).json({ error: 'Types must be an array' });
  if (savePlanningTypes(types)) {
    res.json({ message: 'Types saved successfully' });
  } else {
    res.status(500).json({ error: 'Failed to save types' });
  }
});


// Save planning data for a PI
app.post('/api/planning', (req, res) => {
  const { pi, data } = req.body;
  if (!pi || !data) return res.status(400).json({ error: 'PI and data are required' });
  if (savePlanningData(pi, data)) {
    res.json({ message: 'Planning saved successfully' });
  } else {
    res.status(500).json({ error: 'Failed to save planning' });
  }
});

// Get capacity data for a PI
app.get('/api/capacity', async (req, res) => {
  try {
    const config = getJiraConfig();
    const { pi } = req.query;
    if (!pi) return res.status(400).json({ error: 'PI name is required' });

    // 1. Fetch sprints (iterations) matching the PI name
    // As per requirement, we iterate over sprint names <PI_name>_01, <PI_name>_02...
    // until the query returns no items, because JQL doesn't support placeholders for sprints.
    const allIssues = [];
    const iterationsFound = new Set();
    const iterationDates = {}; // { sprintName: { startDate, endDate } }
    let iterationNum = 1;
    let keepFetching = true;

    while (keepFetching) {
      const sprintName = `${pi}_${String(iterationNum).padStart(2, '0')}`;
      const searchJql = `sprint = "${sprintName}"`;
      // Request *navigable to ensure we get the sprint field regardless of its ID
      const searchUrl = `${config.baseUrl}/rest/api/${config.apiVersion}/search?jql=${encodeURIComponent(searchJql)}&fields=summary,assignee,timeestimate,status,sprint,*navigable&expand=names&maxResults=1000`;
      
      console.log(`[CAPACITY] Fetching Iteration ${iterationNum}: ${sprintName}`);
      const r = await fetchWithAgent(searchUrl, { headers: jiraHeaders() });
      const data = await parseResponse(r);
      
      if (!r.ok) {
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

        // Try to extract dates from any field that looks like a sprint and matches the sprintName
        if (!iterationDates[sprintName]) {
          let sprintInfo = null;
          
          // First, identify the sprint field ID dynamically if not already known
          let sprintFieldId = 'sprint';
          if (data.names) {
            const foundId = Object.keys(data.names).find(key => data.names[key].toLowerCase() === 'sprint');
            if (foundId) sprintFieldId = foundId;
          }

          for (const issue of issues) {
            // Check common fields first
            const potentialFields = [sprintFieldId, 'sprint', 'customfield_10020', 'customfield_10001'];
            
            for (const fId of potentialFields) {
              const val = issue.fields[fId];
              if (!val) continue;

              // Sprint info can be an object, a string, or an array of either
              const arr = Array.isArray(val) ? val : [val];
              for (const item of arr) {
                if (typeof item === 'object' && item !== null) {
                  // Jira Cloud style object
                  // If we have multiple sprints, we MUST match by name if provided
                  if (item.name === sprintName) {
                    if (item.startDate && item.endDate) {
                      sprintInfo = item;
                      break;
                    }
                  } else if (!item.name && item.startDate && item.endDate) {
                    // Fallback if name is missing but dates are present (unlikely in Cloud)
                    sprintInfo = item;
                  }
                } else if (typeof item === 'string') {
                  // Jira On-Premise style string
                  // Example: com.atlassian.greenhopper.service.sprint.Sprint@...[id=1,rapidViewId=1,state=ACTIVE,name=PI_26_06_01,startDate=2026-04-01T12:00:00.000+02:00,endDate=2026-04-15T12:00:00.000+02:00,completeDate=<null>,sequence=1]
                  if (item.includes('name=' + sprintName)) {
                    if (item.includes('startDate=')) {
                      sprintInfo = item;
                      break;
                    }
                  }
                }
              }
              if (sprintInfo) break;
            }
            if (sprintInfo) break;
          }

          if (sprintInfo) {
            if (typeof sprintInfo === 'string') {
              const startMatch = sprintInfo.match(/startDate=([^,\]]+)/);
              const endMatch = sprintInfo.match(/endDate=([^,\]]+)/);
              let sD = startMatch ? startMatch[1] : null;
              let eD = endMatch ? endMatch[1] : null;
              if (sD === '<null>') sD = null;
              if (eD === '<null>') eD = null;
              
              if (sD || eD) {
                iterationDates[sprintName] = { startDate: sD, endDate: eD };
              }
            } else {
              iterationDates[sprintName] = {
                startDate: sprintInfo.startDate,
                endDate: sprintInfo.endDate
              };
            }
            console.log(`[CAPACITY] Extracted dates for ${sprintName}:`, iterationDates[sprintName]);
          } else {
            console.warn(`[CAPACITY] Could not extract dates for sprint ${sprintName} from any issues.`);
          }
        }

        // Attach the sprint name to each issue
        issues.forEach(i => i._sprintName = sprintName);
        allIssues.push(...issues);
        iterationsFound.add(sprintName);
        iterationNum++;
      }
      
      if (iterationNum > 50) keepFetching = false;
    }

    const members = {};
    const iterations = new Set();
    const issueDetails = {}; // { memberName: { iterationName: [{ key, summary, estimate }] } }

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

        if (!issueDetails[assigneeName]) issueDetails[assigneeName] = {};
        if (!issueDetails[assigneeName][sprintName]) issueDetails[assigneeName][sprintName] = [];
        issueDetails[assigneeName][sprintName].push({
          key: issue.key,
          summary: issue.fields.summary,
          estimate: remainingEstimate
        });
      }
    });

    const sortedIterations = Array.from(iterations).sort();
    const membersArray = Object.values(members).sort((a, b) => a.name.localeCompare(b.name));

    // Try to get baseline capacity from Planning JSON
    const baselineData = getCapacityFromPlanning(pi, iterationDates);

    res.json({
      pi,
      iterations: sortedIterations,
      iterationDates,
      members: membersArray,
      baselineCapacity: baselineData,
      issueDetails,
      jiraBaseUrl: config.baseUrl
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch capacity data' });
  }
});

// Health and Config
app.get('/api/config', (_, res) => res.json({ jiraBaseUrl: getJiraConfig().baseUrl }));
app.get('/api/health', (_, res) => res.json({ ok: true }));

// Upload member picture
app.post('/api/planning/member/image', uploadMemberPic.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image file provided' });
  const imageUrl = `/uploads/members/${req.file.filename}`;
  res.json({ imageUrl });
});

// Serve uploads
const uploadsDir = process.pkg ? path.join(process.cwd(), 'uploads') : path.join(__dirname, '..', 'uploads');
app.use('/uploads', express.static(uploadsDir));

// Fallback to index.html for client routes
const webDir = process.pkg ? path.join(__dirname, '..', 'web') : path.join(__dirname, '..', 'web');
app.use(express.static(webDir));
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '..', 'web', 'index.html'));
});

function openBrowser(url) {
  const start = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  exec(`${start} ${url}`);
}

app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Server running on ${url}`);
  openBrowser(url);
});
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
