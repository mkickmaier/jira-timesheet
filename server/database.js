const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');

// Atomic write helper using temp files and true non-blocking fs.promises to prevent database corruption
class AtomicDatabaseWriter {
  constructor() {
    this.writeQueue = Promise.resolve();
  }

  enqueueWrite(filePath, data) {
    this.writeQueue = this.writeQueue.then(async () => {
      const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
      try {
        await fsPromises.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8');
        await fsPromises.rename(tempPath, filePath);
      } catch (err) {
        console.error('[DATABASE] Atomic file write failed:', err);
        try {
          if (fs.existsSync(tempPath)) {
            await fsPromises.unlink(tempPath);
          }
        } catch (unlinkErr) {}
        throw err;
      }
    });
    return this.writeQueue;
  }
}

const writerInstance = new AtomicDatabaseWriter();

// Read the permanent member and team configuration
function getPermanentConfig() {
  try {
    const baseDir = path.join(__dirname, '..');
    const filePath = path.join(baseDir, 'data', 'member_and_team_config.json');
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) {
    console.error('[CONFIG] Read permanent config error:', e);
  }
  return {
    members: [],
    teams: { 'Unassigned': [] },
    memberSettings: {},
    pictures: {}
  };
}

// Save the permanent member and team configuration using the atomic queue and asynchronous directory creation
async function savePermanentConfig(config) {
  try {
    const baseDir = path.join(__dirname, '..');
    const dir = path.join(baseDir, 'data');
    await fsPromises.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, 'member_and_team_config.json');
    await writerInstance.enqueueWrite(filePath, config);
    return true;
  } catch (e) {
    console.error('[CONFIG] Save permanent config error:', e);
    return false;
  }
}

function getDailyDataPath() {
  const baseDir = path.join(__dirname, '..');
  return path.join(baseDir, 'data', 'daily_data.json');
}

// Clean up days older than 365 days (1 year)
function pruneOldDailyData(days) {
  if (!days) return {};
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 365);
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
    console.log(`[DAILY_DATA] Pruned ${prunedCount} daily status records older than 1 year.`);
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

// Circular dependency backup helper loading
let createBackupFn = null;
function registerBackupCallback(fn) {
  createBackupFn = fn;
}

// Save planning JSON file splitting details into daily_data and permanent files using asynchronous file operations
async function savePlanningData(pi, data) {
  try {
    const baseDir = path.join(__dirname, '..');
    const dir = path.join(baseDir, 'data');
    await fsPromises.mkdir(dir, { recursive: true });

    // Save permanent config fields
    const permConfig = {
      members: data.members || [],
      teams: data.teams || {},
      memberSettings: data.memberSettings || {},
      pictures: data.pictures || {}
    };
    await savePermanentConfig(permConfig);

    // Prune before saving daily_data
    let prunedDays = pruneOldDailyData(data.days || {});

    // Save only to the daily_data file
    const dailyData = {
      startDate: data.startDate || '',
      endDate: data.endDate || '',
      days: prunedDays
    };

    const filePath = getDailyDataPath();
    await writerInstance.enqueueWrite(filePath, dailyData);
    saveLastPi(pi);

    if (createBackupFn) {
      createBackupFn(false);
    }
    return true;
  } catch (e) {
    console.error('[PLANNING] Save error:', e);
    return false;
  }
}

// Get/Save last accessed PI
function getLastPi() {
  try {
    const baseDir = path.join(__dirname, '..');
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

async function saveLastPi(pi) {
  try {
    const baseDir = path.join(__dirname, '..');
    const dir = path.join(baseDir, 'data');
    await fsPromises.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, 'last_pi.json');
    await writerInstance.enqueueWrite(filePath, { pi });
  } catch (e) {
    console.error('[PLANNING] Save last PI error:', e);
  }
}

function getPlanningTypes() {
  try {
    const baseDir = path.join(__dirname, '..');
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

async function savePlanningTypes(types) {
  try {
    const baseDir = path.join(__dirname, '..');
    const dir = path.join(baseDir, 'data');
    await fsPromises.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, 'planning_types.json');
    await writerInstance.enqueueWrite(filePath, types);
    if (createBackupFn) {
      createBackupFn(false);
    }
    return true;
  } catch (e) {
    console.error('[PLANNING] Save types error:', e);
    return false;
  }
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

          let morningStatus = 'none';
          let afternoonStatus = 'none';
          if (typeof dayData === 'object' && dayData !== null) {
            if (dayData.morningStatus || dayData.afternoonStatus) {
              morningStatus = dayData.morningStatus || 'none';
              afternoonStatus = dayData.afternoonStatus || 'none';
            } else {
              morningStatus = dayData.status || 'none';
              afternoonStatus = dayData.status || 'none';
            }
          } else {
            morningStatus = dayData || 'none';
            afternoonStatus = dayData || 'none';
          }

          let statusText = 'none';
          if (morningStatus === afternoonStatus) {
            statusText = morningStatus;
          } else {
            const amText = morningStatus === 'none' ? '-' : morningStatus;
            const pmText = afternoonStatus === 'none' ? '-' : afternoonStatus;
            statusText = `AM: ${amText}, PM: ${pmText}`;
          }

          const settings = memberSettings[member] || { hoursPerDay: 8, availability: 100, workingDays: [1, 2, 3, 4, 5] };
          const isContractDay = settings.workingDays.includes(d.getDay());

          let baseHours = settings.hoursPerDay * (settings.availability / 100);
          let reductionAM = reductionMap[morningStatus] || 0;
          let reductionPM = reductionMap[afternoonStatus] || 0;
          let reduction = (reductionAM + reductionPM) / 2;
          let actualHours = isContractDay ? (baseHours * (1 - (reduction / 100))) : 0;

          capacityMap[member][itName] += Math.round(actualHours * 3600);

          dayBreakdown[member][itName].push({
            date: dateStr,
            status: statusText,
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

        let morningStatus = 'none';
        let afternoonStatus = 'none';
        if (typeof dayData === 'object' && dayData !== null) {
          if (dayData.morningStatus || dayData.afternoonStatus) {
            morningStatus = dayData.morningStatus || 'none';
            afternoonStatus = dayData.afternoonStatus || 'none';
          } else {
            morningStatus = dayData.status || 'none';
            afternoonStatus = dayData.status || 'none';
          }
        } else {
          morningStatus = dayData || 'none';
          afternoonStatus = dayData || 'none';
        }

        let statusText = 'none';
        if (morningStatus === afternoonStatus) {
          statusText = morningStatus;
        } else {
          const amText = morningStatus === 'none' ? '-' : morningStatus;
          const pmText = afternoonStatus === 'none' ? '-' : afternoonStatus;
          statusText = `AM: ${amText}, PM: ${pmText}`;
        }

        const settings = memberSettings[member] || { hoursPerDay: 8, availability: 100, workingDays: [1, 2, 3, 4, 5] };
        const isContractDay = settings.workingDays.includes(d.getDay());

        let baseHours = settings.hoursPerDay * (settings.availability / 100);
        let reductionAM = reductionMap[morningStatus] || 0;
        let reductionPM = reductionMap[afternoonStatus] || 0;
        let reduction = (reductionAM + reductionPM) / 2;
        let actualHours = isContractDay ? (baseHours * (1 - (reduction / 100))) : 0;

        capacityMap[member][itName] += Math.round(actualHours * 3600);

        dayBreakdown[member][itName].push({
          date: dateStr,
          status: statusText,
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

  return null;
}

module.exports = {
  getPermanentConfig,
  savePermanentConfig,
  getPlanningData,
  savePlanningData,
  getLastPi,
  saveLastPi,
  getPlanningTypes,
  savePlanningTypes,
  getCapacityFromPlanning,
  registerBackupCallback
};
