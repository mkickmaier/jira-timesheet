const piNameInput = document.getElementById('piName');
const loadBtn = document.getElementById('loadBtn');
const statusDiv = document.getElementById('status');
const resultsCard = document.getElementById('resultsCard');
const piTitle = document.getElementById('piTitle');
const lastRefreshedDisplay = document.getElementById('lastRefreshed');
const tableHeader = document.getElementById('tableHeader');
const tableBody = document.getElementById('tableBody');
const detailsModal = document.getElementById('detailsModal');
const closeModal = document.getElementById('closeModal');
const modalTitle = document.getElementById('modalTitle');
const ticketsList = document.getElementById('ticketsList');
const dailyCapacity = document.getElementById('dailyCapacity');

let currentData = null;

// Assume 8 hours per day, 5 days per week, 2 weeks per iteration = 80 hours
// This is a fallback if no baseline capacity is found in Excel.
const DEFAULT_CAPACITY_HOURS = 80;
const DEFAULT_CAPACITY_SECONDS = DEFAULT_CAPACITY_HOURS * 3600;

// Persist PI name
piNameInput.value = localStorage.getItem('lastPiName') || '';

// Load last cached data
const lastData = localStorage.getItem('lastCapacityData');
if (lastData) {
  try {
    currentData = JSON.parse(lastData);
    renderTable(currentData);
  } catch (e) {
    console.warn('Failed to load cached capacity data:', e);
  }
}

function formatTime(seconds) {
  if (seconds === 0) return '0h';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h${m > 0 ? ' ' + m + 'm' : ''}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getBaselineCapacity(data, memberName, iteration) {
  if (data.baselineCapacity && data.baselineCapacity.capacity[memberName]) {
    return data.baselineCapacity.capacity[memberName][iteration] || 0;
  }

  // Fallback: calculate based on iteration dates
  const dates = data.iterationDates && data.iterationDates[iteration];
  if (dates && dates.startDate && dates.endDate) {
    const start = new Date(dates.startDate);
    const end = new Date(dates.endDate);
    let workdays = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) { // Skip Sat (6) and Sun (0)
        workdays++;
      }
    }
    return workdays * 8 * 3600; // 8 hours per day in seconds
  }

  return DEFAULT_CAPACITY_SECONDS;
}

async function loadCapacity() {
  const pi = piNameInput.value.trim();
  if (!pi) {
    statusDiv.innerHTML = '<div class="error">Please enter a PI name.</div>';
    return;
  }

  localStorage.setItem('lastPiName', pi);

  statusDiv.innerHTML = '<div class="loading">Fetching data from Jira...</div>';
  resultsCard.style.display = 'none';

  try {
    const res = await fetch(`/api/capacity?pi=${encodeURIComponent(pi)}`);
    const data = await res.json();

    if (!res.ok) {
      statusDiv.innerHTML = `<div class="error">Error: ${data.error || data.message || 'Failed to fetch'}</div>`;
      return;
    }

    if (data.iterations.length === 0) {
      statusDiv.innerHTML = '<div class="error">No iterations found for this PI.</div>';
      return;
    }

    currentData = data;
    if (data.jiraBaseUrl) {
        localStorage.setItem('jiraBaseUrl', data.jiraBaseUrl);
    }
    data.refreshTimestamp = new Date().toLocaleString();
    localStorage.setItem('lastCapacityData', JSON.stringify(data));

    statusDiv.innerHTML = '';
    renderTable(data);
  } catch (e) {
    statusDiv.innerHTML = `<div class="error">Failed to load capacity: ${e.message}</div>`;
  }
}

function renderTable(data) {
  piTitle.textContent = `Capacity Planning for PI: ${data.pi}`;
  if (data.refreshTimestamp) {
    lastRefreshedDisplay.textContent = `Last refreshed: ${data.refreshTimestamp}`;
  } else {
    lastRefreshedDisplay.textContent = '';
  }

  // Clear headers except first
  while (tableHeader.cells.length > 1) {
    tableHeader.deleteCell(1);
  }

  // Add iteration headers
  data.iterations.forEach(it => {
    const th = document.createElement('th');
    th.className = 'capacity-cell';

    const itName = document.createElement('div');
    itName.textContent = it;
    th.appendChild(itName);

    const dates = data.iterationDates && data.iterationDates[it];
    if (dates && (dates.startDate || dates.endDate)) {
      const dateRange = document.createElement('div');
      dateRange.style.fontSize = '0.75em';
      dateRange.style.fontWeight = 'normal';
      dateRange.style.color = '#666';
      dateRange.textContent = `${formatDate(dates.startDate)} - ${formatDate(dates.endDate)}`;
      th.appendChild(dateRange);
    } else {
      const noDates = document.createElement('div');
      noDates.style.fontSize = '0.7em';
      noDates.style.fontWeight = 'normal';
      noDates.style.color = '#999';
      noDates.textContent = '(no dates set)';
      th.appendChild(noDates);
    }

    tableHeader.appendChild(th);
  });

  // Total header
  const totalTh = document.createElement('th');
  totalTh.textContent = 'Total';
  totalTh.className = 'capacity-cell';
  tableHeader.appendChild(totalTh);

  // Render body
  tableBody.innerHTML = '';
  data.members.forEach(member => {
    const tr = document.createElement('tr');

    const nameTd = document.createElement('td');
    nameTd.textContent = member.name;
    tr.appendChild(nameTd);

    let memberTotalPlanned = 0;
    let memberTotalCapacity = 0;
    data.iterations.forEach(it => {
      const plannedSeconds = member.capacity[it] || 0;
      const capacitySeconds = getBaselineCapacity(data, member.name, it);

      memberTotalPlanned += plannedSeconds;
      memberTotalCapacity += capacitySeconds;

      const td = document.createElement('td');
      td.className = 'capacity-cell clickable-cell';
      td.onclick = () => showDetails(member.name, it);

      const planSpan = document.createElement('div');
      planSpan.textContent = formatTime(plannedSeconds);
      td.appendChild(planSpan);

      const capaSpan = document.createElement('div');
      capaSpan.style.fontSize = '0.8em';
      capaSpan.style.color = '#666';
      capaSpan.textContent = `of ${formatTime(capacitySeconds)}`;
      td.appendChild(capaSpan);

      // Over-planning detection
      if (plannedSeconds > capacitySeconds && capacitySeconds > 0) {
        const overPercent = (plannedSeconds - capacitySeconds) / capacitySeconds;
        if (overPercent > 0.05) {
          td.classList.add('over-planned');
          td.title = `Over-planned by more than 5%! Capacity: ${formatTime(capacitySeconds)}`;
        } else {
          td.classList.add('warning-planned');
          td.title = `Over-planned by up to 5%! Capacity: ${formatTime(capacitySeconds)}`;
        }
      }

      tr.appendChild(td);
    });

    const totalTd = document.createElement('td');
    totalTd.className = 'capacity-cell';

    const totalPlanDiv = document.createElement('div');
    totalPlanDiv.textContent = formatTime(memberTotalPlanned);
    totalTd.appendChild(totalPlanDiv);

    const totalCapaDiv = document.createElement('div');
    totalCapaDiv.style.fontSize = '0.8em';
    totalCapaDiv.style.color = '#666';
    totalCapaDiv.textContent = `of ${formatTime(memberTotalCapacity)}`;
    totalTd.appendChild(totalCapaDiv);

    if (memberTotalPlanned > memberTotalCapacity && memberTotalCapacity > 0) {
      const totalOverPercent = (memberTotalPlanned - memberTotalCapacity) / memberTotalCapacity;
      if (totalOverPercent > 0.05) {
        totalTd.classList.add('over-planned');
      } else {
        totalTd.classList.add('warning-planned');
      }
    }
    tr.appendChild(totalTd);

    tableBody.appendChild(tr);
  });

  resultsCard.style.display = 'block';
}

function showDetails(memberName, iteration) {
  if (!currentData) return;

  modalTitle.textContent = `Details for ${memberName} - Iteration ${iteration}`;

  // Render Tickets
  const issues = (currentData.issueDetails && currentData.issueDetails[memberName] && currentData.issueDetails[memberName][iteration]) || [];
  if (issues.length === 0) {
    ticketsList.innerHTML = '<p>No tickets planned for this iteration.</p>';
  } else {
    let html = '<table class="details-table"><thead><tr><th>Key</th><th>Summary</th><th>Estimate</th></tr></thead><tbody>';
    issues.forEach(issue => {
      html += `<tr>
        <td><a href="${localStorage.getItem('jiraBaseUrl') || ''}/browse/${issue.key}" target="_blank">${issue.key}</a></td>
        <td>${issue.summary}</td>
        <td>${formatTime(issue.estimate)}</td>
      </tr>`;
    });
    html += '</tbody></table>';
    ticketsList.innerHTML = html;
  }

  // Render Daily Capacity
  const breakdown = (currentData.baselineCapacity && currentData.baselineCapacity.dayBreakdown &&
                     currentData.baselineCapacity.dayBreakdown[memberName] &&
                     currentData.baselineCapacity.dayBreakdown[memberName][iteration]) || [];

  if (breakdown.length === 0) {
    dailyCapacity.innerHTML = '<p>No daily capacity information available from planning.</p>';
  } else {
    let html = '<table class="details-table"><thead><tr><th>Date</th><th>Status</th><th>Hours</th></tr></thead><tbody>';
    breakdown.forEach(day => {
      const hours = day.isContractDay ? day.actualHours : 0;
      const rowClass = !day.isContractDay ? 'day-off' : '';

      // Use a local date object to avoid timezone shifts when displaying the date string
      const [y, m, d] = day.date.split('-').map(Number);
      const localDate = new Date(y, m - 1, d);
      const weekday = localDate.toLocaleDateString(undefined, {weekday: 'short'});

      html += `<tr class="${rowClass}">
        <td>${day.date} (${weekday})</td>
        <td>${day.status === 'none' ? '-' : day.status}</td>
        <td>${hours.toFixed(1)}h</td>
      </tr>`;
    });
    html += '</tbody></table>';
    dailyCapacity.innerHTML = html;
  }

  detailsModal.style.display = 'block';
}

closeModal.onclick = () => {
  detailsModal.style.display = 'none';
};

window.onclick = (event) => {
  if (event.target == detailsModal) {
    detailsModal.style.display = 'none';
  }
};

loadBtn.addEventListener('click', loadCapacity);
piNameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') loadCapacity();
});

