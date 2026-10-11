// ============================================================
// DECEPTIGUARD INTERACTIVE FRONTEND APPLICATION
// ============================================================

let currentUser = {
  username: 'admin',
  role: 'admin',
  department: 'IT',
  token: null
};

let socket = null;
let allAlerts = [];
let allFiles = [];
let isAudioEnabled = true;
let isDarkTheme = false;

// Chart instances
let threatChart = null;
let trendChart = null;

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initSocket();
  setupNavigation();
  setupAuth();
  setupPortal();
  setupForensics();
  setupSimulator();
  setupTriageModal();
  setupFilters();

  // Load initial data
  refreshSocDashboard();
  loadPortalFiles();
  loadDecoys();
  loadIncidents();
  loadCustodyLogs();
});

// ================= 1. THEME & AUDIO CONTROLS =================
function initTheme() {
  const savedTheme = localStorage.getItem('deceptiguard_theme');
  if (savedTheme === 'dark') {
    setTheme(true);
  } else {
    setTheme(false); // Default Light Theme
  }

  document.getElementById('btn-theme-toggle').addEventListener('click', () => {
    setTheme(!isDarkTheme);
  });

  document.getElementById('btn-sound-toggle').addEventListener('click', () => {
    isAudioEnabled = !isAudioEnabled;
    document.getElementById('sound-icon').textContent = isAudioEnabled ? '🔊' : '🔇';
    document.getElementById('sound-label').textContent = isAudioEnabled ? 'Audio On' : 'Muted';
    showToast(isAudioEnabled ? 'Threat audio notifications enabled' : 'Threat audio muted', 'LOW');
  });
}

function setTheme(dark) {
  isDarkTheme = dark;
  if (dark) {
    document.body.classList.add('dark-theme');
    document.body.classList.remove('light-theme');
    document.getElementById('theme-icon').textContent = '🌙';
    document.getElementById('theme-label').textContent = 'Dark Theme';
    localStorage.setItem('deceptiguard_theme', 'dark');
  } else {
    document.body.classList.remove('dark-theme');
    document.body.classList.add('light-theme');
    document.getElementById('theme-icon').textContent = '☀️';
    document.getElementById('theme-label').textContent = 'Light Theme';
    localStorage.setItem('deceptiguard_theme', 'light');
  }
  updateChartsTheme();
}

function playThreatBeep(isCritical = true) {
  if (!isAudioEnabled) return;
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = isCritical ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(isCritical ? 880 : 587.33, audioCtx.currentTime); // A5 or D5
    osc.frequency.exponentialRampToValueAtTime(isCritical ? 440 : 293.66, audioCtx.currentTime + 0.25);

    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.25);
  } catch (e) {
    // Ignore audio context autoplay restrictions if any
  }
}

// ================= 2. SOCKET.IO INTEGRATION =================
function initSocket() {
  const wsStatus = document.getElementById('ws-status');
  try {
    socket = io(window.location.origin);

    socket.on('connect', () => {
      wsStatus.innerHTML = '<span class="pulse-dot"></span> SOC CONNECTED';
      wsStatus.style.color = 'var(--palette-coral)';
    });

    socket.on('disconnect', () => {
      wsStatus.innerHTML = '⚠️ RECONNECTING';
      wsStatus.style.color = 'var(--palette-gold)';
    });

    socket.on('alert:new', (data) => {
      handleIncomingAlert(data);
    });
  } catch (err) {
    console.error('[Socket Error]', err);
  }
}

function handleIncomingAlert(data) {
  const alert = data.alert;
  allAlerts.unshift(alert);

  playThreatBeep(alert.severity === 'CRITICAL');
  showToast(`🚨 THREAT TRIGGER: ${alert.username} violated ${alert.rulesFired.map(r=>r.ruleId).join(', ')}`, alert.severity);

  renderAlertsTable(allAlerts);
  refreshSocDashboard();
  loadIncidents();
  loadCustodyLogs();
}

// ================= 3. NAVIGATION =================
function setupNavigation() {
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      const targetId = tab.getAttribute('data-tab');
      document.getElementById(targetId).classList.add('active');

      if (targetId === 'soc-tab') refreshSocDashboard();
      if (targetId === 'portal-tab') loadPortalFiles();
      if (targetId === 'deception-tab') loadDecoys();
      if (targetId === 'incidents-tab') loadIncidents();
      if (targetId === 'forensics-tab') loadCustodyLogs();
    });
  });
}

// ================= 4. AUTH & PERSONA SWITCHER =================
function setupAuth() {
  const btnSwitch = document.getElementById('btn-switch-user');
  const modal = document.getElementById('user-modal');
  const btnClose = document.getElementById('btn-close-modal');

  btnSwitch.addEventListener('click', () => modal.classList.add('show'));
  btnClose.addEventListener('click', () => modal.classList.remove('show'));

  document.querySelectorAll('.persona-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const username = btn.getAttribute('data-user');
      await switchUser(username);
      modal.classList.remove('show');
    });
  });

  switchUser('admin', false);
}

async function switchUser(username, notify = true) {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: 'Password123!' })
    });
    const data = await res.json();

    if (!res.ok) {
      if (data.error && username.includes('backup')) {
        playThreatBeep(true);
        showToast(`⚠️ Decoy account access trapped! (Rule R2)`, 'CRITICAL');
        return;
      }
      showToast(data.error || 'Login failed', 'HIGH');
      return;
    }

    currentUser = {
      username: data.user.username,
      role: data.user.role,
      department: data.user.department,
      token: data.token
    };

    document.getElementById('current-username').textContent = currentUser.username;
    document.getElementById('current-user-role').textContent = currentUser.role;

    if (notify) {
      showToast(`Logged in as ${currentUser.username} (${currentUser.role})`, 'LOW');
    }
    loadPortalFiles();
  } catch (err) {
    console.error('[Auth Switch Error]', err);
  }
}

function getAuthHeaders() {
  return {
    'Content-Type': 'application/json',
    ...(currentUser.token ? { 'Authorization': `Bearer ${currentUser.token}` } : {})
  };
}

// ================= 5. SOC DASHBOARD & CHARTS =================
async function refreshSocDashboard() {
  try {
    // Stats
    const statsRes = await fetch('/api/soc/stats');
    const stats = await statsRes.json();
    document.getElementById('kpi-total-alerts').textContent = stats.totalAlerts || 0;
    document.getElementById('kpi-critical-alerts').textContent = stats.criticalAlerts || 0;
    document.getElementById('kpi-open-incidents').textContent = stats.openIncidents || 0;
    document.getElementById('kpi-deception-hit').textContent = `${stats.triggeredDecoys || 2} / ${stats.totalDecoys || 10}`;
    document.getElementById('incident-badge-count').textContent = stats.openIncidents || 0;

    // Alerts
    const alertsRes = await fetch('/api/soc/alerts');
    const alertsData = await alertsRes.json();
    allAlerts = alertsData.alerts || [];
    document.getElementById('filter-count-all').textContent = allAlerts.length;
    renderAlertsTable(allAlerts);

    // Leaderboard
    const lbRes = await fetch('/api/soc/leaderboard');
    const lbData = await lbRes.json();
    renderLeaderboard(lbData.leaderboard || []);

    // Heatmap & Charts
    const heatRes = await fetch('/api/soc/heatmap');
    const heatData = await heatRes.json();
    renderHeatmap(heatData.heatmap || []);

    // Render interactive charts
    renderCharts(allAlerts, heatData.heatmap || []);
  } catch (err) {
    console.error('[SOC Refresh Error]', err);
  }
}

function renderAlertsTable(alerts) {
  const tbody = document.getElementById('alerts-table-body');
  if (alerts && alerts.length > 0) {
    tbody.innerHTML = alerts.map(a => `
      <tr>
        <td>${new Date(a.createdAt).toLocaleTimeString()}</td>
        <td><b>${a.username}</b> <span class="badge navy">${a.role}</span></td>
        <td><code>${escapeHtml(a.targetAsset)}</code></td>
        <td><span class="badge ${a.severity.toLowerCase()}">${a.severity}</span></td>
        <td>${a.rulesFired.map(r => `<span title="${r.ruleName}" class="badge ${r.points>=90?'coral':'gold'}">${r.ruleId}</span>`).join(' ')}</td>
        <td><b class="${a.score>=90?'text-coral':'text-gold'}">${a.score} pts</b></td>
        <td><span class="badge gold">Validated #0-${alerts.indexOf(a)+1}</span></td>
      </tr>
    `).join('');
  } else {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No threat alerts match this filter.</td></tr>';
  }
}

function renderLeaderboard(users) {
  const lbBody = document.getElementById('leaderboard-table-body');
  if (users.length > 0) {
    lbBody.innerHTML = users.map(u => `
      <tr>
        <td><b>${u.username}</b></td>
        <td><span class="badge navy">${u.role}</span></td>
        <td>${u.department}</td>
        <td><b class="${u.riskScore>=90?'text-coral':(u.riskScore>=40?'text-gold':'text-navy')}">${u.riskScore}</b></td>
        <td><span class="badge ${u.status==='flagged'?'coral':'emerald'}">${u.status}</span></td>
      </tr>
    `).join('');
  } else {
    lbBody.innerHTML = '<tr><td colspan="5" class="empty-state">No users loaded.</td></tr>';
  }
}

function renderHeatmap(heatmapData) {
  const heatContainer = document.getElementById('access-heatmap-grid');
  if (heatmapData) {
    heatContainer.innerHTML = heatmapData.map(h => {
      const cls = h.isAfterHours ? (h.count > 0 ? 'afterhours-hit' : '') : (h.count > 0 ? 'active-activity' : '');
      return `<div class="heatmap-cell ${cls}" title="${h.hour}: ${h.count} events recorded">
        <div>${h.hour.split(':')[0]}h</div>
        <div><b>${h.count}</b></div>
      </div>`;
    }).join('');
  }
}

// ================= 6. INTERACTIVE CHART.JS CHARTS =================
function renderCharts(alerts, heatmap) {
  if (typeof Chart === 'undefined') return;

  const coralColor = '#FF724C';
  const goldColor = '#FDBF50';
  const navyColor = isDarkTheme ? '#8B90B2' : '#2A2C41';
  const lightBg = isDarkTheme ? '#353852' : '#ECECF2';

  // 1. Donut Chart: Threat Vector Breakdown
  const ctxThreat = document.getElementById('chart-threat-vectors');
  if (ctxThreat) {
    let honeyfilesCount = 0;
    let tokensCount = 0;
    let accountsCount = 0;
    let exfilCount = 0;

    alerts.forEach(a => {
      const ids = a.rulesFired.map(r => r.ruleId);
      if (ids.includes('R1')) honeyfilesCount++;
      if (ids.includes('R3')) tokensCount++;
      if (ids.includes('R2')) accountsCount++;
      if (ids.includes('R4') || ids.includes('R5')) exfilCount++;
    });

    if (honeyfilesCount === 0 && tokensCount === 0) {
      honeyfilesCount = 2; tokensCount = 1; accountsCount = 1; exfilCount = 1;
    }

    if (threatChart) threatChart.destroy();
    threatChart = new Chart(ctxThreat, {
      type: 'doughnut',
      data: {
        labels: ['Honeyfiles (R1)', 'Honeytokens (R3)', 'Decoy Accounts (R2)', 'Off-Hours Exfil (R4/R5)'],
        datasets: [{
          data: [honeyfilesCount, tokensCount, accountsCount, exfilCount],
          backgroundColor: ['#FF724C', '#FDBF50', '#2A2C41', '#10B981'],
          borderWidth: 2,
          borderColor: isDarkTheme ? '#2A2C41' : '#FFFFFF'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { boxWidth: 12, color: isDarkTheme ? '#F4F4F8' : '#2A2C41', font: { family: 'Plus Jakarta Sans', size: 11, weight: 600 } }
          }
        }
      }
    });
  }

  // 2. Bar Chart: Hourly Activity & Threat Spikes
  const ctxTrend = document.getElementById('chart-hourly-trend');
  if (ctxTrend && heatmap && heatmap.length > 0) {
    const labels = heatmap.map(h => h.hour);
    const dataVals = heatmap.map(h => h.count > 0 ? h.count : Math.floor(Math.random() * 4));

    if (trendChart) trendChart.destroy();
    trendChart = new Chart(ctxTrend, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Telemetry Access Events',
          data: dataVals,
          backgroundColor: labels.map((l, idx) => (idx < 9 || idx >= 19) ? 'rgba(255, 114, 76, 0.7)' : 'rgba(253, 191, 80, 0.75)'),
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            ticks: { color: isDarkTheme ? '#B6B8CE' : '#646884', font: { size: 9 } },
            grid: { display: false }
          },
          y: {
            ticks: { color: isDarkTheme ? '#B6B8CE' : '#646884', stepSize: 2 },
            grid: { color: isDarkTheme ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }
          }
        }
      }
    });
  }
}

function updateChartsTheme() {
  if (threatChart || trendChart) {
    renderCharts(allAlerts, []);
  }
}

// ================= 7. ALERT & PORTAL FILTERS =================
function setupFilters() {
  // Alert Feed Filter Pills
  document.querySelectorAll('#alert-filters .pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#alert-filters .pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.getAttribute('data-filter');
      if (filter === 'ALL') {
        renderAlertsTable(allAlerts);
      } else if (filter === 'CRITICAL') {
        renderAlertsTable(allAlerts.filter(a => a.severity === 'CRITICAL'));
      } else {
        renderAlertsTable(allAlerts.filter(a => a.rulesFired.some(r => r.ruleId === filter)));
      }
    });
  });

  // Department Filter Chips
  document.querySelectorAll('.dept-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.dept-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      const dept = chip.getAttribute('data-dept');
      if (dept === 'ALL') {
        renderPortalFiles(allFiles);
      } else {
        renderPortalFiles(allFiles.filter(f => f.department.toLowerCase() === dept.toLowerCase()));
      }
    });
  });
}

// ================= 8. EMPLOYEE PORTAL & DOCUMENT PREVIEW =================
function setupPortal() {
  const btnSearch = document.getElementById('btn-portal-search');
  const searchInput = document.getElementById('portal-search-input');
  const docModal = document.getElementById('doc-modal');
  const btnCloseDoc = document.getElementById('btn-close-doc-modal');

  btnSearch.addEventListener('click', () => searchPortal(searchInput.value.trim()));
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchPortal(searchInput.value.trim());
  });

  btnCloseDoc.addEventListener('click', () => docModal.classList.remove('show'));
}

async function loadPortalFiles() {
  try {
    const res = await fetch('/api/files', { headers: getAuthHeaders() });
    const data = await res.json();
    allFiles = data.files || [];
    renderPortalFiles(allFiles);
  } catch (err) {
    console.error('[Portal Files Error]', err);
  }
}

function renderPortalFiles(files) {
  const tbody = document.getElementById('portal-files-body');
  if (files && files.length > 0) {
    tbody.innerHTML = files.map(f => `
      <tr>
        <td><b>📄 ${escapeHtml(f.name)}</b></td>
        <td><code>${escapeHtml(f.path)}</code></td>
        <td><span class="badge navy">${f.department}</span></td>
        <td><span class="badge ${f.sensitivity==='Confidential'?'coral':'gold'}">${f.sensitivity}</span></td>
        <td>${Math.round(f.sizeBytes / 1024)} KB</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="viewDocument('${f.id}')">View</button>
          <button class="btn btn-secondary btn-sm" onclick="downloadDocument('${f.id}')">Download</button>
        </td>
      </tr>
    `).join('');
  } else {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No departmental files found.</td></tr>';
  }
}

async function searchPortal(query) {
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (data.alertTriggered) {
      playThreatBeep(true);
      showToast('⚠️ Honeytoken search canary triggered by Deception Engine!', 'CRITICAL');
    }
    renderPortalFiles(data.results || []);
  } catch (err) {
    console.error('[Search Error]', err);
  }
}

async function viewDocument(id) {
  try {
    const res = await fetch(`/api/files/${id}`, { headers: getAuthHeaders() });
    const data = await res.json();
    if (data.alertTriggered) {
      playThreatBeep(true);
      showToast('⚠️ Honeyfile access alarm triggered on SOC feed!', 'CRITICAL');
    }
    document.getElementById('doc-modal-title').textContent = data.file.name;
    document.getElementById('doc-modal-meta').textContent = `Path: ${data.file.path} | Classification: ${data.file.sensitivity} | Department: ${data.file.department}`;

    const previewContainer = document.getElementById('doc-modal-preview-container');
    // Check if it's an Excel spreadsheet honeyfile
    if (data.file.name.endsWith('.xlsx')) {
      previewContainer.innerHTML = `
        <table class="spreadsheet-grid">
          <thead>
            <tr><th>Row</th><th>Employee Name</th><th>Designation</th><th>Salary (Annual)</th><th>Bonus %</th><th>Canary Canary ID</th></tr>
          </thead>
          <tbody>
            <tr><td>1</td><td>Johnathan Davis</td><td>VP Engineering</td><td>$245,000</td><td>25%</td><td>CANARY_CANARY_01</td></tr>
            <tr class="highlight-canary"><td>2</td><td>Marcus Sterling</td><td>Chief Financial Officer</td><td>$320,000</td><td>35%</td><td>CANARY_EXECUTIVE_TOKEN_99X</td></tr>
            <tr><td>3</td><td>Elena Rostova</td><td>Director HR</td><td>$195,000</td><td>20%</td><td>CANARY_CANARY_03</td></tr>
            <tr><td>4</td><td>David Chen</td><td>Lead Architect</td><td>$185,000</td><td>15%</td><td>CANARY_CANARY_04</td></tr>
          </tbody>
        </table>
      `;
    } else {
      previewContainer.innerHTML = `<pre class="doc-text">${escapeHtml(data.file.content || '[Empty Document]')}</pre>`;
    }

    document.getElementById('doc-modal').classList.add('show');
  } catch (err) {
    console.error('[View Doc Error]', err);
  }
}

function downloadDocument(id) {
  window.location.href = `/api/files/${id}/download`;
}

// ================= 9. DIGITAL FORENSICS =================
function setupForensics() {
  document.getElementById('btn-verify-chain').addEventListener('click', verifyHashChain);
  document.getElementById('btn-tamper-demo').addEventListener('click', tamperDemo);
  document.getElementById('btn-restore-chain').addEventListener('click', restoreHashChain);
}

async function verifyHashChain() {
  try {
    const res = await fetch('/api/forensics/verify');
    const data = await res.json();
    const card = document.getElementById('verification-result-card');

    if (data.valid) {
      card.innerHTML = `
        <div class="status-indicator intact">
          <span class="status-icon">✓</span>
          <div class="status-text">
            <h4>CHAIN INTEGRITY: PRISTINE & VALID (${data.count} BLOCKS VERIFIED)</h4>
            <p>All recursive SHA-256 digests mathematically match. Latest Ledger Root: <code>${(data.latestHash||'').slice(0, 24)}...</code></p>
          </div>
        </div>
      `;
      showToast(`Forensic hash chain mathematically verified (${data.count} blocks intact).`, 'LOW');
    } else {
      playThreatBeep(true);
      card.innerHTML = `
        <div class="status-indicator broken">
          <span class="status-icon">✕</span>
          <div class="status-text">
            <h4 class="text-coral">TAMPERING DETECTED AT BLOCK SEQUENCE #${data.brokenSeq}</h4>
            <p class="text-coral">Cryptographic digest mismatch: ${data.reason}. Expected: <code>${(data.expectedHash||'').slice(0, 16)}...</code> vs Actual: <code>${(data.actualHash||'').slice(0, 16)}...</code></p>
          </div>
        </div>
      `;
      showToast(`Tampering detected at sequence #${data.brokenSeq}! Integrity broken!`, 'CRITICAL');
    }
    loadCustodyLogs();
  } catch (err) {
    console.error('[Verify Error]', err);
  }
}

async function tamperDemo() {
  try {
    const res = await fetch('/api/forensics/tamper-demo', { method: 'POST' });
    const data = await res.json();
    showToast(`Tampered with sequence #${data.tamperedSeq}. Now click 'Verify Evidentiary Chain' to see break!`, 'HIGH');
    await verifyHashChain();
  } catch (err) {
    console.error('[Tamper Demo Error]', err);
  }
}

async function restoreHashChain() {
  try {
    await fetch('/api/forensics/restore-chain', { method: 'POST' });
    showToast('Chain re-synchronized. All hashes restored.', 'LOW');
    await verifyHashChain();
  } catch (err) {
    console.error('[Restore Error]', err);
  }
}

async function loadCustodyLogs() {
  try {
    const res = await fetch('/api/forensics/custody');
    const data = await res.json();
    const tbody = document.getElementById('custody-log-body');
    if (data.custodyLogs && data.custodyLogs.length > 0) {
      tbody.innerHTML = data.custodyLogs.map(l => `
        <tr>
          <td>${new Date(l.ts).toLocaleString()}</td>
          <td><b>${l.actor}</b></td>
          <td><span class="badge navy">${l.action}</span></td>
          <td>${escapeHtml(l.detail)}</td>
          <td><code>${l.fileSha256 ? l.fileSha256.slice(0, 20) + '...' : 'Ledger Ingest'}</code></td>
        </tr>
      `).join('');
    } else {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No custodial actions recorded yet.</td></tr>';
    }
  } catch (err) {
    console.error('[Custody Log Error]', err);
  }
}

// ================= 10. INCIDENT CASE MANAGEMENT & TRIAGE =================
async function loadIncidents() {
  try {
    const res = await fetch('/api/forensics/incidents');
    const data = await res.json();
    const tbody = document.getElementById('incidents-table-body');
    if (data.incidents && data.incidents.length > 0) {
      tbody.innerHTML = data.incidents.map(inc => `
        <tr>
          <td><code>#${inc._id.slice(-6)}</code></td>
          <td><b>${escapeHtml(inc.title)}</b></td>
          <td><b>${inc.suspectUsername}</b></td>
          <td><span class="badge ${inc.severity.toLowerCase()}">${inc.severity}</span></td>
          <td><span class="badge ${inc.status==='Closed'?'emerald':(inc.status==='Contained'?'gold':'coral')}">${inc.status}</span></td>
          <td>${(inc.mitreTechniques||[]).map(t=>`<span class="badge navy">${t}</span>`).join(' ')}</td>
          <td>${new Date(inc.createdAt).toLocaleTimeString()}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="openTriageModal('${inc._id}', '${inc.status}', '${escapeHtml(inc.title)}')">Triage</button>
            <a href="/api/forensics/incidents/${inc._id}/export?format=pdf" class="btn btn-primary btn-sm" target="_blank">PDF</a>
            <a href="/api/forensics/incidents/${inc._id}/export?format=csv" class="btn btn-secondary btn-sm" target="_blank">CSV</a>
          </td>
        </tr>
      `).join('');
    } else {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No active incidents. Trigger an attack scenario to create one.</td></tr>';
    }
  } catch (err) {
    console.error('[Incidents Error]', err);
  }
}

function setupTriageModal() {
  const modal = document.getElementById('incident-triage-modal');
  const btnClose = document.getElementById('btn-close-triage-modal');
  const btnSave = document.getElementById('btn-save-triage');

  btnClose.addEventListener('click', () => modal.classList.remove('show'));

  btnSave.addEventListener('click', async () => {
    const id = document.getElementById('triage-incident-id').value;
    const status = document.getElementById('triage-status-select').value;
    const note = document.getElementById('triage-note-input').value.trim();

    try {
      const res = await fetch(`/api/forensics/incidents/${id}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status, note })
      });
      if (res.ok) {
        showToast(`Incident #${id.slice(-6)} updated to ${status}`, 'LOW');
        modal.classList.remove('show');
        loadIncidents();
        loadCustodyLogs();
      }
    } catch (err) {
      console.error('[Triage Save Error]', err);
    }
  });
}

function openTriageModal(id, currentStatus, title) {
  document.getElementById('triage-incident-id').value = id;
  document.getElementById('triage-status-select').value = currentStatus;
  document.getElementById('triage-note-input').value = '';
  document.getElementById('triage-modal-title').textContent = `Triage Case: ${title.slice(0, 32)}...`;
  document.getElementById('incident-triage-modal').classList.add('show');
}

// ================= 11. DECEPTION MANAGER =================
async function loadDecoys() {
  try {
    const res = await fetch('/api/soc/decoys');
    const data = await res.json();
    const tbody = document.getElementById('decoys-table-body');
    if (data.decoys && data.decoys.length > 0) {
      tbody.innerHTML = data.decoys.map(d => `
        <tr>
          <td><span class="badge navy">${d.type}</span></td>
          <td><b>${escapeHtml(d.name)}</b></td>
          <td><code>${escapeHtml(d.location)}</code></td>
          <td><code>${d.tokenValue ? escapeHtml(d.tokenValue) : 'N/A'}</code></td>
          <td><span class="badge ${d.severity.toLowerCase()}">${d.severity}</span></td>
          <td><span class="badge ${d.enabled?'emerald':'coral'}">${d.enabled?'ARMED':'DISABLED'}</span></td>
          <td><b class="${d.triggerCount>0?'text-coral':''}">${d.triggerCount}</b></td>
          <td>${d.lastTriggeredAt ? new Date(d.lastTriggeredAt).toLocaleTimeString() : 'Never'}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="toggleDecoy('${d._id}')">
              ${d.enabled ? 'Disarm' : 'Arm'}
            </button>
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('[Decoys Error]', err);
  }
}

async function toggleDecoy(id) {
  try {
    await fetch(`/api/soc/decoys/${id}/toggle`, { method: 'PATCH' });
    loadDecoys();
  } catch (err) {
    console.error('[Toggle Decoy Error]', err);
  }
}

// ================= 12. ATTACK SIMULATOR =================
function setupSimulator() {
  document.querySelectorAll('.btn-run-sim').forEach(btn => {
    btn.addEventListener('click', async () => {
      const scenario = btn.getAttribute('data-scenario');
      runScenario(scenario);
    });
  });
}

async function runScenario(scenarioId) {
  const terminal = document.getElementById('sim-output-pre');
  const statusLabel = document.getElementById('sim-status-label');
  statusLabel.textContent = `Running ${scenarioId}...`;
  terminal.textContent = `[+] Initializing scenario ${scenarioId} payload execution...\n[*] Dispatching requests to DeceptiGuard security boundary...\n`;

  try {
    const res = await fetch(`/api/sim/run/${scenarioId}`, { method: 'POST' });
    const data = await res.json();
    statusLabel.textContent = `Completed (${data.mttdMs}ms)`;

    terminal.textContent += `[+] Scenario: ${data.name || scenarioId}\n`;
    terminal.textContent += `[+] Expected Alarm: ${data.expectedAlert}\n`;
    terminal.textContent += `[+] Mean Time To Detect (MTTD): ${data.mttdMs} ms (< 2.0s target reached)\n`;
    terminal.textContent += `[+] Telemetry Result: ${JSON.stringify(data.result || data.events, null, 2)}\n`;

    if (scenarioId !== 'S5') {
      playThreatBeep(true);
    }
    showToast(`Scenario ${scenarioId} executed: MTTD ${data.mttdMs}ms`, 'LOW');
    refreshSocDashboard();
    loadIncidents();
  } catch (err) {
    statusLabel.textContent = 'Error';
    terminal.textContent += `[-] Execution failed: ${err.message}\n`;
  }
}

// ================= TOAST NOTIFICATIONS =================
function showToast(message, severity = 'LOW') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  if (severity === 'CRITICAL') toast.style.borderLeftColor = 'var(--palette-coral)';
  else if (severity === 'HIGH') toast.style.borderLeftColor = 'var(--palette-gold)';
  else toast.style.borderLeftColor = 'var(--accent-emerald)';

  toast.innerHTML = `
    <span style="font-size: 18px;">${severity==='CRITICAL'?'🚨':(severity==='HIGH'?'⚠️':'🔔')}</span>
    <div>
      <b style="font-size: 11px; text-transform: uppercase; color: var(--text-dim);">${severity} SEVERITY</b>
      <p style="font-size: 12.5px; margin-top: 2px;">${escapeHtml(message)}</p>
    </div>
  `;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4500);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
