const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const connectDB = require('../config/db');
const User = require('../models/User');
const File = require('../models/File');
const Decoy = require('../models/Decoy');
const Evidence = require('../models/Evidence');
const Event = require('../models/Event');
const Alert = require('../models/Alert');
const Incident = require('../models/Incident');
const CustodyLog = require('../models/CustodyLog');
const { sha256, canonicalJson } = require('../utils/cryptoUtils');

async function seedDatabase() {
  await connectDB();
  console.log('[Seed] Purging existing data collections...');

  await Promise.all([
    User.deleteMany({}),
    File.deleteMany({}),
    Decoy.deleteMany({}),
    Evidence.deleteMany({}),
    Event.deleteMany({}),
    Alert.deleteMany({}),
    Incident.deleteMany({}),
    CustodyLog.deleteMany({})
  ]);

  const passwordHash = await bcrypt.hash('Password123!', 10);

  // 1. Seed Users (6 legitimate + 2 decoy accounts)
  console.log('[Seed] Seeding 8 User Accounts (including Decoy Lures)...');
  const users = await User.create([
    { username: 'admin', passwordHash, role: 'admin', department: 'IT' },
    { username: 'hr_alice', passwordHash, role: 'hr', department: 'HR' },
    { username: 'fin_bob', passwordHash, role: 'finance', department: 'Finance' },
    { username: 'eng_carol', passwordHash, role: 'engineer', department: 'Engineering' },
    { username: 'intern_dave', passwordHash, role: 'intern', department: 'Engineering' },
    { username: 'auditor_eve', passwordHash, role: 'auditor', department: 'Compliance' },
    // Decoy Accounts
    { username: 'admin.backup', passwordHash, role: 'admin', department: 'IT', isDecoy: true },
    { username: 'svc_backup', passwordHash, role: 'engineer', department: 'DevOps', isDecoy: true }
  ]);

  // 2. Seed Decoys Registry
  console.log('[Seed] Seeding Deception Registry (Honeyfiles, Tokens, Endpoints)...');
  const decoys = await Decoy.create([
    {
      type: 'HONEYFILE',
      name: 'Salary_Revision_2026_CONFIDENTIAL.xlsx',
      location: '/HR/Compensation/Salary_Revision_2026_CONFIDENTIAL.xlsx',
      description: 'Lure file containing synthetic executive compensation data.',
      severity: 'CRITICAL',
      enabled: true
    },
    {
      type: 'HONEYFILE',
      name: 'Passwords_Backup.txt',
      location: '/IT/Old_Archives/Passwords_Backup.txt',
      description: 'Decoy document containing seeded canary credentials.',
      severity: 'CRITICAL',
      enabled: true
    },
    {
      type: 'HONEYFILE',
      name: 'Layoffs_Plan_Q4.docx',
      location: '/HR/Planning/Layoffs_Plan_Q4.docx',
      description: 'High-curiosity lure document for HR and internal surveillance.',
      severity: 'HIGH',
      enabled: true
    },
    {
      type: 'HONEYFILE',
      name: 'Client_Database_Full_Export.csv',
      location: '/Finance/Archive/Client_Database_Full_Export.csv',
      description: 'Financial decoy CSV containing canary client emails.',
      severity: 'CRITICAL',
      enabled: true
    },
    {
      type: 'HONEYFILE',
      name: 'VPN_Credentials_Admin.txt',
      location: '/IT/Network/VPN_Credentials_Admin.txt',
      description: 'Decoy VPN profiles and pre-shared keys.',
      severity: 'CRITICAL',
      enabled: true
    },
    // Honeytokens
    {
      type: 'HONEYTOKEN',
      name: 'Canary AWS Root Access Key',
      location: 'Embedded in Passwords_Backup.txt',
      tokenValue: 'AKIA_CANARY_FAKE_998877XX',
      severity: 'CRITICAL',
      enabled: true
    },
    {
      type: 'HONEYTOKEN',
      name: 'Canary Production DB URI',
      location: 'Embedded in VPN_Credentials_Admin.txt',
      tokenValue: 'mongodb://admin:p@ssw0rdCanary@internal-cluster:27017/shadow_db',
      severity: 'CRITICAL',
      enabled: true
    },
    {
      type: 'HONEYTOKEN',
      name: 'Canary Search Audit Token',
      location: 'Embedded in Client_Database_Full_Export.csv',
      tokenValue: 'canary_sec_key_99x88a77b',
      severity: 'CRITICAL',
      enabled: true
    },
    // Decoy Endpoints
    {
      type: 'DECOY_ENDPOINT',
      name: 'Shadow DB Dump API',
      location: '/internal/db-dump',
      description: 'Tempting unlisted endpoint advertised in hidden comments.',
      severity: 'CRITICAL',
      enabled: true
    },
    {
      type: 'DECOY_ENDPOINT',
      name: 'Admin Bulk Export Endpoint',
      location: '/api/v1/admin/export-all',
      description: 'Administrative export endpoint trapped for unauthorized calls.',
      severity: 'CRITICAL',
      enabled: true
    }
  ]);

  // Map honeyfiles to virtual files collection
  const salaryDecoy = decoys.find(d => d.name.includes('Salary'));
  const pwdDecoy = decoys.find(d => d.name.includes('Passwords'));
  const layoffDecoy = decoys.find(d => d.name.includes('Layoffs'));
  const clientDecoy = decoys.find(d => d.name.includes('Client_Database'));
  const vpnDecoy = decoys.find(d => d.name.includes('VPN_Credentials'));

  // 3. Seed Virtual File System (Legitimate + Honeyfiles)
  console.log('[Seed] Seeding Virtual File System hierarchy...');
  await File.create([
    // Legitimate Corporate Documents
    {
      name: 'Employee_Handbook_2026.pdf',
      path: '/HR/Policies',
      department: 'HR',
      content: 'Acme Corp Employee Handbook: Standards of Professional Conduct and Benefits.',
      sizeBytes: 2048500,
      mimeType: 'application/pdf',
      sensitivity: 'Internal',
      isDecoy: false
    },
    {
      name: 'Leave_Policy.docx',
      path: '/HR/Policies',
      department: 'HR',
      content: 'Annual leave entitlement guidelines: 24 days paid vacation.',
      sizeBytes: 512000,
      mimeType: 'application/docx',
      sensitivity: 'Internal',
      isDecoy: false
    },
    {
      name: 'Q3_Quarterly_Earnings.pdf',
      path: '/Finance/Reports',
      department: 'Finance',
      content: 'Consolidated fiscal report: Revenue increased 18% YoY.',
      sizeBytes: 4194304,
      mimeType: 'application/pdf',
      sensitivity: 'Confidential',
      isDecoy: false
    },
    {
      name: 'Architecture_Guidelines.md',
      path: '/Engineering/Docs',
      department: 'Engineering',
      content: 'Microservices architecture guidelines, zero-trust network policy.',
      sizeBytes: 120400,
      mimeType: 'text/markdown',
      sensitivity: 'Internal',
      isDecoy: false
    },
    {
      name: 'Kernel_Drivers_Archive.tar.gz',
      path: '/Engineering/SourceCode',
      department: 'Engineering',
      content: 'Proprietary core networking drivers and firmware binaries.',
      sizeBytes: 15728640,
      mimeType: 'application/gzip',
      sensitivity: 'Confidential',
      isDecoy: false
    },
    {
      name: 'Audit_Checklist_2026.xlsx',
      path: '/Compliance',
      department: 'Compliance',
      content: 'ISO 27001 / SOC-2 Type II Annual Security Audit Checklist.',
      sizeBytes: 1048576,
      mimeType: 'application/vnd.ms-excel',
      sensitivity: 'Internal',
      isDecoy: false
    },
    // Deceptive Honeyfiles (Disguised inside realistic locations)
    {
      name: 'Salary_Revision_2026_CONFIDENTIAL.xlsx',
      path: '/HR/Compensation',
      department: 'HR',
      content: 'EXECUTIVE COMPENSATION DATA [CANARY ARTIFACT]. Do not distribute. Token: canary_sec_key_99x88a77b',
      sizeBytes: 1420000,
      mimeType: 'application/vnd.ms-excel',
      sensitivity: 'Confidential',
      isDecoy: true,
      decoyId: salaryDecoy._id
    },
    {
      name: 'Passwords_Backup.txt',
      path: '/IT/Old_Archives',
      department: 'IT',
      content: 'CANARY CREDENTIAL DUMP: aws_access_key_id = AKIA_CANARY_FAKE_998877XX\naws_secret_access_key = FakeSecret9988canary',
      sizeBytes: 4096,
      mimeType: 'text/plain',
      sensitivity: 'Confidential',
      isDecoy: true,
      decoyId: pwdDecoy._id
    },
    {
      name: 'Layoffs_Plan_Q4.docx',
      path: '/HR/Planning',
      department: 'HR',
      content: 'PROPOSED WORKFORCE REORGANIZATION Q4 [CANARY].',
      sizeBytes: 890000,
      mimeType: 'application/docx',
      sensitivity: 'Confidential',
      isDecoy: true,
      decoyId: layoffDecoy._id
    },
    {
      name: 'Client_Database_Full_Export.csv',
      path: '/Finance/Archive',
      department: 'Finance',
      content: 'id,name,email,card_hash\n1,Canary Customer,canary_client_alert@acmecorp.internal,tok_44321',
      sizeBytes: 8388608,
      mimeType: 'text/csv',
      sensitivity: 'Confidential',
      isDecoy: true,
      decoyId: clientDecoy._id
    },
    {
      name: 'VPN_Credentials_Admin.txt',
      path: '/IT/Network',
      department: 'IT',
      content: 'Cluster Connection: mongodb://admin:p@ssw0rdCanary@internal-cluster:27017/shadow_db',
      sizeBytes: 2048,
      mimeType: 'text/plain',
      sensitivity: 'Confidential',
      isDecoy: true,
      decoyId: vpnDecoy._id
    }
  ]);

  // 4. Seed Genesis Block in Evidentiary Hash Chain
  console.log('[Seed] Initializing Genesis Block in Evidentiary Hash Chain...');
  const genesisDate = new Date(Date.now() - 3600 * 1000 * 4); // 4 hours ago
  const genesisPayload = {
    seq: 0,
    message: 'GENESIS_EVIDENCE_ROOT_DECEPTIGUARD_2026',
    standard: 'ISO/IEC 27037:2012',
    initializedAt: genesisDate.toISOString()
  };
  const genesisHash = sha256('0000000000000000000000000000000000000000000000000000000000000000' + canonicalJson(genesisPayload) + genesisDate.toISOString());
  
  await Evidence.create({
    seq: 0,
    eventId: new mongoose.Types.ObjectId(),
    payload: genesisPayload,
    prevHash: '0000000000000000000000000000000000000000000000000000000000000000',
    hash: genesisHash,
    createdAt: genesisDate
  });

  // 5. Seed Pre-populated Demo Threat Events, Alerts, Hash Chain & Incidents
  console.log('[Seed] Seeding Rich Demo Telemetry, Hash Chained Evidence, and Incidents...');

  const internUser = users.find(u => u.username === 'intern_dave');
  const engUser = users.find(u => u.username === 'eng_carol');
  const finUser = users.find(u => u.username === 'fin_bob');
  const hrUser = users.find(u => u.username === 'hr_alice');
  const adminDecoy = users.find(u => u.username === 'admin.backup');

  // Time milestones
  const t1 = new Date(Date.now() - 3600 * 1000 * 3);
  const t2 = new Date(Date.now() - 3600 * 1000 * 2.5);
  const t3 = new Date(Date.now() - 3600 * 1000 * 2);
  const t4 = new Date(Date.now() - 3600 * 1000 * 1.5);
  const t5 = new Date(Date.now() - 3600 * 1000 * 0.5);

  // Demo Events
  const evt1 = await Event.create({
    userId: internUser._id,
    username: internUser.username,
    role: internUser.role,
    action: 'FILE_VIEW',
    target: '/HR/Compensation/Salary_Revision_2026_CONFIDENTIAL.xlsx',
    ip: '10.0.0.45',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    sessionId: 'sess_intern_01',
    ruleHits: ['R1', 'R6'],
    ts: t1,
    metadata: { isDecoy: true, sensitivity: 'Confidential', roleMismatch: true }
  });

  const evt2 = await Event.create({
    userId: adminDecoy._id,
    username: adminDecoy.username,
    role: adminDecoy.role,
    action: 'LOGIN_FAILED',
    target: 'Decoy Administrator Account Authentication (admin.backup)',
    ip: '192.168.1.105',
    userAgent: 'Python-requests/2.31.0',
    sessionId: 'sess_intruder_02',
    ruleHits: ['R2'],
    ts: t2,
    metadata: { isDecoyAccount: true }
  });

  const evt3 = await Event.create({
    userId: engUser._id,
    username: engUser.username,
    role: engUser.role,
    action: 'FILE_DOWNLOAD',
    target: '/Engineering/SourceCode/Kernel_Drivers_Archive.tar.gz',
    ip: '10.0.0.12',
    userAgent: 'Wget/1.21.3',
    sessionId: 'sess_eng_03',
    ruleHits: ['R4', 'R5'],
    ts: t3,
    metadata: { bulkCount: 25, sensitivity: 'Confidential' }
  });

  const evt4 = await Event.create({
    userId: finUser._id,
    username: finUser.username,
    role: finUser.role,
    action: 'HONEYTOKEN_SUBMIT',
    target: '/portal/search?q=canary_sec_key_99x88a77b',
    ip: '10.0.0.88',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    sessionId: 'sess_fin_04',
    ruleHits: ['R3'],
    ts: t4,
    metadata: { honeytokenHit: true, tokenValue: 'canary_sec_key_99x88a77b' }
  });

  const evt5 = await Event.create({
    userId: hrUser._id,
    username: hrUser.username,
    role: hrUser.role,
    action: 'FILE_VIEW',
    target: '/HR/Policies/Employee_Handbook_2026.pdf',
    ip: '10.0.0.5',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    sessionId: 'sess_hr_05',
    ruleHits: [],
    ts: t5,
    metadata: { isDecoy: false, sensitivity: 'Internal' }
  });

  // Demo Alerts
  const alert1 = await Alert.create({
    eventId: evt1._id,
    userId: internUser._id,
    username: internUser.username,
    role: internUser.role,
    severity: 'CRITICAL',
    score: 120,
    rulesFired: [
      { ruleId: 'R1', ruleName: 'Decoy Asset Interaction', points: 100, mitreTechnique: 'T1083 / T1005' },
      { ruleId: 'R6', ruleName: 'Cross-Department Role Violation', points: 20, mitreTechnique: 'T1083' }
    ],
    description: 'Unauthorized access to executive compensation canary lure document.',
    targetAsset: evt1.target,
    createdAt: t1
  });

  const alert2 = await Alert.create({
    eventId: evt2._id,
    userId: adminDecoy._id,
    username: adminDecoy.username,
    role: adminDecoy.role,
    severity: 'CRITICAL',
    score: 90,
    rulesFired: [
      { ruleId: 'R2', ruleName: 'Decoy Account Authentication', points: 90, mitreTechnique: 'T1078.002' }
    ],
    description: 'Credential abuse probing detected on dormant decoy administrator account.',
    targetAsset: evt2.target,
    createdAt: t2
  });

  const alert3 = await Alert.create({
    eventId: evt3._id,
    userId: engUser._id,
    username: engUser.username,
    role: engUser.role,
    severity: 'HIGH',
    score: 45,
    rulesFired: [
      { ruleId: 'R4', ruleName: 'After-Hours Privileged Access', points: 15, mitreTechnique: 'T1078' },
      { ruleId: 'R5', ruleName: 'Bulk Download Staging', points: 30, mitreTechnique: 'T1005 / T1567' }
    ],
    description: 'Abnormal data staging: 25 proprietary engineering archives downloaded off-hours.',
    targetAsset: evt3.target,
    createdAt: t3
  });

  const alert4 = await Alert.create({
    eventId: evt4._id,
    userId: finUser._id,
    username: finUser.username,
    role: finUser.role,
    severity: 'CRITICAL',
    score: 100,
    rulesFired: [
      { ruleId: 'R3', ruleName: 'Honeytoken Canary Usage', points: 100, mitreTechnique: 'T1552 / T1110' }
    ],
    description: 'Canary honeytoken extracted from decoy files submitted in application search.',
    targetAsset: evt4.target,
    createdAt: t4
  });

  // Chain evidence blocks (Seq 1 to 5)
  const demoEvents = [evt1, evt2, evt3, evt4, evt5];
  let curPrevHash = genesisHash;
  for (let i = 0; i < demoEvents.length; i++) {
    const e = demoEvents[i];
    const seq = i + 1;
    const createdAt = e.ts;
    const normPayload = {
      seq,
      eventId: e._id.toString(),
      username: e.username,
      action: e.action,
      target: e.target,
      ip: e.ip,
      ts: createdAt.toISOString(),
      ruleHits: e.ruleHits || []
    };
    const pStr = canonicalJson(normPayload);
    const blkHash = sha256(curPrevHash + pStr + createdAt.toISOString());

    await Evidence.create({
      seq,
      eventId: e._id,
      payload: normPayload,
      prevHash: curPrevHash,
      hash: blkHash,
      createdAt
    });
    curPrevHash = blkHash;
  }

  // Update user risk scores
  await User.findByIdAndUpdate(internUser._id, { riskScore: 120, status: 'flagged', flaggedReason: 'Critical honeyfile trigger: Salary_Revision_2026' });
  await User.findByIdAndUpdate(finUser._id, { riskScore: 100, status: 'flagged', flaggedReason: 'Honeytoken replay attack in search' });
  await User.findByIdAndUpdate(engUser._id, { riskScore: 45, status: 'active' });

  // Update Decoy trigger statistics
  await Decoy.findByIdAndUpdate(salaryDecoy._id, { $inc: { triggerCount: 1 }, lastTriggeredAt: t1 });
  await Decoy.findByIdAndUpdate(pwdDecoy._id, { $inc: { triggerCount: 1 }, lastTriggeredAt: t4 });

  // Seed Incidents
  const inc1 = await Incident.create({
    title: 'Insider Deception Breach: intern_dave accessed Executive Compensation Lure',
    severity: 'CRITICAL',
    status: 'Investigating',
    suspectUserId: internUser._id,
    suspectUsername: internUser.username,
    eventIds: [evt1._id],
    alertIds: [alert1._id],
    mitreTechniques: ['T1083', 'T1005'],
    notes: [
      { author: 'Autonomous SOC Engine', content: 'Incident opened automatically following high-confidence canary trigger on Salary_Revision_2026.xlsx.', createdAt: t1 },
      { author: 'admin', content: 'Analyst reviewed workstation IP 10.0.0.45. User placed on temporary observation hold.', createdAt: new Date(t1.getTime() + 15 * 60 * 1000) }
    ],
    createdAt: t1
  });

  const inc2 = await Incident.create({
    title: 'Off-Hours Exfiltration: eng_carol downloaded 25 source code packages',
    severity: 'HIGH',
    status: 'Contained',
    suspectUserId: engUser._id,
    suspectUsername: engUser.username,
    eventIds: [evt3._id],
    alertIds: [alert3._id],
    mitreTechniques: ['T1005', 'T1567', 'T1078'],
    notes: [
      { author: 'Autonomous SOC Engine', content: 'Anomalous bulk download flagged outside normal working hours.', createdAt: t3 },
      { author: 'auditor_eve', content: 'Employee contacted; session contained and VPN access revoked pending interview.', createdAt: new Date(t3.getTime() + 20 * 60 * 1000) }
    ],
    createdAt: t3
  });

  // Seed Custody Logs
  await CustodyLog.create([
    {
      incidentId: inc1._id,
      actor: 'Autonomous SOC Engine',
      action: 'INCIDENT_INITIALIZED',
      detail: 'Evidentiary block #1 anchored to SHA-256 chain.',
      ts: t1
    },
    {
      incidentId: inc1._id,
      actor: 'admin',
      action: 'INVESTIGATION_NOTES_ATTACHED',
      detail: 'Workstation forensic profile extracted from 10.0.0.45.',
      ts: new Date(t1.getTime() + 15 * 60 * 1000)
    },
    {
      incidentId: inc2._id,
      actor: 'Autonomous SOC Engine',
      action: 'INCIDENT_INITIALIZED',
      detail: 'Evidentiary block #3 anchored to SHA-256 chain.',
      ts: t3
    },
    {
      incidentId: inc2._id,
      actor: 'auditor_eve',
      action: 'STATUS_TRANSITION',
      detail: 'Incident moved to Contained status.',
      ts: new Date(t3.getTime() + 20 * 60 * 1000)
    }
  ]);

  console.log('\n======================================================');
  console.log('✅ SEEDING COMPLETE: DeceptiGuard Local Lab Initialized!');
  console.log('------------------------------------------------------');
  console.log('Demo Credentials (All accounts use password: Password123!)');
  console.log('• Admin:       admin');
  console.log('• HR:          hr_alice');
  console.log('• Finance:     fin_bob');
  console.log('• Engineer:    eng_carol');
  console.log('• Intern:      intern_dave');
  console.log('• Auditor:     auditor_eve');
  console.log('• Decoy User:  admin.backup (Triggers Rule R2)');
  console.log('======================================================\n');

  await mongoose.disconnect();
}

seedDatabase().catch(err => {
  console.error('[Seed Error]', err);
  process.exit(1);
});
