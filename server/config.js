const fs = require('fs');
const path = require('path');
const readline = require('readline');
const https = require('https');

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

// Load secrets into environment if available on load
const jiraPat = readSecret('jira_pat');
if (jiraPat) {
  process.env.JIRA_PAT = jiraPat;
}

const PORT = process.env.PORT || 3001;

/**
 * Prompts user for missing configuration and saves it to .env
 */
async function setupConfig() {
  const envPath = path.join(__dirname, '..', '.env');

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
    // Reload env variables after write
    require('dotenv').config({ path: envPath });
  } catch (err) {
    console.error(`[CONFIG] Failed to save .env file: ${err.message}`);
  }
}

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
function buildHttpsAgent() {
  const EXTRA_CA_DIR = process.env.EXTRA_CA_DIR || '';
  const NODE_EXTRA_CA_CERTS = process.env.NODE_EXTRA_CA_CERTS || '';
  let caBundle;
  try {
    if (NODE_EXTRA_CA_CERTS) {
      caBundle = fs.readFileSync(NODE_EXTRA_CA_CERTS);
    } else if (EXTRA_CA_DIR) {
      const exts = new Set(['.crt', '.cer', '.pem']);
      if (fs.existsSync(EXTRA_CA_DIR)) {
        const files = fs.readdirSync(EXTRA_CA_DIR)
          .filter(f => exts.has(path.extname(f).toLowerCase()))
          .map(f => path.join(EXTRA_CA_DIR, f));
        if (files.length) {
          caBundle = files.map(f => fs.readFileSync(f)).join('\n');
        }
      }
    }
  } catch (e) {
    console.warn('[TLS] Failed to load EXTRA_CA certs:', e.message);
  }
  return caBundle ? new https.Agent({ ca: caBundle, rejectUnauthorized: true }) : undefined;
}

const httpsAgent = buildHttpsAgent();

module.exports = {
  setupConfig,
  getJiraConfig,
  httpsAgent,
  PORT
};


