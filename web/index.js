function toggleCard() {
  const content = document.getElementById('cardContent');
  const icon = document.getElementById('toggleIcon');
  content.classList.toggle('collapsed');
  icon.classList.toggle('collapsed');
}
const piNameInput = document.getElementById('piName');
const loadBtn = document.getElementById('loadBtn');
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
    if (dayData.status === 'freetext') {
      morningStatus = 'freetext';
      afternoonStatus = 'freetext';
    } else if (dayData.morningStatus || dayData.afternoonStatus) {
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

function getLightBgColor(hexColor) {
  if (!hexColor || typeof hexColor !== 'string' || !hexColor.startsWith('#')) return '#f0f4ff';
  let hex = hexColor.replace('#', '');
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '#f0f4ff';
  const lr = Math.round(r * 0.15 + 255 * 0.85);
  const lg = Math.round(g * 0.15 + 255 * 0.85);
  const lb = Math.round(b * 0.15 + 255 * 0.85);
  return `rgb(${lr}, ${lg}, ${lb})`;
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
    const hasReadiness = !!dayData.readiness || !!dayData.morningReadiness || !!dayData.afternoonReadiness;
    const hasPlace = !!dayData.place || !!dayData.morningPlace || !!dayData.afternoonPlace;
    const hasLeft = !!dayData.left || !!dayData.morningLeft || !!dayData.afternoonLeft;
    const hasRight = !!dayData.right || !!dayData.morningRight || !!dayData.afternoonRight;
    const hasFreetext = !!dayData.freetext;
    return hasStatus || hasReadiness || hasPlace || hasLeft || hasRight || hasFreetext;
  }

  return false;
}

let currentPlanning = { pi: '', members: [], teams: {}, days: {}, pictures: {}, memberSettings: {} };
let selectedStatus = 'none';
let lastPlaceInput = '';
try {
  lastPlaceInput = localStorage.getItem('lastPlaceInput') || '';
} catch (e) {}

function setLastPlaceInput(val) {
  lastPlaceInput = val;
  try {
    localStorage.setItem('lastPlaceInput', val);
  } catch (e) {}
}
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
const typeDisplaySelect = document.getElementById('typeDisplay');
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

  // Ensure default display property
  planningTypes.forEach(t => {
    if (!t.display) {
      if (t.id === 'readiness') t.display = 'left';
      else if (t.id === 'place') t.display = 'right';
      else t.display = 'middle';
    }
  });

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

function openTypeEditor(type = null) {
  editingTypeId = type ? type.id : null;
  typeEditorTitle.textContent = type ? 'Edit Type' : 'Add New Type';
  typeIdInput.value = type ? type.id : '';
  typeIdInput.disabled = !!type;
  typeLabelInput.value = type ? type.label : '';
  typeColorInput.value = type ? type.color : '#ffffff';
  typeColorPicker.value = type ? (type.color.startsWith('#') ? type.color : '#ffffff') : '#ffffff';
  typeKindSelect.value = type ? type.type : 'absence';
  if (typeDisplaySelect) {
    typeDisplaySelect.value = type ? (type.display || 'middle') : 'middle';
  }
  typeReductionInput.value = type ? (type.reduction !== undefined ? type.reduction : 100) : 100;

  reductionContainer.style.display = typeKindSelect.value === 'absence' ? 'block' : 'none';
  deleteTypeBtn.style.display = (type && type.id !== 'none') ? 'inline-block' : 'none';

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
    display: typeDisplaySelect ? typeDisplaySelect.value : 'middle',
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

function getTypeObj(typeId) {
  return planningTypes.find(t => t.id === typeId) || { id: typeId, label: typeId, color: '#ffffff', type: 'information', display: 'middle' };
}

function hasTypeActive(dayData, typeId, dayPart = 'full') {
  if (!dayData) return false;
  if (typeof dayData === 'string') {
    return dayData === typeId;
  }
  const typeObj = getTypeObj(typeId);
  const display = typeObj.display || 'middle';

  if (display === 'left') {
    if (typeId === 'readiness') {
      if (dayPart === 'morning') return dayData.morningReadiness === 'Readiness' || dayData.morningLeft === 'readiness';
      if (dayPart === 'afternoon') return dayData.afternoonReadiness === 'Readiness' || dayData.afternoonLeft === 'readiness';
      return (dayData.readiness === 'Readiness' || dayData.left === 'readiness') ||
             (dayData.morningReadiness === 'Readiness' && dayData.afternoonReadiness === 'Readiness') ||
             (dayData.morningLeft === 'readiness' && dayData.afternoonLeft === 'readiness');
    }
    if (dayPart === 'morning') return dayData.morningLeft === typeId || !!dayData['morning_' + typeId];
    if (dayPart === 'afternoon') return dayData.afternoonLeft === typeId || !!dayData['afternoon_' + typeId];
    return (dayData.left === typeId || !!dayData[typeId]) ||
           (dayData.morningLeft === typeId && dayData.afternoonLeft === typeId);
  }

  if (display === 'right') {
    if (typeId === 'place') {
      if (dayPart === 'morning') return !!dayData.morningPlace || !!dayData.place || dayData.morningRight === 'place';
      if (dayPart === 'afternoon') return !!dayData.afternoonPlace || !!dayData.place || dayData.afternoonRight === 'place';
      return !!dayData.place || !!dayData.right || (!!dayData.morningPlace && !!dayData.afternoonPlace);
    }
    if (dayPart === 'morning') return dayData.morningRight === typeId || !!dayData['morning_' + typeId];
    if (dayPart === 'afternoon') return dayData.afternoonRight === typeId || !!dayData['afternoon_' + typeId];
    return (dayData.right === typeId || !!dayData[typeId]) ||
           (dayData.morningRight === typeId && dayData.afternoonRight === typeId);
  }

  // Middle display
  const { morningStatus, afternoonStatus } = getDayStatuses(dayData);
  if (typeId === 'freetext') {
    return dayData.status === 'freetext';
  }
  if (dayPart === 'morning') return morningStatus === typeId;
  if (dayPart === 'afternoon') return afternoonStatus === typeId;
  return morningStatus === typeId && afternoonStatus === typeId;
}

function getSidebarInfo(dayData, side) {
  if (!dayData || typeof dayData !== 'object') {
    return { morningText: '', afternoonText: '', morningColor: '', afternoonColor: '', morningBg: '', afternoonBg: '' };
  }

  let morningText = '';
  let afternoonText = '';
  let morningType = null;
  let afternoonType = null;

  if (side === 'left') {
    if (dayData.morningReadiness) {
      morningText = dayData.morningReadiness;
      morningType = getTypeObj('readiness');
    } else if (dayData.readiness) {
      morningText = dayData.readiness;
      morningType = getTypeObj('readiness');
    }
    if (dayData.afternoonReadiness) {
      afternoonText = dayData.afternoonReadiness;
      afternoonType = getTypeObj('readiness');
    } else if (dayData.readiness) {
      afternoonText = dayData.readiness;
      afternoonType = getTypeObj('readiness');
    }

    if (dayData.morningLeft) {
      const t = getTypeObj(dayData.morningLeft);
      morningText = (dayData['morning_' + dayData.morningLeft] || t.label || dayData.morningLeft);
      morningType = t;
    } else if (dayData.left) {
      const t = getTypeObj(dayData.left);
      morningText = (dayData[dayData.left] || t.label || dayData.left);
      morningType = t;
    }

    if (dayData.afternoonLeft) {
      const t = getTypeObj(dayData.afternoonLeft);
      afternoonText = (dayData['afternoon_' + dayData.afternoonLeft] || t.label || dayData.afternoonLeft);
      afternoonType = t;
    } else if (dayData.left) {
      const t = getTypeObj(dayData.left);
      afternoonText = (dayData[dayData.left] || t.label || dayData.left);
      afternoonType = t;
    }

    if (!morningText || !afternoonText) {
      const leftTypes = planningTypes.filter(tp => tp.display === 'left' && tp.id !== 'readiness');
      for (const t of leftTypes) {
        if (!morningText && (dayData['morning_' + t.id] || dayData[t.id])) {
          morningText = dayData['morning_' + t.id] || dayData[t.id] || t.label || t.id;
          morningType = t;
        }
        if (!afternoonText && (dayData['afternoon_' + t.id] || dayData[t.id])) {
          afternoonText = dayData['afternoon_' + t.id] || dayData[t.id] || t.label || t.id;
          afternoonType = t;
        }
      }
    }
  } else if (side === 'right') {
    if (dayData.morningPlace) {
      morningText = dayData.morningPlace;
      morningType = getTypeObj('place');
    } else if (dayData.place) {
      morningText = dayData.place;
      morningType = getTypeObj('place');
    }
    if (dayData.afternoonPlace) {
      afternoonText = dayData.afternoonPlace;
      afternoonType = getTypeObj('place');
    } else if (dayData.place) {
      afternoonText = dayData.place;
      afternoonType = getTypeObj('place');
    }

    if (dayData.morningRight) {
      const t = getTypeObj(dayData.morningRight);
      morningText = (dayData['morning_' + dayData.morningRight] || t.label || dayData.morningRight);
      morningType = t;
    } else if (dayData.right) {
      const t = getTypeObj(dayData.right);
      morningText = (dayData[dayData.right] || t.label || dayData.right);
      morningType = t;
    }

    if (dayData.afternoonRight) {
      const t = getTypeObj(dayData.afternoonRight);
      afternoonText = (dayData['afternoon_' + dayData.afternoonRight] || t.label || dayData.afternoonRight);
      afternoonType = t;
    } else if (dayData.right) {
      const t = getTypeObj(dayData.right);
      afternoonText = (dayData[dayData.right] || t.label || dayData.right);
      afternoonType = t;
    }

    if (!morningText || !afternoonText) {
      const rightTypes = planningTypes.filter(tp => tp.display === 'right' && tp.id !== 'place');
      for (const t of rightTypes) {
        if (!morningText && (dayData['morning_' + t.id] || dayData[t.id])) {
          morningText = dayData['morning_' + t.id] || dayData[t.id] || t.label || t.id;
          morningType = t;
        }
        if (!afternoonText && (dayData['afternoon_' + t.id] || dayData[t.id])) {
          afternoonText = dayData['afternoon_' + t.id] || dayData[t.id] || t.label || t.id;
          afternoonType = t;
        }
      }
    }
  }

  const morningColor = (morningType && morningType.color) || (side === 'left' ? '#d32f2f' : '#1976d2');
  const afternoonColor = (afternoonType && afternoonType.color) || (side === 'left' ? '#d32f2f' : '#1976d2');
  const morningBg = getLightBgColor(morningColor);
  const afternoonBg = getLightBgColor(afternoonColor);

  return { morningText, afternoonText, morningColor, afternoonColor, morningBg, afternoonBg };
}

function renderSidebar(sidebarEl, info, isBold = false) {
  const { morningText, afternoonText, morningColor, afternoonColor, morningBg, afternoonBg } = info;

  const styleSubDiv = (div, hasText, color, bg) => {
    div.style.flex = '1 1 0%';
    div.style.minHeight = '0';
    div.style.minWidth = '0';
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.justifyContent = 'center';
    if (color) div.style.color = color;
    if (bg) div.style.background = bg;
    if (isBold) div.style.fontWeight = 'bold';
    if (hasText) {
      div.style.writingMode = 'vertical-rl';
      div.style.textOrientation = 'mixed';
      div.style.overflow = 'hidden';
      div.style.whiteSpace = 'nowrap';
    }
  };

  if (morningText && afternoonText) {
    if (morningText === afternoonText && morningColor === afternoonColor) {
      const fullDiv = document.createElement('div');
      styleSubDiv(fullDiv, true, morningColor, morningBg);
      fullDiv.textContent = morningText;
      sidebarEl.appendChild(fullDiv);
    } else {
      const amDiv = document.createElement('div');
      styleSubDiv(amDiv, true, morningColor, morningBg);
      amDiv.style.borderBottom = '1px solid rgba(0,0,0,0.05)';
      amDiv.textContent = morningText;
      sidebarEl.appendChild(amDiv);

      const pmDiv = document.createElement('div');
      styleSubDiv(pmDiv, true, afternoonColor, afternoonBg);
      pmDiv.textContent = afternoonText;
      sidebarEl.appendChild(pmDiv);
    }
  } else if (morningText) {
    const amDiv = document.createElement('div');
    styleSubDiv(amDiv, true, morningColor, morningBg);
    amDiv.style.borderBottom = '1px solid rgba(0,0,0,0.05)';
    amDiv.textContent = morningText;
    sidebarEl.appendChild(amDiv);

    const pmDiv = document.createElement('div');
    styleSubDiv(pmDiv, false, null, null);
    sidebarEl.appendChild(pmDiv);
  } else if (afternoonText) {
    const amDiv = document.createElement('div');
    styleSubDiv(amDiv, false, null, null);
    amDiv.style.borderBottom = '1px solid rgba(0,0,0,0.05)';
    sidebarEl.appendChild(amDiv);

    const pmDiv = document.createElement('div');
    styleSubDiv(pmDiv, true, afternoonColor, afternoonBg);
    pmDiv.textContent = afternoonText;
    sidebarEl.appendChild(pmDiv);
  } else {
    sidebarEl.style.border = 'none';
  }
}

function applyTypeToDayData(dayData, typeId, dayPart, customVal = null) {
  const typeObj = getTypeObj(typeId);
  const display = typeObj.display || 'middle';

  if (display === 'left') {
    const isDelete = (customVal === null);
    if (typeId === 'readiness') {
      const val = isDelete ? null : 'Readiness';
      if (dayPart === 'morning') {
        if (val) {
          dayData.morningReadiness = val;
          dayData.morningLeft = 'readiness';
        } else {
          delete dayData.morningReadiness;
          delete dayData.morningLeft;
        }
        if (dayData.morningReadiness && dayData.afternoonReadiness) {
          dayData.readiness = 'Readiness';
          dayData.left = 'readiness';
        } else {
          delete dayData.readiness;
          delete dayData.left;
        }
      } else if (dayPart === 'afternoon') {
        if (val) {
          dayData.afternoonReadiness = val;
          dayData.afternoonLeft = 'readiness';
        } else {
          delete dayData.afternoonReadiness;
          delete dayData.afternoonLeft;
        }
        if (dayData.morningReadiness && dayData.afternoonReadiness) {
          dayData.readiness = 'Readiness';
          dayData.left = 'readiness';
        } else {
          delete dayData.readiness;
          delete dayData.left;
        }
      } else {
        if (val) {
          dayData.readiness = val;
          dayData.morningReadiness = val;
          dayData.afternoonReadiness = val;
          dayData.left = 'readiness';
          dayData.morningLeft = 'readiness';
          dayData.afternoonLeft = 'readiness';
        } else {
          delete dayData.readiness;
          delete dayData.morningReadiness;
          delete dayData.afternoonReadiness;
          delete dayData.left;
          delete dayData.morningLeft;
          delete dayData.afternoonLeft;
        }
      }
    } else {
      const val = isDelete ? null : (customVal || typeObj.label || typeId);
      if (dayPart === 'morning') {
        if (val) {
          dayData.morningLeft = typeId;
          dayData['morning_' + typeId] = val;
        } else {
          delete dayData.morningLeft;
          delete dayData['morning_' + typeId];
        }
        if (dayData.morningLeft && dayData.morningLeft === dayData.afternoonLeft) {
          dayData.left = typeId;
          dayData[typeId] = val;
        } else {
          delete dayData.left;
          delete dayData[typeId];
        }
      } else if (dayPart === 'afternoon') {
        if (val) {
          dayData.afternoonLeft = typeId;
          dayData['afternoon_' + typeId] = val;
        } else {
          delete dayData.afternoonLeft;
          delete dayData['afternoon_' + typeId];
        }
        if (dayData.afternoonLeft && dayData.morningLeft === dayData.afternoonLeft) {
          dayData.left = typeId;
          dayData[typeId] = val;
        } else {
          delete dayData.left;
          delete dayData[typeId];
        }
      } else {
        if (val) {
          dayData.left = typeId;
          dayData.morningLeft = typeId;
          dayData.afternoonLeft = typeId;
          dayData[typeId] = val;
          dayData['morning_' + typeId] = val;
          dayData['afternoon_' + typeId] = val;
        } else {
          delete dayData.left;
          delete dayData.morningLeft;
          delete dayData.afternoonLeft;
          delete dayData[typeId];
          delete dayData['morning_' + typeId];
          delete dayData['afternoon_' + typeId];
        }
      }
    }
  } else if (display === 'right') {
    if (typeId === 'place') {
      const isDelete = (!customVal || customVal.trim() === '' || customVal.trim().toLowerCase() === 'none' || customVal.trim().toLowerCase() === 'clear');
      if (isDelete) {
        if (dayPart === 'morning') {
          delete dayData.morningPlace;
          delete dayData.morningRight;
          if (dayData.place) {
            dayData.afternoonPlace = dayData.place;
            dayData.afternoonRight = dayData.place;
            delete dayData.place;
            delete dayData.right;
          }
        } else if (dayPart === 'afternoon') {
          delete dayData.afternoonPlace;
          delete dayData.afternoonRight;
          if (dayData.place) {
            dayData.morningPlace = dayData.place;
            dayData.morningRight = dayData.place;
            delete dayData.place;
            delete dayData.right;
          }
        } else {
          delete dayData.place;
          delete dayData.morningPlace;
          delete dayData.afternoonPlace;
          delete dayData.right;
          delete dayData.morningRight;
          delete dayData.afternoonRight;
        }
      } else {
        const cleanVal = customVal.trim();
        if (dayPart === 'morning') {
          dayData.morningPlace = cleanVal;
          dayData.morningRight = cleanVal;
          if (dayData.afternoonPlace === cleanVal || dayData.afternoonRight === cleanVal) {
            dayData.place = cleanVal;
            dayData.right = cleanVal;
          } else {
            delete dayData.place;
            delete dayData.right;
          }
        } else if (dayPart === 'afternoon') {
          dayData.afternoonPlace = cleanVal;
          dayData.afternoonRight = cleanVal;
          if (dayData.morningPlace === cleanVal || dayData.morningRight === cleanVal) {
            dayData.place = cleanVal;
            dayData.right = cleanVal;
          } else {
            delete dayData.place;
            delete dayData.right;
          }
        } else {
          dayData.place = cleanVal;
          dayData.morningPlace = cleanVal;
          dayData.afternoonPlace = cleanVal;
          dayData.right = cleanVal;
          dayData.morningRight = cleanVal;
          dayData.afternoonRight = cleanVal;
        }
      }
    } else {
      const isDelete = (customVal === null);
      const val = isDelete ? null : (customVal || typeObj.label || typeId);
      if (dayPart === 'morning') {
        if (val) {
          dayData.morningRight = typeId;
          dayData['morning_' + typeId] = val;
        } else {
          delete dayData.morningRight;
          delete dayData['morning_' + typeId];
        }
        if (dayData.morningRight && dayData.morningRight === dayData.afternoonRight) {
          dayData.right = typeId;
          dayData[typeId] = val;
        } else {
          delete dayData.right;
          delete dayData[typeId];
        }
      } else if (dayPart === 'afternoon') {
        if (val) {
          dayData.afternoonRight = typeId;
          dayData['afternoon_' + typeId] = val;
        } else {
          delete dayData.afternoonRight;
          delete dayData['afternoon_' + typeId];
        }
        if (dayData.afternoonRight && dayData.morningRight === dayData.afternoonRight) {
          dayData.right = typeId;
          dayData[typeId] = val;
        } else {
          delete dayData.right;
          delete dayData[typeId];
        }
      } else {
        if (val) {
          dayData.right = typeId;
          dayData.morningRight = typeId;
          dayData.afternoonRight = typeId;
          dayData[typeId] = val;
          dayData['morning_' + typeId] = val;
          dayData['afternoon_' + typeId] = val;
        } else {
          delete dayData.right;
          delete dayData.morningRight;
          delete dayData.afternoonRight;
          delete dayData[typeId];
          delete dayData['morning_' + typeId];
          delete dayData['afternoon_' + typeId];
        }
      }
    }
  } else {
    // Middle display
    if (typeId === 'freetext') {
      if (customVal === null) {
        dayData.status = 'none';
        delete dayData.freetext;
        delete dayData.morningStatus;
        delete dayData.afternoonStatus;
      } else {
        dayData.status = 'freetext';
        dayData.freetext = customVal;
        delete dayData.morningStatus;
        delete dayData.afternoonStatus;
      }
    } else {
      const targetVal = customVal !== null ? customVal : typeId;
      if (dayPart === 'morning') {
        let { morningStatus: mS, afternoonStatus: aS } = getDayStatuses(dayData);
        dayData.morningStatus = targetVal;
        dayData.afternoonStatus = aS;
        dayData.status = (targetVal === aS) ? targetVal : 'none';
      } else if (dayPart === 'afternoon') {
        let { morningStatus: mS, afternoonStatus: aS } = getDayStatuses(dayData);
        dayData.morningStatus = mS;
        dayData.afternoonStatus = targetVal;
        dayData.status = (mS === targetVal) ? mS : 'none';
      } else {
        dayData.morningStatus = targetVal;
        dayData.afternoonStatus = targetVal;
        dayData.status = targetVal;
      }
    }
  }
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
        if (hasTypeActive(dayData, selectedFilter, 'morning') || hasTypeActive(dayData, selectedFilter, 'afternoon') || hasTypeActive(dayData, selectedFilter, 'full')) {
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
        const mSettings = (currentPlanning.memberSettings && currentPlanning.memberSettings[member]) || { workingDays: [1, 2, 3, 4, 5] };
        days = days.filter(ds => mSettings.workingDays.includes(new Date(ds + 'T00:00:00').getDay()));
        let val = initialValue;

        const selectedTypeObj = getTypeObj(selectedStatus);
        const display = selectedTypeObj.display || 'middle';

        if (selectedStatus === 'place' && val === null) {
          val = prompt(`Set Place for ${member} for this week:`, lastPlaceInput);
          if (val === null) return;
        } else if (selectedStatus === 'freetext' && val === null) {
          val = prompt(`Enter Free Text for ${member} for this week:`, '');
          if (val === null) return;
        } else if (val === null) {
          const allHaveIt = days.every(ds => {
            const dD = currentPlanning.days[ds] && currentPlanning.days[ds][member];
            return hasTypeActive(dD, selectedStatus, selectedDayPart);
          });
          val = allHaveIt ? null : (selectedTypeObj.label || selectedStatus);
        }

        if (selectedStatus === 'place' && val !== null) {
          const isDelete = !val || val.trim() === '' || val.trim().toLowerCase() === 'none' || val.trim().toLowerCase() === 'clear';
          if (!isDelete) setLastPlaceInput(val.trim());
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

          applyTypeToDayData(dayData, selectedStatus, selectedDayPart, val);
          currentPlanning.days[ds][member] = dayData;
        });
      };

      weekLabelTd.onclick = () => {
        const daysInWeek = getDaysInWeek();
        let bulkVal = null;
        const selectedTypeObj = getTypeObj(selectedStatus);

        if (selectedStatus === 'place') {
          bulkVal = prompt(`Set Place for all members for this week:`, lastPlaceInput);
          if (bulkVal === null) return;
          const isDelete = !bulkVal || bulkVal.trim() === '' || bulkVal.trim().toLowerCase() === 'none' || bulkVal.trim().toLowerCase() === 'clear';
          if (!isDelete) {
            setLastPlaceInput(bulkVal.trim());
          }
        } else if (selectedStatus === 'freetext') {
          bulkVal = prompt(`Enter Free Text for all members for this week:`, '');
          if (bulkVal === null) return;
        } else {
          let allHaveIt = true;
          for (const mObj of memberListOrdered) {
            const mSettings = (currentPlanning.memberSettings && currentPlanning.memberSettings[mObj.name]) || { workingDays: [1, 2, 3, 4, 5] };
            const memberDaysInWeek = daysInWeek.filter(ds => mSettings.workingDays.includes(new Date(ds + 'T00:00:00').getDay()));
            for (const ds of memberDaysInWeek) {
              const dD = currentPlanning.days[ds] && currentPlanning.days[ds][mObj.name];
              if (!hasTypeActive(dD, selectedStatus, selectedDayPart)) {
                allHaveIt = false;
                break;
              }
            }
            if (!allHaveIt) break;
          }
          bulkVal = allHaveIt ? null : (selectedTypeObj.label || selectedStatus);
        }

        // Check if any target cell (on working days) already has an entry
        let hasAnyExisting = false;
        for (const mObj of memberListOrdered) {
          const mSettings = (currentPlanning.memberSettings && currentPlanning.memberSettings[mObj.name]) || { workingDays: [1, 2, 3, 4, 5] };
          const memberDaysInWeek = daysInWeek.filter(ds => mSettings.workingDays.includes(new Date(ds + 'T00:00:00').getDay()));
          for (const ds of memberDaysInWeek) {
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
          const allDaysInWeek = getDaysInWeek();
          const mSettings = (currentPlanning.memberSettings && currentPlanning.memberSettings[member]) || { workingDays: [1, 2, 3, 4, 5] };
          const daysInWeek = allDaysInWeek.filter(ds => mSettings.workingDays.includes(new Date(ds + 'T00:00:00').getDay()));

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
          if (status === selectedFilter || morningStatus === selectedFilter || afternoonStatus === selectedFilter) {
            return true;
          }
          if (hasTypeActive(dayData, selectedFilter, 'morning') || hasTypeActive(dayData, selectedFilter, 'afternoon') || hasTypeActive(dayData, selectedFilter, 'full')) {
            return true;
          }
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

      const selectedTypeObj = getTypeObj(selectedStatus);
      const display = selectedTypeObj.display || 'middle';

      let dayVal = null;
      if (selectedStatus === 'place') {
        dayVal = prompt(`Set Place for all members on ${dateStr}:`, lastPlaceInput);
        if (dayVal === null) return;
        const isDelete = !dayVal || dayVal.trim() === '' || dayVal.trim().toLowerCase() === 'none' || dayVal.trim().toLowerCase() === 'clear';
        if (!isDelete) {
          setLastPlaceInput(dayVal.trim());
        }
      } else if (selectedStatus === 'freetext') {
        dayVal = prompt(`Enter Free Text for all members on ${dateStr}:`, '');
        if (dayVal === null) return;
      } else {
        const allHaveIt = memberListOrdered.every(mO => {
          const dD = currentPlanning.days[dateStr] && currentPlanning.days[dateStr][mO.name];
          return hasTypeActive(dD, selectedStatus, selectedDayPart);
        });
        dayVal = allHaveIt ? null : (selectedTypeObj.label || selectedStatus);
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

        applyTypeToDayData(dayData, selectedStatus, selectedDayPart, dayVal);
        currentPlanning.days[dateStr][member] = dayData;
      });
      renderPlanning();
      triggerAutosave();
    };
    tr.appendChild(dateTd);

    memberListOrdered.forEach(mObj => {
      const member = mObj.name;
      const mSettings = (currentPlanning.memberSettings && currentPlanning.memberSettings[member]) || { workingDays: [1, 2, 3, 4, 5] };
      const isWorkingDay = mSettings.workingDays.includes(d.getDay());
      const td = document.createElement('td');
      td.className = 'planning-cell';
      const dayData = (currentPlanning.days[dateStr] && currentPlanning.days[dateStr][member]) || 'none';
      const { morningStatus, afternoonStatus } = getDayStatuses(dayData);
      const status = (typeof dayData === 'object') ? dayData.status : dayData;

      const leftInfo = getSidebarInfo(dayData, 'left');
      const rightInfo = getSidebarInfo(dayData, 'right');
      const matchesLeft = hasTypeActive(dayData, selectedFilter, 'morning') || hasTypeActive(dayData, selectedFilter, 'afternoon') || hasTypeActive(dayData, selectedFilter, 'full');

      const cellMatchesFilter = (selectedFilter === 'all') ||
                                (status === selectedFilter) ||
                                (morningStatus === selectedFilter) ||
                                (afternoonStatus === selectedFilter) ||
                                matchesLeft;

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

        // Left Sidebar (20%)
        const rSidebar = document.createElement('div');
        rSidebar.className = 'cell-readiness-sidebar';
        rSidebar.style.background = 'transparent';
        rSidebar.style.writingMode = 'horizontal-tb';
        rSidebar.style.height = '100%';
        rSidebar.style.minHeight = '0';
        rSidebar.style.minWidth = '0';
        rSidebar.style.display = 'flex';
        rSidebar.style.flexDirection = 'column';
        rSidebar.style.alignItems = 'stretch';
        renderSidebar(rSidebar, leftInfo, true);
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

        // Right Sidebar (20%)
        const pSidebar = document.createElement('div');
        pSidebar.className = 'cell-place-sidebar';
        pSidebar.style.background = 'transparent';
        pSidebar.style.writingMode = 'horizontal-tb';
        pSidebar.style.height = '100%';
        pSidebar.style.minHeight = '0';
        pSidebar.style.minWidth = '0';
        pSidebar.style.display = 'flex';
        pSidebar.style.flexDirection = 'column';
        pSidebar.style.alignItems = 'stretch';
        renderSidebar(pSidebar, rightInfo, false);
        contentDiv.appendChild(pSidebar);
      }

      td.onclick = (e) => {
        if (!currentPlanning.days[dateStr]) currentPlanning.days[dateStr] = {};
        let dayData = currentPlanning.days[dateStr][member] || 'none';
        if (typeof dayData !== 'object' || dayData === null) {
          dayData = { status: dayData || 'none' };
        }

        const selectedTypeObj = getTypeObj(selectedStatus);
        const display = selectedTypeObj.display || 'middle';

        if (selectedStatus === 'place') {
          const currentVal = (selectedDayPart === 'morning') ? (dayData.morningPlace || dayData.morningRight || '') :
                             (selectedDayPart === 'afternoon') ? (dayData.afternoonPlace || dayData.afternoonRight || '') :
                             (dayData.place || dayData.right || '');
          const val = prompt(`Set Place for ${member} on ${dateStr}:`, currentVal || lastPlaceInput);
          if (val !== null) {
            applyTypeToDayData(dayData, 'place', selectedDayPart, val);
            const isDelete = !val || val.trim() === '' || val.trim().toLowerCase() === 'none' || val.trim().toLowerCase() === 'clear';
            if (!isDelete) setLastPlaceInput(val.trim());
          }
        } else if (selectedStatus === 'freetext') {
          const currentStatus = dayData.status || 'none';
          if (currentStatus === 'freetext') {
            applyTypeToDayData(dayData, 'freetext', selectedDayPart, null);
          } else {
            const val = prompt(`Enter Free Text for ${member} on ${dateStr}:`, dayData.freetext || '');
            if (val !== null) {
              applyTypeToDayData(dayData, 'freetext', selectedDayPart, val);
            }
          }
        } else if (display === 'left' || display === 'right') {
          const isActive = hasTypeActive(dayData, selectedStatus, selectedDayPart);
          applyTypeToDayData(dayData, selectedStatus, selectedDayPart, isActive ? null : selectedTypeObj.label || selectedStatus);
        } else {
          if (selectedDayPart === 'morning') {
            let { morningStatus: mS } = getDayStatuses(dayData);
            const targetVal = (selectedStatus === 'none') ? 'none' : ((mS === selectedStatus) ? 'none' : selectedStatus);
            applyTypeToDayData(dayData, targetVal, 'morning', targetVal);
          } else if (selectedDayPart === 'afternoon') {
            let { afternoonStatus: aS } = getDayStatuses(dayData);
            const targetVal = (selectedStatus === 'none') ? 'none' : ((aS === selectedStatus) ? 'none' : selectedStatus);
            applyTypeToDayData(dayData, targetVal, 'afternoon', targetVal);
          } else {
            let { morningStatus: mS, afternoonStatus: aS } = getDayStatuses(dayData);
            let targetVal = 'none';
            if (selectedStatus !== 'none') {
              if (mS === selectedStatus && aS === selectedStatus) targetVal = 'none';
              else targetVal = selectedStatus;
            }
            applyTypeToDayData(dayData, targetVal, 'full', targetVal);
          }
        }

        currentPlanning.days[dateStr][member] = dayData;
        renderPlanning();
        triggerAutosave();
      };

      if (!isWorkingDay) {
        td.classList.add('non-working-day');
      }
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

// Load button wiring
loadBtn.onclick = () => {
  loadPlanning();
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

