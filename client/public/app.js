// DeceptiGuard frontend controller managing real-time alerts, file access, traps, attack simulation, and forensics
let currentUser = { username: 'onkar', role: 'admin', department: 'IT', token: null };
let socket = null;

// Initializes the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  setupNavigation();
  setupUserAuth();
  setupSocket();
  setupDashboard();
  setupFiles();
  setupTraps();
  setupAttacks();
  setupEvidenceAndCases();
  autoLoginDefaultUser();
});

// Sets up theme mode from localStorage and binds toggle button
function initTheme() {
  const saved = localStorage.getItem('deceptiguard_theme') || 'light';
  applyTheme(saved === 'dark');
  document.getElementById('btn-theme-toggle').addEventListener('click', () => {
    applyTheme(!document.body.classList.contains('dark-theme'));
  });
}

// Toggles CSS theme class and stores preference
function applyTheme(isDark) {
  document.body.classList.toggle('dark-theme', isDark);
  document.body.classList.toggle('light-theme', !isDark);
  document.getElementById('theme-icon').textContent = isDark ? '🌙' : '☀️';
  document.getElementById('theme-label').textContent = isDark ? 'Dark' : 'Light';
  localStorage.setItem('deceptiguard_theme', isDark ? 'dark' : 'light');
}

// Sets up click listeners for switching between the 5 pages
function setupNavigation() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      const targetId = tab.getAttribute('data-tab');
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.classList.add('active');

      if (targetId === 'dashboard-tab') loadDashboardData();
      if (targetId === 'files-tab') loadCompanyFiles();
      if (targetId === 'traps-tab') loadTrapsData();
      if (targetId === 'evidence-tab') { loadEvidenceStatus(); loadCasesData(); }
    });
  });
}

// Switches active navigation tab programmatically
window.navigateToTab = function(tabId) {
  const tabBtn = document.querySelector(`.nav-tab[data-tab="${tabId}"]`);
  if (tabBtn) tabBtn.click();
};

// Binds user switcher modal and persona selection buttons
function setupUserAuth() {
  const modal = document.getElementById('user-modal');
  document.getElementById('btn-switch-user').addEventListener('click', () => modal.classList.add('show'));
  document.getElementById('btn-close-modal').addEventListener('click', () => modal.classList.remove('show'));

  document.querySelectorAll('.persona-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await switchUser(btn.getAttribute('data-user'));
      modal.classList.remove('show');
    });
  });
}

// Logs in automatically as onkar (Admin) on app launch
async function autoLoginDefaultUser() {
  await switchUser('onkar');
  loadDashboardData();
  loadCompanyFiles();
  loadTrapsData();
  loadEvidenceStatus();
  loadCasesData();
}

// Switches active persona by calling login endpoint with Password123!
async function switchUser(username) {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: 'Password123!' })
    });
    const data = await res.json();
    if (res.ok && data.token) {
      currentUser = { username: data.user.username, role: data.user.role, department: data.user.department, token: data.token };
      document.getElementById('current-username').textContent = currentUser.username;
      document.getElementById('current-user-role').textContent = currentUser.role;
    } else {
      alert(`Login simulated: ${data.error || 'Triggered security alert!'}`);
      loadDashboardData();
    }
  } catch (err) { console.error('Login error:', err); }
}

// Connects to WebSocket server for live alert notifications
function setupSocket() {
  if (typeof io !== 'undefined') {
    socket = io();
    socket.on('connect', () => {
      document.getElementById('ws-status').innerHTML = '<span class="pulse-dot"></span> LIVE CONNECTED';
    });
    socket.on('alert:new', () => {
      loadDashboardData();
      loadTrapsData();
      loadCasesData();
    });
  }
}

// Initializes dashboard periodic refreshes
function setupDashboard() {
  setInterval(() => {
    const active = document.querySelector('.nav-tab.active');
    if (active && active.getAttribute('data-tab') === 'dashboard-tab') loadDashboardData();
  }, 10000);
}

// Fetches statistics, live alerts, and user risk leaderboard
async function loadDashboardData() {
  try {
    const [statsRes, alertsRes, leadRes] = await Promise.all([
      fetch('/api/soc/stats'), fetch('/api/soc/alerts'), fetch('/api/soc/leaderboard')
    ]);
    if (statsRes.ok) {
      const s = await statsRes.json();
      document.getElementById('stat-alerts').textContent = s.totalAlerts || 0;
      document.getElementById('stat-critical').textContent = s.criticalAlerts || 0;
      document.getElementById('stat-cases').textContent = s.openIncidents || 0;
      document.getElementById('stat-traps').textContent = s.triggeredDecoys || 0;
    }
    if (alertsRes.ok) {
      const { alerts } = await alertsRes.json();
      renderAlertsList(alerts || []);
    }
    if (leadRes.ok) {
      const { leaderboard } = await leadRes.json();
      renderLeaderboard(leaderboard || []);
    }
  } catch (err) { console.error('Dashboard load error:', err); }
}

// Renders rows into the live threat alerts feed table
function renderAlertsList(alerts) {
  const tbody = document.getElementById('live-alerts-list');
  if (!alerts || alerts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="text-align:center; padding:30px;">No security alerts recorded yet.</td></tr>';
    return;
  }
  tbody.innerHTML = alerts.map(a => {
    const rules = (a.rulesFired || []).map(r => r.ruleId).join(', ') || 'N/A';
    const cls = a.severity === 'CRITICAL' ? 'badge coral' : (a.severity === 'HIGH' ? 'badge gold' : 'badge navy');
    return `<tr>
      <td style="font-family: monospace;">${new Date(a.createdAt).toLocaleTimeString()}</td>
      <td><b>${escapeHtml(a.username)}</b> <small class="text-muted">(${escapeHtml(a.role || '')})</small></td>
      <td><span class="${cls}">${a.severity}</span></td>
      <td style="font-family: monospace; font-size: 12px;">${escapeHtml(a.targetAsset || 'N/A')}</td>
      <td><span class="badge navy">${rules}</span></td>
      <td><b>+${a.score || 0}</b></td>
    </tr>`;
  }).join('');
}

// Renders user risk scores with status badges
function renderLeaderboard(users) {
  const tbody = document.getElementById('risk-leaderboard-body');
  if (!users || users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted" style="text-align:center; padding:30px;">No users found.</td></tr>';
    return;
  }
  tbody.innerHTML = users.map(u => {
    const isFlagged = u.riskScore >= 90 || u.status === 'flagged';
    const cls = isFlagged ? 'badge coral' : (u.riskScore >= 30 ? 'badge gold' : 'badge emerald');
    const txt = isFlagged ? 'FLAGGED' : (u.riskScore > 0 ? 'MONITORED' : 'NORMAL');
    return `<tr>
      <td><b>${escapeHtml(u.username)}</b> <small class="text-muted">(${escapeHtml(u.role)})</small></td>
      <td>${escapeHtml(u.department || 'General')}</td>
      <td><b>${u.riskScore || 0}</b> pts</td>
      <td><span class="${cls}">${txt}</span></td>
    </tr>`;
  }).join('');
}

// Binds search box and file viewer events in company files page
function setupFiles() {
  const searchInput = document.getElementById('portal-search-input');
  document.getElementById('btn-search-files').addEventListener('click', () => loadCompanyFiles(searchInput.value.trim()));
  searchInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') loadCompanyFiles(searchInput.value.trim()); });
  document.getElementById('btn-close-doc-modal').addEventListener('click', () => document.getElementById('doc-modal').classList.remove('show'));
}

// Fetches and displays corporate files and trap lures
async function loadCompanyFiles(query = '') {
  try {
    const headers = currentUser.token ? { 'Authorization': `Bearer ${currentUser.token}` } : {};
    const url = query ? `/api/search?q=${encodeURIComponent(query)}` : '/api/files';
    const res = await fetch(url, { headers });
    const data = await res.json();
    const files = data.files || [];
    const tbody = document.getElementById('files-table-body');
    if (files.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted" style="text-align:center; padding:30px;">No documents found matching search.</td></tr>';
      return;
    }
    tbody.innerHTML = files.map(f => `<tr>
      <td><b>${escapeHtml(f.name)}</b></td>
      <td>${escapeHtml(f.department || 'General')}</td>
      <td><span class="badge ${f.sensitivity === 'Confidential' ? 'gold' : 'navy'}">${escapeHtml(f.sensitivity || 'Internal')}</span></td>
      <td>${Math.round((f.sizeBytes || 1024) / 1024)} KB</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="viewFileContent('${f._id}')">View</button>
        <a class="btn btn-secondary btn-sm" href="/api/files/${f._id}/download?token=${currentUser.token || ''}" target="_blank">Download</a>
      </td>
    </tr>`).join('');
  } catch (err) { console.error('Files error:', err); }
}

// Fetches a file's content and opens the preview modal
window.viewFileContent = async function(fileId) {
  try {
    const headers = currentUser.token ? { 'Authorization': `Bearer ${currentUser.token}` } : {};
    const res = await fetch(`/api/files/${fileId}`, { headers });
    const data = await res.json();
    if (data.file) {
      document.getElementById('doc-modal-title').textContent = data.file.name;
      document.getElementById('doc-modal-meta').textContent = `Path: ${data.file.path} | Classification: ${data.file.sensitivity || 'Internal'}`;
      document.getElementById('doc-modal-content').textContent = data.file.content || '[Binary document preview]';
      document.getElementById('doc-modal').classList.add('show');
    }
  } catch (err) { alert('Preview error: ' + err.message); }
};

// Initializes the traps page
function setupTraps() {
  loadTrapsData();
}

// Loads the table of 6 traps with trigger counts
async function loadTrapsData() {
  try {
    const res = await fetch('/api/soc/decoys');
    const { decoys } = await res.json();
    const tbody = document.getElementById('traps-table-body');
    if (!decoys || decoys.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted" style="text-align:center; padding:30px;">No deception traps registered.</td></tr>';
      return;
    }
    tbody.innerHTML = decoys.map(d => {
      const type = d.type === 'HONEYFILE' ? 'Trap File' : (d.type === 'HONEYTOKEN' ? 'Fake Key' : (d.type === 'DECOY_ACCOUNT' ? 'Fake Account' : 'Trap Web Address'));
      const cls = d.triggerCount > 0 ? 'badge coral' : 'badge emerald';
      return `<tr>
        <td><b>${escapeHtml(d.name)}</b></td>
        <td><span class="badge navy">${type}</span></td>
        <td style="font-family: monospace; font-size: 12px;">${escapeHtml(d.location || d.tokenValue || 'N/A')}</td>
        <td><span class="${cls}">${d.triggerCount || 0} times</span></td>
        <td><span class="badge emerald">ARMED</span></td>
      </tr>`;
    }).join('');
  } catch (err) { console.error('Traps error:', err); }
}

// Binds the 5 attack simulation scenario buttons
function setupAttacks() {
  ['s1', 's2', 's3', 's4', 's5'].forEach(s => {
    document.getElementById(`btn-attack-${s}`).addEventListener('click', () => runAttackScenario(s.toUpperCase()));
  });
}

// Sends attack simulation request and displays formatted results with MTTD and tracker links
async function runAttackScenario(scenarioId) {
  const box = document.getElementById('attack-result-box');
  box.innerHTML = `<span style="color:#F59E0B;">⚡ Running Attack Scenario ${scenarioId}... Analyzing sensor triggers...</span>`;
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (currentUser.token) headers['Authorization'] = `Bearer ${currentUser.token}`;
    const res = await fetch(`/api/sim/run/${scenarioId}`, { method: 'POST', headers });
    const data = await res.json();
    if (!res.ok) {
      box.innerHTML = `<span style="color:#EF4444;">Error executing attack: ${escapeHtml(data.error || 'Failed')}</span>`;
      return;
    }
    const rules = (data.rulesFired && data.rulesFired.length > 0) ? data.rulesFired.join(', ') : 'None (No alert)';
    const blockText = data.evidenceSeq ? `Block #${data.evidenceSeq} (<span style="color:#10B981;">SHA-256: ${data.evidenceHash ? data.evidenceHash.substring(0, 16) + '...' : 'Verified'}</span>)` : 'No evidence block (Benign baseline)';
    const caseText = data.caseTitle ? `Opened: "${escapeHtml(data.caseTitle)}"` : 'No case opened';

    box.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:8px; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
        <div><b>Simulated Attack:</b> <span style="color:#FF5A36; font-weight:700;">${escapeHtml(data.name)} (${data.scenario})</span></div>
        <div><b>Time to Detect (MTTD):</b> <span style="color:#10B981; font-weight:bold; font-size:14px;">${data.mttdMs} ms</span> <small style="color:#94A3B8;">(Measured)</small></div>
      </div>
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:10px; margin-bottom:12px;">
        <div><small style="color:#94A3B8;">SUSPECT / INITIATOR:</small><br><b>${escapeHtml(data.who)}</b></div>
        <div><small style="color:#94A3B8;">RULES TRIGGERED:</small><br><span class="badge navy">${escapeHtml(rules)}</span></div>
        <div><small style="color:#94A3B8;">PENALTY POINTS:</small><br><b>+${data.points || 0} pts</b></div>
        <div><small style="color:#94A3B8;">EXPECTED OUTCOME:</small><br>${escapeHtml(data.expected)}</div>
      </div>
      <div style="background:rgba(0,0,0,0.25); padding:10px 14px; border-radius:6px; border:1px solid rgba(255,255,255,0.05); font-size:12px; line-height:1.7;">
        <div><b>1. Action Taken:</b> ${escapeHtml(data.what)}</div>
        <div><b>2. Forensic Hash Ledger:</b> ${blockText}</div>
        <div><b>3. Case Attribution:</b> ${caseText}</div>
      </div>
      <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
        <button class="btn btn-secondary btn-sm" onclick="navigateToTab('dashboard-tab')">📊 Track on Dashboard</button>
        <button class="btn btn-secondary btn-sm" onclick="navigateToTab('evidence-tab')">🔒 Track in Evidence & Cases</button>
      </div>
    `;
    loadDashboardData();
    loadTrapsData();
    loadCasesData();
  } catch (err) { box.innerHTML = `<span style="color:#EF4444;">Error: ${escapeHtml(err.message)}</span>`; }
}

// Binds evidence verification, tamper test, and fix evidence buttons
function setupEvidenceAndCases() {
  document.getElementById('btn-check-evidence').addEventListener('click', loadEvidenceStatus);
  document.getElementById('btn-tamper-test').addEventListener('click', runTamperTest);
  document.getElementById('btn-fix-evidence').addEventListener('click', runFixEvidence);
}

// Checks cryptographic hash chain integrity and updates banner color
async function loadEvidenceStatus() {
  const banner = document.getElementById('evidence-status-banner');
  try {
    const res = await fetch('/api/forensics/verify');
    const data = await res.json();
    if (data.valid) {
      banner.style.background = 'rgba(16, 185, 129, 0.15)';
      banner.style.borderColor = '#10B981';
      banner.style.color = '#10B981';
      banner.textContent = `✅ All ${data.count || 0} blocks are fine (SHA-256 Ledger Verified)`;
    } else {
      banner.style.background = 'rgba(239, 68, 68, 0.15)';
      banner.style.borderColor = '#EF4444';
      banner.style.color = '#EF4444';
      banner.textContent = `❌ Block number ${data.brokenSeq || '?'} was changed (Data altered - Invalid hash pointer)`;
    }
  } catch (err) { banner.textContent = 'Error checking integrity: ' + err.message; }
}

// Purposefully alters Block #1 in the database for lab demonstration
async function runTamperTest() {
  try {
    const headers = currentUser.token ? { 'Authorization': `Bearer ${currentUser.token}` } : {};
    const res = await fetch('/api/forensics/tamper-demo', { method: 'POST', headers });
    const data = await res.json();
    if (res.ok) await loadEvidenceStatus();
    else alert(data.error || 'Tamper test requires Admin login.');
  } catch (err) { alert('Tamper error: ' + err.message); }
}

// Restores evidence block hashes back to pristine valid condition
async function runFixEvidence() {
  try {
    const headers = currentUser.token ? { 'Authorization': `Bearer ${currentUser.token}` } : {};
    const res = await fetch('/api/forensics/restore-chain', { method: 'POST', headers });
    const data = await res.json();
    if (res.ok) await loadEvidenceStatus();
    else alert(data.error || 'Fix evidence requires Admin login.');
  } catch (err) { alert('Fix evidence error: ' + err.message); }
}

// Loads forensic incident cases with status dropdown and PDF export button
async function loadCasesData() {
  try {
    const res = await fetch('/api/forensics/incidents');
    const { incidents } = await res.json();
    const tbody = document.getElementById('cases-table-body');
    if (!incidents || incidents.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="text-align:center; padding:30px;">No cases open.</td></tr>';
      return;
    }
    tbody.innerHTML = incidents.map(inc => {
      const cls = inc.severity === 'CRITICAL' ? 'badge coral' : (inc.severity === 'HIGH' ? 'badge gold' : 'badge navy');
      return `<tr>
        <td><b>${escapeHtml(inc.title)}</b></td>
        <td><b>${escapeHtml(inc.suspectUsername)}</b></td>
        <td><span class="${cls}">${inc.severity}</span></td>
        <td>
          <select onchange="updateCaseStatus('${inc._id}', this.value)" style="padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-surface); color: var(--text-main);">
            <option value="Open" ${inc.status === 'Open' ? 'selected' : ''}>Open</option>
            <option value="Checking" ${inc.status === 'Checking' ? 'selected' : ''}>Checking</option>
            <option value="Closed" ${inc.status === 'Closed' ? 'selected' : ''}>Closed</option>
          </select>
        </td>
        <td style="font-size: 12px;">${new Date(inc.createdAt).toLocaleString()}</td>
        <td><a class="btn btn-primary btn-sm" href="/api/forensics/incidents/${inc._id}/export?format=pdf" target="_blank">Download PDF</a></td>
      </tr>`;
    }).join('');
  } catch (err) { console.error('Cases error:', err); }
}

// Updates an incident's status when the dropdown changes
window.updateCaseStatus = async function(caseId, newStatus) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (currentUser.token) headers['Authorization'] = `Bearer ${currentUser.token}`;
    await fetch(`/api/forensics/incidents/${caseId}/status`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: newStatus })
    });
    loadDashboardData();
  } catch (err) { console.error('Update status error:', err); }
};

// Escapes special characters to safely render text inside HTML
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
