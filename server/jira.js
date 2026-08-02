const fetch = require('node-fetch');
const configModule = require('./config');
const database = require('./database');

function jiraHeaders() {
  const config = configModule.getJiraConfig();
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };
  if (config.authType === 'bearer') {
    if (!config.pat) console.warn('[CONFIG] Using bearer auth but JIRA_PAT is empty');
    headers['Authorization'] = `Bearer ${config.pat}`;
  } else {
    // If apiToken is empty but JIRA_PAT exists, it can use the basic auth format with email + API token or fallback.
    // The previous implementation used config.email and config.apiToken for basic, config.pat for bear.
    const token = config.apiToken || config.pat;
    if (!config.email || !token) console.warn('[CONFIG] Using basic auth but JIRA_EMAIL or JIRA_API_TOKEN is empty');
    const auth = Buffer.from(`${config.email}:${token}`).toString('base64');
    headers['Authorization'] = `Basic ${auth}`;
  }
  return headers;
}

function fetchWithAgent(url, options = {}) {
  const opts = { ...options };
  const agent = configModule.getHttpsAgent();
  if (agent && !opts.agent) opts.agent = agent;
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

async function getCapacityData(pi) {
  const config = configModule.getJiraConfig();

  // Parallel fetch up to 10 iterations to optimize API latency
  const maxIterations = 10;
  const iterationNumbers = Array.from({ length: maxIterations }, (_, i) => i + 1);

  const allIssues = [];
  const iterationsFound = new Set();
  const iterationDates = {}; // { sprintName: { startDate, endDate } }

  // Pre-fetch all sprint dates from the board API if JIRA_BOARD_ID is configured
  if (config.boardId) {
    console.log(`[CAPACITY] Fetching sprint dates from board ${config.boardId}`);
    try {
      let startAt = 0;
      const pageSize = 50;
      let isLast = false;
      while (!isLast) {
        const boardUrl = `${config.baseUrl}/rest/agile/1.0/board/${config.boardId}/sprint?startAt=${startAt}&maxResults=${pageSize}`;
        const br = await fetchWithAgent(boardUrl, { headers: jiraHeaders() });
        if (!br.ok) {
          console.warn(`[CAPACITY] Board sprint fetch failed with status ${br.status} — falling back to issue-based date extraction`);
          break;
        }
        const boardData = await parseResponse(br);
        const sprints = boardData.values || [];
        for (const sprint of sprints) {
          if (sprint.name && sprint.name.startsWith(pi + '_')) {
            if (sprint.startDate || sprint.endDate) {
              iterationDates[sprint.name] = { startDate: sprint.startDate || null, endDate: sprint.endDate || null };
              console.log(`[CAPACITY] Board API: dates for ${sprint.name}:`, iterationDates[sprint.name]);
            }
          }
        }
        isLast = boardData.isLast !== false ? true : (startAt + pageSize >= boardData.total);
        startAt += pageSize;
        if (sprints.length < pageSize) break;
      }
    } catch (e) {
      console.warn(`[CAPACITY] Board sprint fetch failed unexpectedly:`, e.message);
    }
  } else {
    console.log(`[CAPACITY] No JIRA_BOARD_ID set — sprint dates will be extracted from issue fields only`);
  }

  console.log(`[CAPACITY] Initiating parallel fetch for ${pi} (sprints 01 to ${maxIterations})`);

  const fetchPromises = iterationNumbers.map(async (num) => {
    const sprintName = `${pi}_${String(num).padStart(2, '0')}`;
    const searchJql = `sprint = "${sprintName}"`;
    const searchUrl = `${config.baseUrl}/rest/api/${config.apiVersion}/search?jql=${encodeURIComponent(searchJql)}&fields=summary,assignee,timeestimate,status,sprint,*navigable&expand=names&maxResults=1000`;

    try {
      const r = await fetchWithAgent(searchUrl, { headers: jiraHeaders() });
      const data = await parseResponse(r);

      if (!r.ok) {
        console.warn(`[CAPACITY] Parsing sprint ${sprintName} failed with status ${r.status}:`, data.errorMessages || data.message);
        return { sprintName, success: false };
      }

      const issues = data.issues || [];
      if (issues.length === 0) {
        return { sprintName, success: true, issues: [] };
      }

      // Try extract dates from any field that looks like a sprint and matches the sprintName
      let sprintInfo = null;
      let sprintFieldId = 'sprint';
      if (data.names) {
        const foundId = Object.keys(data.names).find(key => data.names[key].toLowerCase() === 'sprint');
        if (foundId) sprintFieldId = foundId;
      }

      for (const issue of issues) {
        const potentialFields = [sprintFieldId, 'sprint', 'customfield_10020', 'customfield_10001'];
        for (const fId of potentialFields) {
          const val = issue.fields[fId];
          if (!val) continue;

          const arr = Array.isArray(val) ? val : [val];
          for (const item of arr) {
            if (typeof item === 'object' && item !== null) {
              if (item.name === sprintName) {
                // Accept partial dates — capture whatever Jira has set
                if (item.startDate || item.endDate) {
                  sprintInfo = item;
                  break;
                }
              } else if (!item.name && (item.startDate || item.endDate)) {
                sprintInfo = item;
              }
            } else if (typeof item === 'string') {
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

      let dates = null;
      if (sprintInfo) {
        if (typeof sprintInfo === 'string') {
          const startMatch = sprintInfo.match(/startDate=([^,\]]+)/);
          const endMatch = sprintInfo.match(/endDate=([^,\]]+)/);
          let sD = startMatch ? startMatch[1] : null;
          let eD = endMatch ? endMatch[1] : null;
          if (sD === '<null>') sD = null;
          if (eD === '<null>') eD = null;

          if (sD || eD) {
            dates = { startDate: sD, endDate: eD };
          }
        } else {
          dates = {
            startDate: sprintInfo.startDate,
            endDate: sprintInfo.endDate
          };
        }
      }

      return { sprintName, success: true, issues, dates };
    } catch (err) {
      console.error(`[CAPACITY] Failed to fetch sprint ${sprintName} due to unexpected error:`, err.message);
      return { sprintName, success: false };
    }
  });

  const responses = await Promise.all(fetchPromises);

  // Group responses in numerical order to maintain consistency
  responses.forEach(res => {
    if (!res.success || !res.issues) return;
    const sprintName = res.sprintName;
    // A 200 OK with 0 issues means the sprint exists but is empty — still mark it found
    iterationsFound.add(sprintName);
    if (res.dates) {
      iterationDates[sprintName] = res.dates;
      console.log(`[CAPACITY] Extracted dates for ${sprintName}:`, res.dates);
    }
    if (res.issues.length > 0) {
      res.issues.forEach(i => i._sprintName = sprintName);
      allIssues.push(...res.issues);
    }
  });

  const members = {};
  const iterations = new Set();
  const issueDetails = {}; // { memberName: { iterationName: [{ key, summary, estimate }] } }

  allIssues.forEach(issue => {
    const assignee = issue.fields.assignee;
    if (!assignee) return;

    const assigneeName = assignee.displayName || assignee.name || 'Unassigned';
    const remainingEstimate = issue.fields.timeestimate || 0; // in seconds
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

  // Also include sprints that had issues but none were assigned
  iterationsFound.forEach(s => iterations.add(s));
  const sortedIterations = Array.from(iterations).sort();
  const baselineData = database.getCapacityFromPlanning(pi, iterationDates);

  // Supplement members from planning baseline so people with no Jira tickets yet are still shown
  if (baselineData && baselineData.capacity) {
    for (const memberName of Object.keys(baselineData.capacity)) {
      if (memberName === 'Milestones') continue;
      if (!members[memberName]) {
        members[memberName] = { name: memberName, capacity: {} };
      }
    }
  }
  const membersArray = Object.values(members).sort((a, b) => a.name.localeCompare(b.name));

  return {
    pi,
    iterations: sortedIterations,
    iterationDates,
    members: membersArray,
    baselineCapacity: baselineData,
    issueDetails,
    jiraBaseUrl: config.baseUrl
  };
}

module.exports = {
  getCapacityData,
  fetchWithAgent,
  jiraHeaders
};

