const XLSX = require('xlsx');
const database = require('./database');

const MEMBER_ALIASES = {
  "andreas": "GANAUS Andreas",
  "nico": "Nico",
  "leo": "ZECK Leonhard Otto",
  "fischer leo": "ZECK Leonhard Otto",
  "lukas": "GSCHOSSMANN Lukas",
  "markus": "SCHNEEWEISS Markus",
  "michael": "RAMEDER Michael",
  "robert": "SCHUSTER Robert",
  "tobit": "MOOSBRUGGER Tobit Ruedi",
  "axel": "SCHNUR Axel",
  "thomas": "PISCHINGER Thomas",
  "ante": "SAMARDZIC Ante",
  "katherine": "VIVAS MORENO Katherine",
  "katherine ": "VIVAS MORENO Katherine",
  "patrick": "KOBLISCHEK Patrick",
  "sandra": "SCHACHINGER Sandra",
  "willi": "KANG Willi",
  "markus k": "KICKMAIER Markus (external)",
  "markus k.": "KICKMAIER Markus (external)",
  "peter": "BRTAN Peter (external)",
  "benjamin": "BLUMAUER Benjamin"
};

function getWeekNumber(d) {
  const dateCopy = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  dateCopy.setUTCDate(dateCopy.getUTCDate() + 4 - (dateCopy.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(dateCopy.getUTCFullYear(), 0, 1));
  return Math.ceil((((dateCopy - yearStart) / 86400000) + 1) / 7);
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dateVal = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dateVal}`;
}

function findMatchingMemberName(excelName, dbMembers) {
  if (!excelName || typeof excelName !== 'string') return null;
  const lowerExcel = excelName.toLowerCase().replace(/[^a-z0-9]/gi, ' ').trim();

  // Exact match first
  for (const dbMember of dbMembers) {
    if (dbMember.toLowerCase() === excelName.toLowerCase()) {
      return dbMember;
    }
  }

  // Check alias map
  const aliasMatched = MEMBER_ALIASES[lowerExcel];
  if (aliasMatched && dbMembers.includes(aliasMatched)) {
    return aliasMatched;
  }

  // Smart word-matching fallback
  const excelWords = lowerExcel.split(/\s+/).filter(w => w.length > 0);
  if (excelWords.length === 0) return null;

  let bestMember = null;
  let highestScore = 0;

  for (const dbMember of dbMembers) {
    const dbClean = dbMember.toLowerCase().replace(/[^a-z0-9]/gi, ' ').trim();
    const dbWords = dbClean.split(/\s+/).filter(w => w.length > 0);

    let score = 0;
    excelWords.forEach(w => {
      if (dbWords.includes(w)) {
        score += 10;
      } else if (dbWords.some(dbW => dbW.startsWith(w) || w.startsWith(dbW))) {
        score += 5;
      }
    });

    if (score > highestScore) {
      highestScore = score;
      bestMember = dbMember;
    }
  }

  if (highestScore >= 10) { // Require at least one exact word match to be safe
    return bestMember;
  }

  return null;
}

function parseExcelDateCell(cell) {
  if (!cell) return null;
  if (cell.t === 'd' || cell.v instanceof Date) {
    return formatDate(cell.v);
  }
  if (typeof cell.v === 'number') {
    const serial = cell.v;
    const date = new Date((serial - 25569) * 86400 * 1000);
    const utcDate = new Date(date.getTime() + date.getTimezoneOffset() * 60 * 1000);
    return formatDate(utcDate);
  }
  if (typeof cell.v === 'string') {
    const s = cell.v.trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (m) {
      return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) return formatDate(d);
  }
  return null;
}

function exportExcel(pi, startDate, endDate, filterEvent, res) {
  const currentPlanning = database.getPlanningData(pi);
  if (!currentPlanning) {
    return res.status(404).json({ error: 'Planning not found for PI ' + pi });
  }

  try {
    const resourcesRows = [];

    // Rows 1-10 are empty rows (matching index template spacing)
    for (let i = 0; i < 10; i++) {
      resourcesRows.push([]);
    }

    // Label group headers around row index 9 (Excel row 10)
    resourcesRows[9] = [];
    resourcesRows[9][3] = 'MILESTONES';
    resourcesRows[9][6] = 'ENGINEERING';

    const types = database.getPlanningTypes();
    const typeIdToLabel = {};
    types.forEach(t => {
      typeIdToLabel[t.id] = t.label;
    });

    const getDayStatuses = (dayData) => {
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
      return { morningStatus, afternoonStatus };
    };

    // Date range defaulting and parsing (match frontend)
    const defaultStart = new Date();
    const defaultEnd = new Date();
    defaultEnd.setMonth(defaultStart.getMonth() + 3);

    const filterStartDate = startDate || currentPlanning.startDate || formatDate(defaultStart);
    const filterEndDate = endDate || currentPlanning.endDate || formatDate(defaultEnd);
    const filter = filterEvent || 'all';

    const start = new Date(filterStartDate);
    const end = new Date(filterEndDate);

    // Build filtered and ordered member list matching frontend logic
    const sortedTeams = Object.keys(currentPlanning.teams).sort((a, b) => {
      if (a === 'Unassigned') return 1;
      if (b === 'Unassigned') return -1;
      return a.localeCompare(b);
    });

    const allMembers = currentPlanning.members || [];
    const memberListOrdered = [];

    const hasSelectedEvent = (m) => {
      if (filter === 'all') return true;
      for (let tempD = new Date(start); tempD <= end; tempD.setDate(tempD.getDate() + 1)) {
        const dateStr = formatDate(tempD);
        const dayData = (currentPlanning.days[dateStr] && currentPlanning.days[dateStr][m]);
        if (dayData) {
          const { morningStatus, afternoonStatus } = getDayStatuses(dayData);
          const status = (typeof dayData === 'object') ? dayData.status : dayData;
          if (status === filter || morningStatus === filter || afternoonStatus === filter) {
            return true;
          }
        }
      }
      return false;
    };

    sortedTeams.forEach(teamName => {
      const teamMembers = currentPlanning.teams[teamName] || [];
      teamMembers.sort().forEach(m => {
        if (allMembers.includes(m) && hasSelectedEvent(m)) {
          memberListOrdered.push(m);
        }
      });
    });

    allMembers.forEach(m => {
      if (!memberListOrdered.includes(m) && hasSelectedEvent(m)) {
        memberListOrdered.push(m);
      }
    });

    // Header defining Column names (Excel row 11) - uses only filtered members
    const headerRow = ['KW', 'Datum', 'PI', 'MS1', 'MS2', ''];
    memberListOrdered.forEach(member => {
      headerRow.push(member);
      headerRow.push(''); // Reserved for afternoon PM
    });
    resourcesRows[10] = headerRow;

    // Date range traversal
    let currentWeekNum = -1;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = formatDate(d);

      // Filter dates that have the filtered event (if not 'all')
      const dateHasEvent = () => {
        if (filter === 'all') return true;
        return memberListOrdered.some(member => {
          const dayData = (currentPlanning.days[dateStr] && currentPlanning.days[dateStr][member]);
          if (dayData) {
            const { morningStatus, afternoonStatus } = getDayStatuses(dayData);
            const status = (typeof dayData === 'object') ? dayData.status : dayData;
            return (status === filter || morningStatus === filter || afternoonStatus === filter);
          }
          return false;
        });
      };

      if (!dateHasEvent()) {
        continue;
      }

      const row = [];

      // Calendar Week (AM Column)
      const weekNum = getWeekNumber(d);
      if (weekNum !== currentWeekNum) {
        row.push(`KW ${weekNum}`);
        currentWeekNum = weekNum;
      } else {
        row.push('');
      }

      // Datum column
      row.push(dateStr);
      // PI column
      row.push(pi);
      // MS1, MS2, Placeholder
      row.push('');
      row.push('');
      row.push('');

      // Statuses per member (AM/PM)
      memberListOrdered.forEach(member => {
        const dayData = currentPlanning.days[dateStr] ? currentPlanning.days[dateStr][member] : null;
        let amStr = '';
        let pmStr = '';

        if (dayData) {
          if (typeof dayData === 'string') {
            const lbl = typeIdToLabel[dayData] || dayData;
            amStr = lbl !== 'none' && lbl !== '' ? lbl : '';
            pmStr = amStr;
          } else if (typeof dayData === 'object') {
            const { morningStatus: mS, afternoonStatus: aS } = getDayStatuses(dayData);

            if (mS === 'freetext') amStr = dayData.freetext || '';
            else amStr = (typeIdToLabel[mS] || mS) !== 'none' ? (typeIdToLabel[mS] || mS) : '';

            if (aS === 'freetext') pmStr = dayData.freetext || '';
            else pmStr = (typeIdToLabel[aS] || aS) !== 'none' ? (typeIdToLabel[aS] || aS) : '';
          }
        }
        row.push(amStr);
        row.push(pmStr);
      });

      resourcesRows.push(row);
    }

    // Build Legend sheet
    const legendRows = [['ID/Code', 'Label', 'Type', 'Reduction (%)', 'Color']];
    types.forEach(t => {
      legendRows.push([t.id, t.label, t.type, t.reduction !== undefined ? t.reduction : 100, t.color]);
    });

    // Build PI Planning sheet using only filtered members
    const piPlanungRows = [
      [`Planning for ${pi}`],
      [],
      ['Member', 'Teams', 'Hours Per Day', 'Availability (%)', 'Working Days']
    ];
    memberListOrdered.forEach(m => {
      const settings = currentPlanning.memberSettings[m] || { hoursPerDay: 8, availability: 100, workingDays: [1,2,3,4,5] };
      const teamNames = Object.entries(currentPlanning.teams)
        .filter(([tName, members]) => members.includes(m))
        .map(([tName]) => tName)
        .join(', ');

      piPlanungRows.push([
        m,
        teamNames,
        settings.hoursPerDay,
        settings.availability,
        settings.workingDays.map(dayIdx => ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][dayIdx]).join(', ')
      ]);
    });

    // Create workbook and write out
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(resourcesRows);
    const legendWs = XLSX.utils.aoa_to_sheet(legendRows);
    const piPlanungWs = XLSX.utils.aoa_to_sheet(piPlanungRows);

    XLSX.utils.book_append_sheet(wb, ws, 'Ressourcen');
    XLSX.utils.book_append_sheet(wb, legendWs, 'Legende');
    XLSX.utils.book_append_sheet(wb, piPlanungWs, 'PI_Planung');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', `attachment; filename=SBB_Planning_${pi}_${formatDate(new Date())}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.end(buf);

  } catch (err) {
    console.error('[EXPORT_EXCEL] Error creating excel:', err);
    res.status(500).json({ error: 'Failed to generate Excel file: ' + err.message });
  }
}

async function importExcel(pi, fileBuffer, res) {
  try {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });

    // Find the 'Ressourcen' sheet
    let sheetName = workbook.SheetNames.find(name => name.toLowerCase() === 'ressourcen');
    if (!sheetName) {
      sheetName = workbook.SheetNames[0]; // fallback to first sheet
    }
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Find the header row (has 'Datum' or 'datum' in the first few columns)
    let headerRowIdx = -1;
    for (let r = 0; r < Math.min(rows.length, 30); r++) {
      const row = rows[r];
      if (row && row.some(cell => typeof cell === 'string' && cell.toLowerCase() === 'datum')) {
        headerRowIdx = r;
        break;
      }
    }

    if (headerRowIdx === -1) {
      return res.status(400).json({ error: 'Could not find the header row containing "Datum" in the spreadsheet' });
    }

    const headerRow = rows[headerRowIdx];

    // Identify the active planning data of this PI
    const currentPlanning = database.getPlanningData(pi);
    if (!currentPlanning) {
      return res.status(404).json({ error: 'Planning not found for PI ' + pi });
    }

    // Create a copy of current days to update
    const updatedDays = { ...(currentPlanning.days || {}) };
    const dbMembers = [...(currentPlanning.members || [])];

    // Map column index to member name
    // Format: { amColIndex: { memberName, part: 'morning' }, pmColIndex: { memberName, part: 'afternoon' } }
    const colToMemberMap = {};

    for (let c = 6; c < headerRow.length; c++) {
      const cellVal = headerRow[c];
      if (cellVal && typeof cellVal === 'string' && cellVal.trim() !== '') {
        const memberName = cellVal.trim();
        let matchedMemberName = findMatchingMemberName(memberName, dbMembers);

        // If not matching, import ALL data anyway by automatically adding the member into 'Unassigned'
        if (!matchedMemberName) {
          matchedMemberName = memberName;
          dbMembers.push(matchedMemberName);
          if (!currentPlanning.teams) currentPlanning.teams = {};
          if (!currentPlanning.teams['Unassigned']) {
            currentPlanning.teams['Unassigned'] = [];
          }
          currentPlanning.teams['Unassigned'].push(matchedMemberName);
          console.log(`[IMPORT] Automatically added new excel member "${matchedMemberName}" to Unassigned team`);
        }

        colToMemberMap[c] = { memberName: matchedMemberName, part: 'morning' };
        colToMemberMap[c + 1] = { memberName: matchedMemberName, part: 'afternoon' };
        c++; // skip next column as it's the PM-half
      }
    }

    // Define planning types lookup (labels to IDs)
    const types = database.getPlanningTypes();
    const labelToTypeId = {};
    types.forEach(t => {
      if (t.label) {
        labelToTypeId[t.label.toLowerCase().trim()] = t.id;
      }
      labelToTypeId[t.id.toLowerCase().trim()] = t.id; // also map type ID itself
    });
    labelToTypeId[''] = 'none';
    labelToTypeId['none'] = 'none';
    labelToTypeId['available'] = 'none';

    // Helper to map cell string value to Planning Type ID & Free text
    function parseStatusValue(val) {
      if (val === undefined || val === null || String(val).trim() === '') {
        return { status: 'none', freetext: null };
      }

      const sVal = String(val).trim();
      const lower = sVal.toLowerCase();

      if (labelToTypeId[lower]) {
        return { status: labelToTypeId[lower], freetext: null };
      }

      // If it doesn't match a standard label/ID, treat as free text
      return { status: 'freetext', freetext: sVal };
    }

    // Traverse data rows
    let lastSeenDateStr = null;
    let recordsUpdated = 0;

    for (let r = headerRowIdx + 1; r < rows.length; r++) {
      const dateCellRef = XLSX.utils.encode_cell({ r, c: 1 });
      const dateCell = sheet[dateCellRef];
      let rowDateStr = null;
      if (dateCell) {
        rowDateStr = parseExcelDateCell(dateCell);
      }

      if (rowDateStr) {
        lastSeenDateStr = rowDateStr;
      }

      if (!lastSeenDateStr) continue;

      if (!updatedDays[lastSeenDateStr]) {
        updatedDays[lastSeenDateStr] = {};
      }

      const row = rows[r] || [];
      let updatedThisRow = false;

      Object.entries(colToMemberMap).forEach(([colIdxStr, { memberName, part }]) => {
        const colIdx = parseInt(colIdxStr, 10);
        const cellValue = row[colIdx];

        // Only update if there is a cell value on this row
        if (cellValue !== undefined) {
          const { status, freetext } = parseStatusValue(cellValue);

          let dayData = updatedDays[lastSeenDateStr][memberName];
          if (typeof dayData !== 'object' || dayData === null) {
            dayData = { status: dayData || 'none' };
          }

          if (part === 'morning') {
            dayData.morningStatus = status;
            if (status === 'freetext') dayData.freetext = freetext;
            else delete dayData.freetext;
          } else {
            dayData.afternoonStatus = status;
            if (status === 'freetext') dayData.freetext = freetext;
            else delete dayData.freetext;
          }

          // Compute overall status
          if (dayData.morningStatus === dayData.afternoonStatus) {
            dayData.status = dayData.morningStatus;
          } else {
            dayData.status = 'none'; // mixed morning/afternoon
          }

          updatedDays[lastSeenDateStr][memberName] = dayData;
          updatedThisRow = true;
        }
      });

      if (updatedThisRow) {
        recordsUpdated++;
      }
    }

    // Save and reload
    currentPlanning.days = updatedDays;
    currentPlanning.members = dbMembers; // Keep updated list with new members!
    await database.savePlanningData(pi, currentPlanning);

    res.json({ message: 'Success', updatedPlanning: currentPlanning });

  } catch (err) {
    console.error('[IMPORT_EXCEL] Error parsing excel:', err);
    res.status(500).json({ error: 'Failed to parse Excel file: ' + err.message });
  }
}

module.exports = {
  exportExcel,
  importExcel,
  findMatchingMemberName,
  getWeekNumber,
  formatDate
};

