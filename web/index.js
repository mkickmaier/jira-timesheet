function toggleCard() {
  const content = document.getElementById('cardContent');
  const icon = document.getElementById('toggleIcon');
  content.classList.toggle('collapsed');
  icon.classList.toggle('collapsed');
}
const piNameInput = document.getElementById('piName');
const loadBtn = document.getElementById('loadBtn');
const exportExcelBtn = document.getElementById('exportExcelBtn');
const importExcelBtn = document.getElementById('importExcelBtn');
const excelFileInput = document.getElementById('excelFileInput');
const addMemberBtn = document.getElementById('addMemberBtn');
const memberInput = document.getElementById('memberInput');
const teamSelect = document.getElementById('teamSelect');
const addTeamBtn = document.getElementById('addTeamBtn');
const newTeamInput = document.getElementById('newTeamInput');
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const statusMsg = document.getElementById('statusMsg');
const planningCard = document.getElementById('planningCard');
const tableHeader = document.getElementById('tableHeader');
const tableBody = document.getElementById('tableBody');
const statusLegend = document.getElementById('statusLegend');
const editInfoReadiness = document.getElementById('editInfoReadiness');
const editInfoPlace = document.getElementById('editInfoPlace');
const editInfoMemberSpan = document.getElementById('editInfoMember');
const saveEditBoxBtn = document.getElementById('saveEditBox');
const closeEditBoxBtn = document.getElementById('closeEditBox');
const contextMenu = document.getElementById('contextMenu');
const eventTypeFilter = document.getElementById('eventTypeFilter');

function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
  return weekNo;
}

function formatDateLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDayStatuses(dayData) {
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
}

function isCellNotEmpty(dateStr, member) {
  if (!currentPlanning.days || !currentPlanning.days[dateStr]) return false;
  const dayData = currentPlanning.days[dateStr][member];
  if (!dayData) return false;

  if (typeof dayData === 'string') {
    return dayData !== 'none';
  }

  if (typeof dayData === 'object') {
    const status = dayData.status || 'none';
    const mS = dayData.morningStatus || 'none';
    const aS = dayData.afternoonStatus || 'none';
    const hasStatus = (status !== 'none' || mS !== 'none' || aS !== 'none');
    const hasReadiness = !!dayData.readiness;
    const hasPlace = !!dayData.place;
    const hasFreetext = !!dayData.freetext;
    return hasStatus || hasReadiness || hasPlace || hasFreetext;
  }

  return false;
}

let currentPlanning = { pi: '', members: [], teams: {}, days: {}, pictures: {}, memberSettings: {} };
let selectedStatus = 'none';
let selectedDayPart = 'full';
let saveTimeout;
let currentMemberForImage = null;
let currentMemberForSettings = null;

const memberSettingsModal = document.getElementById('memberSettingsModal');
const memberHoursPerDayInput = document.getElementById('memberHoursPerDay');
const memberPlanningAvailabilityInput = document.getElementById('memberPlanningAvailability');
const saveMemberSettingsBtn = document.getElementById('saveMemberSettingsBtn');
const cancelMemberSettingsBtn = document.getElementById('cancelMemberSettingsBtn');
const memberSettingsTitle = document.getElementById('memberSettingsTitle');
const deleteMemberBtn = document.getElementById('deleteMemberBtn');
const deleteMemberNameConfirm = document.getElementById('deleteMemberNameConfirm');

let planningTypes = [];
const typeEditorModal = document.getElementById('typeEditorModal');
const modalOverlay = document.getElementById('modalOverlay');
const typeIdInput = document.getElementById('typeId');
const typeLabelInput = document.getElementById('typeLabel');
const typeColorInput = document.getElementById('typeColor');
const typeColorPicker = document.getElementById('typeColorPicker');
const typeKindSelect = document.getElementById('typeKind');
const typeReductionInput = document.getElementById('typeReduction');
const reductionContainer = document.getElementById('reductionContainer');
const saveTypeBtn = document.getElementById('saveTypeBtn');
const cancelTypeBtn = document.getElementById('cancelTypeBtn');
const addTypeBtn = document.getElementById('addTypeBtn');
const deleteTypeBtn = document.getElementById('deleteTypeBtn');
const typeEditorTitle = document.getElementById('typeEditorTitle');

let editingTypeId = null;

// History & Backups Modal Elements
const historyModal = document.getElementById('historyModal');
const openHistoryBtn = document.getElementById('openHistoryBtn');
const closeHistoryModalBtn = document.getElementById('closeHistoryModalBtn');
const backupTableBody = document.getElementById('backupTableBody');
const manualBackupLabel = document.getElementById('manualBackupLabel');
const createManualBackupBtn = document.getElementById('createManualBackupBtn');

openHistoryBtn.onclick = () => {
  showHistoryModal();
};

closeHistoryModalBtn.onclick = () => {
  closeHistoryModal();
};

createManualBackupBtn.onclick = () => {
  createManualBackup();
};

async function showHistoryModal() {
  manualBackupLabel.value = '';
  historyModal.style.display = 'block';
  modalOverlay.style.display = 'block';
  await loadBackupsList();
}

function closeHistoryModal() {
  historyModal.style.display = 'none';
  modalOverlay.style.display = 'none';
}

async function loadBackupsList() {
  backupTableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 12px; color: #666;">Loading backups...</td></tr>';
  try {
    const res = await fetch('/api/backups');
    const backups = await res.json();

    if (backups.length === 0) {
      backupTableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 12px; color: #666;">No backups found</td></tr>';
      return;
    }

    backupTableBody.innerHTML = '';
    backups.forEach(b => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid #eee';

      const isManual = b.type === 'manual';
      const typeBadge = isManual
        ? `<span style="background: #e3f2fd; color: #1976d2; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 10px; margin-right: 6px;">Manual</span>`
        : `<span style="background: #f5f5f5; color: #666; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-right: 6px;">Auto</span>`;

      const labelText = b.label || '';

      tr.innerHTML = `
        <td style="padding: 8px; text-align: left; vertical-align: middle;">${b.formattedDate}</td>
        <td style="padding: 8px; text-align: left; vertical-align: middle; line-height: 1.4;">${typeBadge} <strong>${labelText}</strong></td>
        <td style="padding: 8px; text-align: right; vertical-align: middle;">
          <button class="btn-primary restore-backup-btn" data-id="${b.id}" style="font-size: 11px; padding: 4px 8px; border-radius: 3px; cursor: pointer; border: none; font-weight: bold; background: #0747a6; color: white;">Restore</button>
        </td>
      `;

      tr.querySelector('.restore-backup-btn').onclick = async () => {
        await confirmAndRestoreBackup(b.id, b.formattedDate, labelText);
      };

      backupTableBody.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to load backups list:', err);
    backupTableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 12px; color: #cc0000;">Error reloading backups</td></tr>';
  }
}

async function createManualBackup() {
  const label = manualBackupLabel.value.trim();
  createManualBackupBtn.disabled = true;
  createManualBackupBtn.textContent = 'Saving...';

  try {
    const res = await fetch('/api/backups/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label })
    });

    if (res.ok) {
      manualBackupLabel.value = '';
      await loadBackupsList();
    } else {
      alert('Failed to create restore point');
    }
  } catch (err) {
    console.error(err);
    alert('An error occurred while creating restore point');
  } finally {
    createManualBackupBtn.disabled = false;
    createManualBackupBtn.textContent = 'Create Checkpoint';
  }
}

async function confirmAndRestoreBackup(id, fDate, label) {
  const confirmMsg = `WARNING: Are you sure you want to restore the system state to this checkpoint?\n\n` +
                     `Checkpoint: ${fDate} (${label})\n\n` +
                     `This will overwrite all active planning entries, member configurations, and teams with the backed up state.\n\n` +
                     `A safety backup of your current active state will be automatically created before restoring, so you can revert if needed.`;

  if (confirm(confirmMsg)) {
    try {
      const res = await fetch('/api/backups/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });

      if (res.ok) {
        alert('System state has been successfully restored!');
        closeHistoryModal();
        const pi = piNameInput.value.trim();
        if (pi) {
          await loadPlanning();
        } else {
          window.location.reload();
        }
      } else {
        const data = await res.json();
        alert('Restore failed: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred during restore.');
    }
  }
}

function openMemberSettings(memberName) {
  currentMemberForSettings = memberName;
  memberSettingsTitle.textContent = `Settings for ${memberName}`;
  deleteMemberNameConfirm.value = '';

  const settings = (currentPlanning.memberSettings && currentPlanning.memberSettings[memberName]) || {
    hoursPerDay: 8,
    availability: 100,
    workingDays: [1, 2, 3, 4, 5]
  };

  memberHoursPerDayInput.value = settings.hoursPerDay;
  memberPlanningAvailabilityInput.value = settings.availability;

  [0,1,2,3,4,5,6].forEach(day => {
    const cb = document.getElementById(`workDay${day}`);
    if (cb) cb.checked = settings.workingDays.includes(day);
  });

  memberSettingsModal.style.display = 'block';
  modalOverlay.style.display = 'block';
}

deleteMemberBtn.onclick = () => {
  if (!currentMemberForSettings) return;
  const typedName = deleteMemberNameConfirm.value.trim();
  const actualName = currentMemberForSettings.trim();

  if (typedName !== actualName) {
    alert(`Name mismatch. Please type exactly: "${actualName}"`);
    return;
  }

  if (confirm(`Are you absolutely sure you want to permanently delete ${actualName}? This action cannot be undone.`)) {
    // Delete from currentPlanning.members
    currentPlanning.members = currentPlanning.members.filter(mem => mem !== actualName);

    // Delete from currentPlanning.teams
    Object.keys(currentPlanning.teams).forEach(teamName => {
      currentPlanning.teams[teamName] = currentPlanning.teams[teamName].filter(tm => tm !== actualName);
    });

    // Clean up settings and pictures
    if (currentPlanning.memberSettings) {
      delete currentPlanning.memberSettings[actualName];
    }
    if (currentPlanning.pictures) {
      delete currentPlanning.pictures[actualName];
    }

    // Close modal
    memberSettingsModal.style.display = 'none';
    modalOverlay.style.display = 'none';
    currentMemberForSettings = null;

    // Refresh and save
    renderPlanning();
    triggerAutosave();
  }
};

saveMemberSettingsBtn.onclick = () => {
  if (!currentMemberForSettings) return;

  if (!currentPlanning.memberSettings) currentPlanning.memberSettings = {};

  const workingDays = [];
  [0,1,2,3,4,5,6].forEach(day => {
    const cb = document.getElementById(`workDay${day}`);
    if (cb && cb.checked) workingDays.push(day);
  });

  currentPlanning.memberSettings[currentMemberForSettings] = {
    hoursPerDay: parseFloat(memberHoursPerDayInput.value) || 0,
    availability: parseFloat(memberPlanningAvailabilityInput.value) || 0,
    workingDays: workingDays
  };

  memberSettingsModal.style.display = 'none';
  modalOverlay.style.display = 'none';
  currentMemberForSettings = null;
  renderPlanning();
  triggerAutosave();
};

cancelMemberSettingsBtn.onclick = () => {
  memberSettingsModal.style.display = 'none';
  modalOverlay.style.display = 'none';
  currentMemberForSettings = null;
};

async function fetchPlanningTypes() {
  const res = await fetch('/api/planning/types');
  planningTypes = await res.json();

  // Update legacy constants
  STATUS_TYPES.length = 0;
  Object.keys(STATUS_LABELS).forEach(key => delete STATUS_LABELS[key]);

  planningTypes.forEach(t => {
    STATUS_TYPES.push(t.id);
    STATUS_LABELS[t.id] = t.label;
  });
  STATUS_LABELS['readiness'] = 'Readiness';
  STATUS_LABELS['place'] = 'Place';

  renderLegend();
  if (currentPlanning && currentPlanning.pi) {
    renderPlanning();
  }
}

function renderLegend() {
  statusLegend.innerHTML = '';

  // Update dynamic styles for status colors
  let styleTag = document.getElementById('dynamic-status-styles');
  if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = 'dynamic-status-styles';
    document.head.appendChild(styleTag);
  }

  let css = '';
  planningTypes.forEach(type => {
    css += `.status-${type.id} { background-color: ${type.color}; }\n`;
    // For dark colors, make text white
    const isDark = isColorDark(type.color);
    if (isDark) {
      css += `.status-${type.id} { color: white; }\n`;
    } else {
      css += `.status-${type.id} { color: black; }\n`;
    }

    const item = document.createElement('div');
    item.className = 'legend-item' + (selectedStatus === type.id ? ' selected' : '');
    item.setAttribute('data-status', type.id);

    const colorBox = document.createElement('div');
    colorBox.className = 'legend-color';
    colorBox.style.backgroundColor = type.color;
    item.appendChild(colorBox);

    const label = document.createElement('span');
    label.textContent = type.label || (type.id === 'none' ? 'Available' : type.id);
    item.appendChild(label);

    item.onclick = () => {
      selectedStatus = type.id;
      document.querySelectorAll('.legend-item').forEach(li => li.classList.remove('selected'));
      item.classList.add('selected');
    };

    item.oncontextmenu = (e) => {
      e.preventDefault();
      if (type.id === 'none') return;
      openTypeEditor(type);
    };

    statusLegend.appendChild(item);
  });
  styleTag.textContent = css;

  // Fixed items
  const divider = document.createElement('div');
  divider.style.borderLeft = '1px solid #ccc';
  divider.style.margin = '0 10px';
  statusLegend.appendChild(divider);

  const readinessItem = createFixedLegendItem('readiness', 'Readiness', '#d32f2f');
  statusLegend.appendChild(readinessItem);

  const placeItem = createFixedLegendItem('place', 'Place', '#1976d2');
  statusLegend.appendChild(placeItem);

  // Populate eventTypeFilter dropdown
  const filterSelect = document.getElementById('eventTypeFilter');
  if (filterSelect) {
    const currentFilterValue = filterSelect.value;
    filterSelect.innerHTML = '<option value="all">Show All</option>';
    planningTypes.forEach(t => {
      if (t.id !== 'none') {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.label || t.id;
        filterSelect.appendChild(opt);
      }
    });
    if (Array.from(filterSelect.options).some(o => o.value === currentFilterValue)) {
      filterSelect.value = currentFilterValue;
    } else {
      filterSelect.value = 'all';
    }
  }
}

function isColorDark(color) {
  if (!color || !color.startsWith('#')) return false;
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  // HSP color model http://alienryderflex.com/hsp.html
  const hsp = Math.sqrt(0.299 * (r * r) + 0.587 * (g * g) + 0.114 * (b * b));
  return hsp < 150;
}

function createFixedLegendItem(id, labelText, color) {
  const item = document.createElement('div');
  item.className = 'legend-item' + (selectedStatus === id ? ' selected' : '');
  item.setAttribute('data-status', id);

  const colorBox = document.createElement('div');
  colorBox.className = 'legend-color';
  colorBox.style.border = `2px solid ${color}`;
  colorBox.style.background = '#fff';
  item.appendChild(colorBox);

  const label = document.createElement('span');
  label.textContent = labelText;
  label.style.color = color;
  label.style.fontWeight = 'bold';
  item.appendChild(label);

  item.onclick = () => {
    selectedStatus = id;
    document.querySelectorAll('.legend-item').forEach(li => li.classList.remove('selected'));
    item.classList.add('selected');
  };
  return item;
}

function openTypeEditor(type = null) {
  editingTypeId = type ? type.id : null;
  typeEditorTitle.textContent = type ? 'Edit Type' : 'Add New Type';
  typeIdInput.value = type ? type.id : '';
  typeIdInput.disabled = !!type;
  typeLabelInput.value = type ? type.label : '';
  typeColorInput.value = type ? type.color : '#ffffff';
  typeColorPicker.value = type ? (type.color.startsWith('#') ? type.color : '#ffffff') : '#ffffff';
  typeKindSelect.value = type ? type.type : 'absence';
  typeReductionInput.value = type ? (type.reduction !== undefined ? type.reduction : 100) : 100;

  reductionContainer.style.display = typeKindSelect.value === 'absence' ? 'block' : 'none';
  deleteTypeBtn.style.display = type ? 'inline-block' : 'none';

  typeEditorModal.style.display = 'block';
  modalOverlay.style.display = 'block';
}

typeKindSelect.onchange = () => {
  reductionContainer.style.display = typeKindSelect.value === 'absence' ? 'block' : 'none';
};

typeColorPicker.oninput = () => {
  typeColorInput.value = typeColorPicker.value;
};

typeColorInput.oninput = () => {
  if (/^#[0-9A-F]{6}$/i.test(typeColorInput.value)) {
    typeColorPicker.value = typeColorInput.value;
  }
};

eventTypeFilter.addEventListener('change', () => {
  renderPlanning();
});

addTypeBtn.onclick = () => openTypeEditor();
document.querySelectorAll('input[name="dayPart"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    selectedDayPart = e.target.value;
  });
});
cancelTypeBtn.onclick = () => {
  typeEditorModal.style.display = 'none';
  modalOverlay.style.display = 'none';
};

deleteTypeBtn.onclick = async () => {
  if (confirm('Delete this type? This will not remove it from existing planning data but it will no longer be available in the legend.')) {
    planningTypes = planningTypes.filter(t => t.id !== editingTypeId);
    await saveTypes();
    typeEditorModal.style.display = 'none';
    modalOverlay.style.display = 'none';
  }
};

saveTypeBtn.onclick = async () => {
  const id = typeIdInput.value.trim().toLowerCase().replace(/\s+/g, '-');
  if (!id) return alert('ID is required');

  const newType = {
    id,
    label: typeLabelInput.value.trim(),
    color: typeColorInput.value.trim() || '#ffffff',
    type: typeKindSelect.value,
    reduction: typeKindSelect.value === 'absence' ? parseInt(typeReductionInput.value) || 0 : 0
  };

  if (editingTypeId) {
    const index = planningTypes.findIndex(t => t.id === editingTypeId);
    planningTypes[index] = newType;
  } else {
    if (planningTypes.some(t => t.id === id)) return alert('ID already exists');
    planningTypes.push(newType);
  }

  await saveTypes();
  typeEditorModal.style.display = 'none';
  modalOverlay.style.display = 'none';
};

async function saveTypes() {
  await fetch('/api/planning/types', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(planningTypes)
  });
  renderLegend();
  renderPlanning(); // Refresh colors in table
}

fetchPlanningTypes();

function triggerAutosave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(savePlanning, 1000);
}

const STATUS_TYPES = []; // Will be populated from planningTypes
const STATUS_LABELS = {}; // Will be populated from planningTypes

async function loadPlanning() {
  const pi = piNameInput.value.trim();
  if (!pi) return alert('Enter PI Name');

  statusMsg.innerHTML = '<span class="loading">Loading...</span>';
  try {
    const res = await fetch(`/api/planning?pi=${encodeURIComponent(pi)}`);
    const data = await res.json();

    currentPlanning = data;

    // Migrate old data structure
    if (!currentPlanning.teams) currentPlanning.teams = {};
    if (!currentPlanning.memberSettings) currentPlanning.memberSettings = {};

    const todayStr = formatDateLocal(new Date());
    if (currentPlanning.startDate) {
      if (currentPlanning.startDate < todayStr) {
        startDateInput.value = todayStr;
        const end = new Date();
        end.setMonth(end.getMonth() + 3);
        const defaultEndStr = formatDateLocal(end);
        if (!currentPlanning.endDate || currentPlanning.endDate < defaultEndStr) {
          endDateInput.value = defaultEndStr;
        } else {
          endDateInput.value = currentPlanning.endDate;
        }
        triggerAutosave();
      } else {
        startDateInput.value = currentPlanning.startDate;
        if (currentPlanning.endDate) {
          endDateInput.value = currentPlanning.endDate;
        }
      }
    } else {
      startDateInput.value = todayStr;
      const end = new Date();
      end.setMonth(end.getMonth() + 3);
      endDateInput.value = formatDateLocal(end);
      triggerAutosave();
    }

    if (currentPlanning.members && currentPlanning.members.length > 0) {
      // If some members aren't in any team, put them in 'Unassigned'
      const assignedMembers = new Set();
      Object.values(currentPlanning.teams).forEach(teamMembers => {
        teamMembers.forEach(m => assignedMembers.add(m));
      });

      const unassigned = currentPlanning.members.filter(m => !assignedMembers.has(m));
      if (unassigned.length > 0) {
        if (!currentPlanning.teams['Unassigned']) currentPlanning.teams['Unassigned'] = [];
        currentPlanning.teams['Unassigned'] = [...new Set([...currentPlanning.teams['Unassigned'], ...unassigned])];
      }
    }

    // Reset inputs if loading new PI without stored dates
    if (!currentPlanning.days || Object.keys(currentPlanning.days).length === 0) {
      startDateInput.value = '';
      endDateInput.value = '';
    }

    renderPlanning();
    statusMsg.innerHTML = 'Loaded successfully.';
  } catch (e) {
    statusMsg.innerHTML = '<span class="error">Failed to load</span>';
  }
}

function updateTeamSelect() {
  const teams = Object.keys(currentPlanning.teams).sort();
  teamSelect.innerHTML = '';
  teams.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    teamSelect.appendChild(opt);
  });
  // Add 'Unassigned' if not present
  if (!currentPlanning.teams['Unassigned']) {
    const opt = document.createElement('option');
    opt.value = 'Unassigned';
    opt.textContent = 'Unassigned';
    teamSelect.appendChild(opt);
  }
}

function renderPlanning() {
  const colorsMap = { 'none': '#ffffff' };
  planningTypes.forEach(t => {
    colorsMap[t.id] = t.color;
  });

  const sortedTeams = Object.keys(currentPlanning.teams).sort((a, b) => {
    if (a === 'Unassigned') return 1;
    if (b === 'Unassigned') return -1;
    return a.localeCompare(b);
  });

  const teamSelectValue = teamSelect.value;
  updateTeamSelect();
  if (Array.from(teamSelect.options).some(opt => opt.value === teamSelectValue)) {
    teamSelect.value = teamSelectValue;
  }

  if (!startDateInput.value || !endDateInput.value) {
    // Default range: from today to today + 3 months
    const start = new Date();
    const end = new Date();
    end.setMonth(start.getMonth() + 3);
    startDateInput.value = formatDateLocal(start);
    endDateInput.value = formatDateLocal(end);
  }

  const start = new Date(startDateInput.value);
  const end = new Date(endDateInput.value);

  const filterSelect = document.getElementById('eventTypeFilter');
  const selectedFilter = filterSelect ? filterSelect.value : 'all';

  const hasSelectedEvent = (m) => {
    if (selectedFilter === 'all') return true;
    for (let tempD = new Date(start); tempD <= end; tempD.setDate(tempD.getDate() + 1)) {
      const dateStr = tempD.toISOString().split('T')[0];
      const dayData = (currentPlanning.days[dateStr] && currentPlanning.days[dateStr][m]);
      if (dayData) {
        const { morningStatus, afternoonStatus } = getDayStatuses(dayData);
        const status = (typeof dayData === 'object') ? dayData.status : dayData;
        if (status === selectedFilter || morningStatus === selectedFilter || afternoonStatus === selectedFilter) {
          return true;
        }
      }
    }
    return false;
  };

  planningCard.style.display = 'block';

  // Render Header
  while (tableHeader.cells.length > 1) tableHeader.deleteCell(1);

  const memberListOrdered = [];

  sortedTeams.forEach(teamName => {
    const teamMembers = currentPlanning.teams[teamName] || [];
    if (teamMembers.length === 0 && teamName !== 'Unassigned') return;

    teamMembers.sort().forEach(m => {
      if (!hasSelectedEvent(m)) return;

      memberListOrdered.push({ name: m, team: teamName });
      const th = document.createElement('th');
      th.style.minWidth = '100px';
      th.style.height = '130px';
      th.style.padding = '8px 4px';
      th.style.boxSizing = 'border-box';

      const wrapper = document.createElement('div');
      wrapper.style.display = 'flex';
      wrapper.style.flexDirection = 'column';
      wrapper.style.alignItems = 'center';
      wrapper.style.justifyContent = 'space-between';
      wrapper.style.height = '100%';
      wrapper.style.boxSizing = 'border-box';

      // Top container for photo and name
      const topContainer = document.createElement('div');
      topContainer.style.display = 'flex';
      topContainer.style.flexDirection = 'column';
      topContainer.style.alignItems = 'center';
      topContainer.style.gap = '4px';

      // Profile Picture
      const picUrl = currentPlanning.pictures && currentPlanning.pictures[m];
      if (picUrl) {
        const img = document.createElement('img');
        img.src = picUrl;
        img.className = 'member-pic';
        img.title = `Click to change picture for ${m}`;
        img.onclick = () => {
          currentMemberForImage = m;
          document.getElementById('memberImageInput').click();
        };
        topContainer.appendChild(img);
      } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'placeholder-pic';
        placeholder.textContent = m.charAt(0).toUpperCase();
        placeholder.title = `Click to add picture for ${m}`;
        placeholder.onclick = () => {
          currentMemberForImage = m;
          document.getElementById('memberImageInput').click();
        };
        topContainer.appendChild(placeholder);
      }

      const nameDiv = document.createElement('div');
      nameDiv.style.overflow = 'hidden';
      nameDiv.style.textOverflow = 'ellipsis';
      nameDiv.style.maxWidth = '150px';
      nameDiv.style.whiteSpace = 'wrap';
      nameDiv.style.fontWeight = 'bold';
      nameDiv.textContent = m;
      nameDiv.title = 'Click for settings, right-click to change team';
      nameDiv.className = 'team-name-editable';
      nameDiv.onclick = () => openMemberSettings(m);
      topContainer.appendChild(nameDiv);

      wrapper.appendChild(topContainer);

      const settingsInfo = document.createElement('div');
      settingsInfo.style.fontSize = '9px';
      settingsInfo.style.color = '#666';
      const settings = (currentPlanning.memberSettings && currentPlanning.memberSettings[m]) || { hoursPerDay: 8, availability: 100 };
      settingsInfo.textContent = `${settings.hoursPerDay}h/d, ${settings.availability}%`;
      wrapper.appendChild(settingsInfo);

      // Context Menu for team assignment
      wrapper.oncontextmenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        contextMenu.innerHTML = '';

        const header = document.createElement('div');
        header.className = 'context-menu-header';
        header.textContent = `Move ${m} to Team:`;
        contextMenu.appendChild(header);

        sortedTeams.forEach(t => {
          const item = document.createElement('div');
          item.className = 'context-menu-item';
          item.textContent = t + (t === teamName ? ' (current)' : '');
          item.onclick = () => {
            if (t !== teamName) {
              // Remove from old team
              currentPlanning.teams[teamName] = currentPlanning.teams[teamName].filter(tm => tm !== m);
              // Add to new team
              if (!currentPlanning.teams[t]) currentPlanning.teams[t] = [];
              currentPlanning.teams[t].push(m);
              renderPlanning();
              triggerAutosave();
            }
            contextMenu.style.display = 'none';
          };
          contextMenu.appendChild(item);
        });

        contextMenu.style.display = 'block';
        contextMenu.style.left = e.pageX + 'px';
        contextMenu.style.top = e.pageY + 'px';
      };

      th.appendChild(wrapper);
      tableHeader.appendChild(th);
    });
  });

  // Insert Team grouping row if it doesn't exist
  let teamRow = document.getElementById('teamRow');
  if (!teamRow) {
    teamRow = document.createElement('tr');
    teamRow.id = 'teamRow';
    tableHeader.parentNode.insertBefore(teamRow, tableHeader.nextSibling);
  } else {
    teamRow.innerHTML = '';
  }
  let teamHeader = document.createElement('th');
  teamHeader.textContent = 'Team';
  teamRow.appendChild(teamHeader);

  sortedTeams.forEach(teamName => {
    const teamMembers = currentPlanning.teams[teamName] || [];
    if (teamMembers.length === 0 && teamName !== 'Unassigned') return;

    const visibleTeamMembers = teamMembers.filter(m => memberListOrdered.some(mO => mO.name === m && mO.team === teamName));
    if (visibleTeamMembers.length === 0) return;

    const th = document.createElement('th');
    th.className = 'team-header';
    th.colSpan = visibleTeamMembers.length;

    const teamSpan = document.createElement('span');
    teamSpan.textContent = teamName;
    teamSpan.className = 'team-name-editable';

    if (teamName !== 'Unassigned') {
      teamSpan.title = 'Click to rename';
      teamSpan.onclick = () => {
        const newName = prompt(`Rename team "${teamName}" to:`, teamName);
        if (newName && newName !== teamName) {
          if (currentPlanning.teams[newName]) {
            alert('Team with this name already exists.');
            return;
          }
          currentPlanning.teams[newName] = currentPlanning.teams[teamName];
          delete currentPlanning.teams[teamName];
          renderPlanning();
          triggerAutosave();
        }
      };
    }
    th.appendChild(teamSpan);

    if (teamName !== 'Unassigned') {
      const delTeamBtn = document.createElement('button');
      delTeamBtn.textContent = '×';
      delTeamBtn.className = 'delete-btn';
      delTeamBtn.title = `Delete team "${teamName}"`;
      delTeamBtn.onclick = () => {
        if (confirm(`Delete team "${teamName}"? Members will be moved to Unassigned.`)) {
          if (!currentPlanning.teams['Unassigned']) currentPlanning.teams['Unassigned'] = [];
          currentPlanning.teams['Unassigned'].push(...currentPlanning.teams[teamName]);
          delete currentPlanning.teams[teamName];
          renderPlanning();
          triggerAutosave();
        }
      };
      th.appendChild(delTeamBtn);
    }

    if (visibleTeamMembers.length > 0) {
       teamRow.appendChild(th);
    }
  });

  // Render Body (Rows for dates)
  tableBody.innerHTML = '';

  let currentWeek = -1;
  let weekTr = null;
  let weekTrAppended = false;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];

    const weekNum = getWeekNumber(d);
    if (weekNum !== currentWeek) {
      currentWeek = weekNum;
      weekTr = document.createElement('tr');
      weekTr.className = 'week-row';

      const weekLabelTd = document.createElement('td');
      weekLabelTd.textContent = `CW ${weekNum}`;
      weekLabelTd.title = 'Click to apply selected status/info to ALL members for this whole week';
      weekLabelTd.style.cursor = 'pointer';
      weekLabelTd.style.fontWeight = 'bold';
      weekLabelTd.style.backgroundColor = '#dbeafe';

      const weekStartDate = new Date(d);
      const getDaysInWeek = () => {
        const daysInWeek = [];
        const tempDate = new Date(weekStartDate);
        // Go to Monday of this week (or start if after Monday)
        while(tempDate.getDay() !== 1 && tempDate > start) {
          tempDate.setDate(tempDate.getDate() - 1);
        }
        // Add all days of this week within range
        for(let i=0; i<7; i++) {
          if (tempDate >= start && tempDate <= end && getWeekNumber(tempDate) === weekNum) {
            daysInWeek.push(tempDate.toISOString().split('T')[0]);
          }
          tempDate.setDate(tempDate.getDate() + 1);
        }
        return daysInWeek;
      };

      const applyToMemberInWeek = (member, days, initialValue = null, overrideExisting = true) => {
        let val = initialValue;
        if (selectedStatus === 'readiness') {
          // Check if all members for all these days already have 'Readiness'
          let allHaveReadiness = true;
          days.forEach(ds => {
            if (!currentPlanning.days[ds]) {
              allHaveReadiness = false;
              return;
            }
            const dD = currentPlanning.days[ds][member];
            if (!(dD && (typeof dD === 'object') && dD.readiness === 'Readiness')) {
              allHaveReadiness = false;
            }
          });
          val = allHaveReadiness ? null : 'Readiness';
        } else if (selectedStatus === 'place' && val === null) {
          val = prompt(`Set Place for ${member} for this week:`, '');
          if (val === null) return; // Cancel
        } else if (selectedStatus === 'freetext' && val === null) {
          val = prompt(`Enter Free Text for ${member} for this week:`, '');
          if (val === null) return; // Cancel
        }

        days.forEach(ds => {
          if (!overrideExisting && isCellNotEmpty(ds, member)) {
            return;
          }
          if (!currentPlanning.days[ds]) currentPlanning.days[ds] = {};
          let dayData = currentPlanning.days[ds][member];
          if (typeof dayData !== 'object' || dayData === null) {
            dayData = { status: dayData || 'none' };
          }

          if (selectedStatus === 'readiness') {
            if (val === 'Readiness') {
              dayData.readiness = val;
            } else {
              delete dayData.readiness;
            }
          } else if (selectedStatus === 'place') {
            dayData.place = val;
          } else if (selectedStatus === 'freetext') {
            dayData.status = 'freetext';
            dayData.freetext = val;
          } else {
            if (selectedDayPart === 'morning') {
              let { morningStatus: mS, afternoonStatus: aS } = getDayStatuses(dayData);
              dayData.morningStatus = selectedStatus;
              dayData.afternoonStatus = aS;
              dayData.status = (selectedStatus === aS) ? selectedStatus : 'none';
            } else if (selectedDayPart === 'afternoon') {
              let { morningStatus: mS, afternoonStatus: aS } = getDayStatuses(dayData);
              dayData.morningStatus = mS;
              dayData.afternoonStatus = selectedStatus;
              dayData.status = (mS === selectedStatus) ? selectedStatus : 'none';
            } else {
              dayData.morningStatus = selectedStatus;
              dayData.afternoonStatus = selectedStatus;
              dayData.status = selectedStatus;
            }
          }
          currentPlanning.days[ds][member] = dayData;
        });
      };

      weekLabelTd.onclick = () => {
        const daysInWeek = getDaysInWeek();
        let bulkVal = null;
        if (selectedStatus === 'place') {
          bulkVal = prompt(`Set Place for all members for this week:`, '');
          if (bulkVal === null) return;
        } else if (selectedStatus === 'freetext') {
          bulkVal = prompt(`Enter Free Text for all members for this week:`, '');
          if (bulkVal === null) return;
        }

        // Check if any target cell already has an entry
        let hasAnyExisting = false;
        for (const mObj of memberListOrdered) {
          for (const ds of daysInWeek) {
            if (isCellNotEmpty(ds, mObj.name)) {
              hasAnyExisting = true;
              break;
            }
          }
          if (hasAnyExisting) break;
        }

        let overrideExisting = true;
        if (hasAnyExisting) {
          overrideExisting = confirm("Some cells in this week already contain entries.\n\nClick OK to OVERWRITE and replace them.\nClick Cancel to KEEP existing entries and only apply to empty ones.");
        }

        memberListOrdered.forEach(mObj => {
          applyToMemberInWeek(mObj.name, daysInWeek, bulkVal, overrideExisting);
        });
        renderPlanning();
        triggerAutosave();
      };
      weekTr.appendChild(weekLabelTd);

      memberListOrdered.forEach(mObj => {
        const member = mObj.name;
        const weekMemberTd = document.createElement('td');
        weekMemberTd.style.cursor = 'pointer';
        weekMemberTd.style.backgroundColor = '#eff6ff';
        weekMemberTd.title = `Click to apply selected status/info to ${member} for this whole week`;
        weekMemberTd.onclick = () => {
          const daysInWeek = getDaysInWeek();

          // Check if any target cell for this member already has an entry
          let hasAnyExisting = false;
          for (const ds of daysInWeek) {
            if (isCellNotEmpty(ds, member)) {
              hasAnyExisting = true;
              break;
            }
          }

          let overrideExisting = true;
          if (hasAnyExisting) {
            overrideExisting = confirm(`Some days in this week for ${member} already contain entries.\n\nClick OK to OVERWRITE and replace them.\nClick Cancel to KEEP existing entries and only apply to empty ones.`);
          }

          applyToMemberInWeek(member, daysInWeek, null, overrideExisting);
          renderPlanning();
          triggerAutosave();
        };
        weekTr.appendChild(weekMemberTd);
      });

      weekTrAppended = false;
    }

    const dateHasEvent = () => {
      if (selectedFilter === 'all') return true;
      return memberListOrdered.some(mO => {
        const member = mO.name;
        const dayData = (currentPlanning.days[dateStr] && currentPlanning.days[dateStr][member]);
        if (dayData) {
          const { morningStatus, afternoonStatus } = getDayStatuses(dayData);
          const status = (typeof dayData === 'object') ? dayData.status : dayData;
          return (status === selectedFilter || morningStatus === selectedFilter || afternoonStatus === selectedFilter);
        }
        return false;
      });
    };

    if (!dateHasEvent()) {
      continue;
    }

    if (!weekTrAppended && weekTr) {
      tableBody.appendChild(weekTr);
      weekTrAppended = true;
    }

    const tr = document.createElement('tr');
    if (d.getDay() === 0 || d.getDay() === 6) tr.classList.add('weekend');

    const dateTd = document.createElement('td');
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    dateTd.textContent = `${dayName}, ${d.getDate()}.${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    dateTd.style.cursor = 'pointer';
    dateTd.title = 'Click to apply selected status to all members for this day';
    dateTd.onclick = () => {
      if (!currentPlanning.days[dateStr]) currentPlanning.days[dateStr] = {};

      let dayVal = null;
      if (selectedStatus === 'readiness') {
        // Check if all members already have 'Readiness'
        const allHaveReadiness = memberListOrdered.every(mO => {
          const dD = currentPlanning.days[dateStr][mO.name];
          return dD && (typeof dD === 'object') && dD.readiness === 'Readiness';
        });
        dayVal = allHaveReadiness ? null : 'Readiness';
      } else if (selectedStatus === 'place') {
        dayVal = prompt(`Set Place for all members on ${dateStr}:`, '');
        if (dayVal === null) return;
      } else if (selectedStatus === 'freetext') {
        dayVal = prompt(`Enter Free Text for all members on ${dateStr}:`, '');
        if (dayVal === null) return;
      }

      // Check if any target cell already has an entry
      let hasAnyExisting = false;
      for (const mObj of memberListOrdered) {
        if (isCellNotEmpty(dateStr, mObj.name)) {
          hasAnyExisting = true;
          break;
        }
      }

      let overrideExisting = true;
      if (hasAnyExisting) {
        overrideExisting = confirm(`Some members on ${dateStr} already contain entries.\n\nClick OK to OVERWRITE and replace them.\nClick Cancel to KEEP existing entries and only apply to empty ones.`);
      }

      memberListOrdered.forEach(mObj => {
        const member = mObj.name;
        if (!overrideExisting && isCellNotEmpty(dateStr, member)) {
          return;
        }
        let dayData = currentPlanning.days[dateStr][member];
        if (typeof dayData !== 'object' || dayData === null) {
          dayData = { status: dayData || 'none' };
        }

        if (selectedStatus === 'readiness') {
          dayData.readiness = dayVal;
        } else if (selectedStatus === 'place') {
          dayData.place = dayVal;
        } else if (selectedStatus === 'freetext') {
          // Check if all members already have 'freetext'
          const allSame = memberListOrdered.every(mO => {
            const dD = currentPlanning.days[dateStr][mO.name] || 'none';
            const cS = (typeof dD === 'object') ? dD.status : dD;
            return cS === 'freetext';
          });
          if (allSame) {
            dayData.status = 'none';
            delete dayData.freetext;
          } else {
            dayData.status = 'freetext';
            dayData.freetext = dayVal;
          }
        } else {
          if (selectedDayPart === 'morning') {
            const allSame = memberListOrdered.every(mO => {
              const dD = (currentPlanning.days[dateStr] && currentPlanning.days[dateStr][mO.name]) || 'none';
              const { morningStatus: mS } = getDayStatuses(dD);
              return mS === selectedStatus;
            });
            const targetVal = allSame ? 'none' : selectedStatus;

            let { morningStatus: mS, afternoonStatus: aS } = getDayStatuses(dayData);
            dayData.morningStatus = targetVal;
            dayData.afternoonStatus = aS;
            dayData.status = (targetVal === aS) ? targetVal : 'none';
          } else if (selectedDayPart === 'afternoon') {
            const allSame = memberListOrdered.every(mO => {
              const dD = (currentPlanning.days[dateStr] && currentPlanning.days[dateStr][mO.name]) || 'none';
              const { afternoonStatus: aS } = getDayStatuses(dD);
              return aS === selectedStatus;
            });
            const targetVal = allSame ? 'none' : selectedStatus;

            let { morningStatus: mS, afternoonStatus: aS } = getDayStatuses(dayData);
            dayData.morningStatus = mS;
            dayData.afternoonStatus = targetVal;
            dayData.status = (mS === targetVal) ? mS : 'none';
          } else {
            const allSame = memberListOrdered.every(mO => {
              const dD = (currentPlanning.days[dateStr] && currentPlanning.days[dateStr][mO.name]) || 'none';
              const { morningStatus: mS, afternoonStatus: aS } = getDayStatuses(dD);
              return mS === selectedStatus && aS === selectedStatus;
            });
            const targetVal = allSame ? 'none' : selectedStatus;

            dayData.morningStatus = targetVal;
            dayData.afternoonStatus = targetVal;
            dayData.status = targetVal;
          }
        }
        currentPlanning.days[dateStr][member] = dayData;
      });
      renderPlanning();
      triggerAutosave();
    };
    tr.appendChild(dateTd);

    memberListOrdered.forEach(mObj => {
      const member = mObj.name;
      const td = document.createElement('td');
      td.className = 'planning-cell';
      const dayData = (currentPlanning.days[dateStr] && currentPlanning.days[dateStr][member]) || 'none';
      const { morningStatus, afternoonStatus } = getDayStatuses(dayData);
      const status = (typeof dayData === 'object') ? dayData.status : dayData;
      const readiness = (typeof dayData === 'object') ? dayData.readiness : '';
      const place = (typeof dayData === 'object') ? dayData.place : '';

      const cellMatchesFilter = (selectedFilter === 'all') ||
                                (status === selectedFilter) ||
                                (morningStatus === selectedFilter) ||
                                (afternoonStatus === selectedFilter);

      if (selectedFilter !== 'all' && !cellMatchesFilter) {
        td.className = 'planning-cell status-none';
        td.style.background = '';
        td.style.color = '';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'planning-cell-content';

        const rSidebar = document.createElement('div');
        rSidebar.className = 'cell-readiness-sidebar';
        rSidebar.style.background = 'transparent';
        rSidebar.style.border = 'none';
        contentDiv.appendChild(rSidebar);

        const mainContent = document.createElement('div');
        mainContent.className = 'cell-main-content';
        mainContent.textContent = '';
        contentDiv.appendChild(mainContent);

        const pSidebar = document.createElement('div');
        pSidebar.className = 'cell-place-sidebar';
        pSidebar.style.background = 'transparent';
        pSidebar.style.border = 'none';
        contentDiv.appendChild(pSidebar);

        td.appendChild(contentDiv);
      } else {
        if (morningStatus === afternoonStatus) {
          td.className = 'planning-cell status-' + morningStatus;
          td.style.background = '';
          td.style.color = '';
        } else {
          td.className = 'planning-cell status-half-day';
          const amColor = (morningStatus === selectedFilter || selectedFilter === 'all') ? (colorsMap[morningStatus] || '#ffffff') : '#ffffff';
          const pmColor = (afternoonStatus === selectedFilter || selectedFilter === 'all') ? (colorsMap[afternoonStatus] || '#ffffff') : '#ffffff';
          td.style.background = `linear-gradient(135deg, ${amColor} 50%, ${pmColor} 50%)`;
          const amDark = isColorDark(amColor);
          const pmDark = isColorDark(pmColor);
          if (amDark && pmDark) {
            td.style.color = 'white';
          } else if (!amDark && !pmDark) {
            td.style.color = 'black';
          } else {
            td.style.color = 'black';
            td.style.textShadow = '1px 1px 1px white, -1px -1px 1px white, 1px -1px 1px white, -1px 1px 1px white';
          }
        }

        const contentDiv = document.createElement('div');
        contentDiv.className = 'planning-cell-content';
        td.appendChild(contentDiv);

        // Left Sidebar for Readiness (20%)
        const rSidebar = document.createElement('div');
        rSidebar.className = 'cell-readiness-sidebar';
        if (readiness) {
          rSidebar.textContent = readiness;
        } else {
          rSidebar.style.background = 'transparent';
          rSidebar.style.border = 'none';
        }
        contentDiv.appendChild(rSidebar);

        // Main Content (60%)
        const mainContent = document.createElement('div');
        mainContent.className = 'cell-main-content';
        if (status === 'freetext' && dayData.freetext) {
          mainContent.textContent = (selectedFilter === 'all' || selectedFilter === 'freetext') ? dayData.freetext : '';
        } else {
          let txt = '';
          if (morningStatus === afternoonStatus) {
            txt = STATUS_LABELS[morningStatus] || '';
          } else {
            const amLabel = STATUS_LABELS[morningStatus] || '-';
            const pmLabel = STATUS_LABELS[afternoonStatus] || '-';

            const showAM = (morningStatus === selectedFilter || selectedFilter === 'all') && morningStatus !== 'none';
            const showPM = (afternoonStatus === selectedFilter || selectedFilter === 'all') && afternoonStatus !== 'none';

            if (showAM && !showPM) {
              txt = `${amLabel} (AM)`;
            } else if (!showAM && showPM) {
              txt = `${pmLabel} (PM)`;
            } else if (showAM && showPM) {
              txt = `${amLabel}/${pmLabel}`;
            } else {
              txt = '';
            }
          }
          mainContent.textContent = txt;
        }
        contentDiv.appendChild(mainContent);

        // Right Sidebar for Place (20%)
        const pSidebar = document.createElement('div');
        pSidebar.className = 'cell-place-sidebar';
        if (place) {
          pSidebar.textContent = place;
        } else {
          pSidebar.style.background = 'transparent';
          pSidebar.style.border = 'none';
        }
        contentDiv.appendChild(pSidebar);
      }

      td.onclick = (e) => {
        if (!currentPlanning.days[dateStr]) currentPlanning.days[dateStr] = {};
        let dayData = currentPlanning.days[dateStr][member] || 'none';
        if (typeof dayData !== 'object' || dayData === null) {
          dayData = { status: dayData || 'none' };
        }

        if (selectedStatus === 'readiness') {
          if (dayData.readiness === 'Readiness') {
            delete dayData.readiness;
          } else {
            dayData.readiness = 'Readiness';
          }
        } else if (selectedStatus === 'place') {
          const val = prompt(`Set Place for ${member} on ${dateStr}:`, dayData.place || '');
          if (val !== null) dayData.place = val;
        } else if (selectedStatus === 'freetext') {
          const currentStatus = dayData.status || 'none';
          if (currentStatus === 'freetext') {
            dayData.status = 'none';
            delete dayData.freetext;
          } else {
            const val = prompt(`Enter Free Text for ${member} on ${dateStr}:`, dayData.freetext || '');
            if (val !== null) {
              dayData.status = 'freetext';
              dayData.freetext = val;
            }
          }
        } else {
          if (selectedDayPart === 'morning') {
            let { morningStatus: mS, afternoonStatus: aS } = getDayStatuses(dayData);
            const newMorningStatus = (selectedStatus === 'none') ? 'none' : ((mS === selectedStatus) ? 'none' : selectedStatus);
            dayData.morningStatus = newMorningStatus;
            dayData.afternoonStatus = aS;
            dayData.status = (newMorningStatus === aS) ? newMorningStatus : 'none';
          } else if (selectedDayPart === 'afternoon') {
            let { morningStatus: mS, afternoonStatus: aS } = getDayStatuses(dayData);
            const newAfternoonStatus = (selectedStatus === 'none') ? 'none' : ((aS === selectedStatus) ? 'none' : selectedStatus);
            dayData.morningStatus = mS;
            dayData.afternoonStatus = newAfternoonStatus;
            dayData.status = (mS === newAfternoonStatus) ? mS : 'none';
          } else {
            let { morningStatus: mS, afternoonStatus: aS } = getDayStatuses(dayData);
            let newStatus = 'none';
            if (selectedStatus !== 'none') {
              if (mS === selectedStatus && aS === selectedStatus) {
                newStatus = 'none';
              } else {
                newStatus = selectedStatus;
              }
            }
            dayData.morningStatus = newStatus;
            dayData.afternoonStatus = newStatus;
            dayData.status = newStatus;
          }
        }

        currentPlanning.days[dateStr][member] = dayData;
        renderPlanning();
        triggerAutosave();
      };

      tr.appendChild(td);
    });

    tableBody.appendChild(tr);
  }
}

async function savePlanning() {
  const pi = piNameInput.value.trim();
  if (!pi) return alert('Enter PI Name');

  currentPlanning.startDate = startDateInput.value;
  currentPlanning.endDate = endDateInput.value;

  // Calculate capacity before saving
  currentPlanning.calculatedCapacity = calculateCapacity();

  statusMsg.innerHTML = '<span class="loading">Saving...</span>';
  try {
    const res = await fetch('/api/planning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pi, data: currentPlanning })
    });
    const data = await res.json();
    statusMsg.innerHTML = data.message || 'Saved.';
  } catch (e) {
    statusMsg.innerHTML = '<span class="error">Save failed</span>';
  }
}

function calculateCapacity() {
  // Very simple calculation: 8h per day unless status reduces capacity
  // We need to group by iteration. For now we just use a placeholder grouping if iterations aren't defined.

  const capacity = {};
  const pi = piNameInput.value.trim();

  const reductionMap = {};
  planningTypes.forEach(t => {
    reductionMap[t.id] = t.reduction !== undefined ? t.reduction : (t.type === 'absence' ? 100 : 0);
  });

  currentPlanning.members.forEach(member => {
    capacity[member] = {};
  });

  // Simple iteration mapping: 14 days per iteration
  const start = new Date(startDateInput.value);
  const end = new Date(endDateInput.value);

  let dayCount = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const itNum = Math.floor(dayCount / 14) + 1;
    const itName = `${pi}_${itNum.toString().padStart(2, '0')}`;
    const dateStr = d.toISOString().split('T')[0];
    const isWeekend = (d.getDay() === 0 || d.getDay() === 6);

    currentPlanning.members.forEach(member => {
      if (!capacity[member][itName]) capacity[member][itName] = 0;

      const dayData = (currentPlanning.days[dateStr] && currentPlanning.days[dateStr][member]) || 'none';
      const { morningStatus, afternoonStatus } = getDayStatuses(dayData);
      const settings = (currentPlanning.memberSettings && currentPlanning.memberSettings[member]) || { hoursPerDay: 8, availability: 100, workingDays: [1,2,3,4,5] };
      const isContractDay = settings.workingDays.includes(d.getDay());

      if (isContractDay) {
        let baseHours = settings.hoursPerDay * (settings.availability / 100);
        let reductionAM = reductionMap[morningStatus] || 0;
        let reductionPM = reductionMap[afternoonStatus] || 0;
        let reduction = (reductionAM + reductionPM) / 2;
        let actualHours = baseHours * (1 - (reduction / 100));
        capacity[member][itName] += actualHours * 3600;
      }
    });
    dayCount++;
  }

  return capacity;
}

addMemberBtn.onclick = () => {
  const name = memberInput.value.trim();
  const team = teamSelect.value;
  if (name && !currentPlanning.members.includes(name)) {
    currentPlanning.members.push(name);
    currentPlanning.members.sort();
    if (!currentPlanning.teams[team]) currentPlanning.teams[team] = [];
    currentPlanning.teams[team].push(name);
    memberInput.value = '';
    renderPlanning();
    triggerAutosave();
  }
};

addTeamBtn.onclick = () => {
  const teamName = newTeamInput.value.trim();
  if (teamName && !currentPlanning.teams[teamName]) {
    currentPlanning.teams[teamName] = [];
    newTeamInput.value = '';
    renderPlanning();
    triggerAutosave();
  }
};

startDateInput.onchange = () => { renderPlanning(); triggerAutosave(); };
endDateInput.onchange = () => { renderPlanning(); triggerAutosave(); };

// Image upload handler
document.getElementById('memberImageInput').onchange = async (e) => {
  const file = e.target.files[0];
  if (!file || !currentMemberForImage) return;

  const formData = new FormData();
  // Append text fields BEFORE the file to ensure multer.diskStorage.filename can access req.body
  formData.append('memberName', currentMemberForImage);
  formData.append('image', file);

  statusMsg.innerHTML = '<span class="loading">Uploading image...</span>';
  try {
    const res = await fetch('/api/planning/member/image', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.imageUrl) {
      if (!currentPlanning.pictures) currentPlanning.pictures = {};
      // Add a cache-buster to the URL to force the browser to reload the image
      const cacheBuster = `?t=${new Date().getTime()}`;
      currentPlanning.pictures[currentMemberForImage] = data.imageUrl + cacheBuster;
      statusMsg.innerHTML = 'Image uploaded.';
      renderPlanning();
      triggerAutosave();
    } else {
      statusMsg.innerHTML = '<span class="error">Upload failed</span>';
    }
  } catch (err) {
    console.error('Upload error:', err);
    statusMsg.innerHTML = '<span class="error">Upload error</span>';
  }
  e.target.value = ''; // Reset file input
  currentMemberForImage = null;
};

// Excel Export & Import & Load buttons wiring
loadBtn.onclick = () => {
  loadPlanning();
};

exportExcelBtn.onclick = () => {
  const pi = piNameInput.value.trim();
  if (!pi) return alert('Enter PI Name first');

  const start = startDateInput.value;
  const end = endDateInput.value;
  const filterSelect = document.getElementById('eventTypeFilter');
  const filterEvent = filterSelect ? filterSelect.value : 'all';

  let url = `/api/planning/export?pi=${encodeURIComponent(pi)}`;
  if (start) url += `&startDate=${encodeURIComponent(start)}`;
  if (end) url += `&endDate=${encodeURIComponent(end)}`;
  if (filterEvent) url += `&filterEvent=${encodeURIComponent(filterEvent)}`;

  window.location.href = url;
};

importExcelBtn.onclick = () => {
  const pi = piNameInput.value.trim();
  if (!pi) return alert('Enter PI Name first');
  excelFileInput.click();
};

excelFileInput.onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const pi = piNameInput.value.trim();
  if (!pi) return alert('Enter PI Name first');

  const formData = new FormData();
  formData.append('pi', pi);
  formData.append('file', file);

  statusMsg.innerHTML = '<span class="loading">Importing Excel...</span>';
  try {
    const res = await fetch('/api/planning/import', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (res.ok) {
      currentPlanning = data.updatedPlanning;

      if (currentPlanning.startDate) startDateInput.value = currentPlanning.startDate;
      if (currentPlanning.endDate) endDateInput.value = currentPlanning.endDate;

      statusMsg.innerHTML = 'Excel imported and saved successfully.';
      renderPlanning();
    } else {
      statusMsg.innerHTML = `<span class="error">${data.error || 'Import failed'}</span>`;
      alert(data.error || 'Import failed');
    }
  } catch (err) {
    console.error('Import error:', err);
    statusMsg.innerHTML = '<span class="error">Import error</span>';
  }
  e.target.value = ''; // Reset file input
};

// Load last accessed PI on startup
window.addEventListener('DOMContentLoaded', async () => {
  // Default dates to current day to 3 months from now
  const start = new Date();
  const end = new Date();
  end.setMonth(start.getMonth() + 3);
  startDateInput.value = formatDateLocal(start);
  endDateInput.value = formatDateLocal(end);

  try {
    const res = await fetch('/api/planning/last');
    const data = await res.json();
    if (data.pi) {
      piNameInput.value = data.pi;
      loadPlanning();
    }
  } catch (e) {
    console.error('Failed to load last PI', e);
  }
});

