// Seeds the database with default users, traps, files, and demo cases
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const connectDB = require('../config/db');
const settings = require('../config/settings');
const User = require('../models/User');
const File = require('../models/File');
const Decoy = require('../models/Decoy');
const Evidence = require('../models/Evidence');
const Event = require('../models/Event');
const Alert = require('../models/Alert');
const Incident = require('../models/Incident');
const { sha256, canonicalJson } = require('../utils/cryptoUtils');

// Creates a cryptographically linked evidence block in the SHA-256 chain
async function addBlock(seq, event, prevHash) {
  const ts = event.ts ? new Date(event.ts).toISOString() : new Date().toISOString();
  const payload = {
    seq,
    eventId: event._id.toString(),
    username: event.username,
    action: event.action,
    target: event.target,
    ip: event.ip || '127.0.0.1',
    ts,
    ruleHits: event.ruleHits || []
  };
  const hash = sha256(prevHash + canonicalJson(payload) + ts);
  await Evidence.create({ seq, eventId: event._id, payload, prevHash, hash, createdAt: event.ts || new Date() });
  return hash;
}

// Main function to seed users, traps, company files, and baseline demo cases
async function seedDatabase() {
  await connectDB();
  console.log('[Seed] Clearing existing collections...');
  await Promise.all([
    User.deleteMany({}), File.deleteMany({}), Decoy.deleteMany({}),
    Evidence.deleteMany({}), Event.deleteMany({}), Alert.deleteMany({}), Incident.deleteMany({})
  ]);

  const passwordHash = await bcrypt.hash(settings.PASSWORD, 10);

  // 1. Seed the 6 Users from settings
  console.log('[Seed] Creating 6 demo users...');
  const users = await User.create(settings.USERS.map(u => ({
    username: u.username,
    passwordHash,
    role: u.role,
    department: u.department,
    isDecoy: !!u.isDecoy,
    riskScore: 0,
    status: 'active'
  })));

  // 2. Seed the 6 Traps (3 files, 1 key, 1 account, 1 endpoint)
  console.log('[Seed] Creating 6 deception traps...');
  const decoys = await Decoy.create([
    { type: 'HONEYFILE', name: settings.TRAPS.files[0].name, location: settings.TRAPS.files[0].path, description: settings.TRAPS.files[0].description, severity: 'CRITICAL', enabled: true },
    { type: 'HONEYFILE', name: settings.TRAPS.files[1].name, location: settings.TRAPS.files[1].path, description: settings.TRAPS.files[1].description, severity: 'CRITICAL', enabled: true },
    { type: 'HONEYFILE', name: settings.TRAPS.files[2].name, location: settings.TRAPS.files[2].path, description: settings.TRAPS.files[2].description, severity: 'CRITICAL', enabled: true },
    { type: 'HONEYTOKEN', name: 'Canary Key', location: 'Search box input', tokenValue: settings.TRAPS.key, severity: 'CRITICAL', enabled: true },
    { type: 'DECOY_ACCOUNT', name: 'Fake Admin Account', location: 'Login portal', tokenValue: settings.TRAPS.account, severity: 'CRITICAL', enabled: true },
    { type: 'DECOY_ENDPOINT', name: 'Trap Export Address', location: settings.TRAPS.endpoint, description: 'Administrative shadow API', severity: 'CRITICAL', enabled: true }
  ]);

  // 3. Seed Company Files (4 normal + 3 traps)
  console.log('[Seed] Creating company files...');
  await File.create([
    { name: 'Employee_Handbook_2026.pdf', path: '/HR/Policies', department: 'HR', content: 'Acme Corp Handbook: Guidelines and Benefits.', sizeBytes: 2048500, mimeType: 'application/pdf', sensitivity: 'Internal' },
    { name: 'Leave_Policy.docx', path: '/HR/Policies', department: 'HR', content: 'Annual leave policy: 24 paid vacation days.', sizeBytes: 512000, mimeType: 'application/docx', sensitivity: 'Internal' },
    { name: 'Q3_Quarterly_Earnings.pdf', path: '/Finance/Reports', department: 'Finance', content: 'Q3 Earnings Report: 18% YoY growth.', sizeBytes: 4194304, mimeType: 'application/pdf', sensitivity: 'Confidential' },
    { name: 'Architecture_Guidelines.md', path: '/Engineering/Docs', department: 'Engineering', content: 'Engineering microservice zero-trust guidelines.', sizeBytes: 120400, mimeType: 'text/markdown', sensitivity: 'Internal' },
    { name: settings.TRAPS.files[0].name, path: '/HR/Compensation', department: 'HR', content: `CONFIDENTIAL EXECUTIVE SALARIES 2026. Key: ${settings.TRAPS.key}`, sizeBytes: 1420000, mimeType: 'application/vnd.ms-excel', sensitivity: 'Confidential', isDecoy: true, decoyId: decoys[0]._id },
    { name: settings.TRAPS.files[1].name, path: '/IT/Old_Archives', department: 'IT', content: `BACKUP CREDENTIALS: key=${settings.TRAPS.key}`, sizeBytes: 4096, mimeType: 'text/plain', sensitivity: 'Confidential', isDecoy: true, decoyId: decoys[1]._id },
    { name: settings.TRAPS.files[2].name, path: '/Finance/Archive', department: 'Finance', content: 'id,name,email\n1,Canary Client,canary@corp.internal', sizeBytes: 8388608, mimeType: 'text/csv', sensitivity: 'Confidential', isDecoy: true, decoyId: decoys[2]._id }
  ]);

  // 4. Seed Genesis Block (64 zeros)
  console.log('[Seed] Initializing Genesis block...');
  const genesisDate = new Date(Date.now() - 3600 * 1000 * 4);
  const genesisPayload = { seq: 0, message: 'GENESIS_EVIDENCE_ROOT', initializedAt: genesisDate.toISOString() };
  const genesisHash = sha256(settings.GENESIS_HASH + canonicalJson(genesisPayload) + genesisDate.toISOString());
  await Evidence.create({ seq: 0, eventId: new mongoose.Types.ObjectId(), payload: genesisPayload, prevHash: settings.GENESIS_HASH, hash: genesisHash, createdAt: genesisDate });

  // 5. Seed 2 Baseline Demo Cases with alerts and chained evidence
  console.log('[Seed] Seeding baseline demo cases...');
  const samarth = users.find(u => u.username === 'samarth');
  const aniket = users.find(u => u.username === 'aniket');
  const t1 = new Date(Date.now() - 3600 * 1000 * 2);
  const t2 = new Date(Date.now() - 3600 * 1000 * 1);

  // Case 1: samarth opened salary trap
  const evt1 = await Event.create({ userId: samarth._id, username: 'samarth', role: 'intern', action: 'FILE_VIEW', target: settings.TRAPS.files[0].path, ip: '10.0.0.45', ruleHits: ['R1'], ts: t1, metadata: { isDecoy: true } });
  const alert1 = await Alert.create({ eventId: evt1._id, userId: samarth._id, username: 'samarth', role: 'intern', severity: 'CRITICAL', score: 100, rulesFired: [{ ruleId: 'R1', ruleName: 'Trap file opened', points: 100, mitreTechnique: 'T1083' }], description: 'Triggered rules: Trap file opened', targetAsset: evt1.target, createdAt: t1 });
  const b1Hash = await addBlock(1, evt1, genesisHash);
  await Incident.create({
    title: 'Threat Case: samarth triggered R1',
    severity: 'CRITICAL',
    status: 'Open',
    suspectUserId: samarth._id,
    suspectUsername: 'samarth',
    eventIds: [evt1._id],
    alertIds: [alert1._id],
    mitreTechniques: ['T1083'],
    rootCause: `Accessed fake security trap: ${evt1.target} (Trap file opened)`,
    recommendation: '1. Revoke active session tokens and reset password. 2. Interview employee regarding unauthorized file access.',
    createdAt: t1
  });

  // Case 2: aniket night download
  const evt2 = await Event.create({ userId: aniket._id, username: 'aniket', role: 'engineer', action: 'FILE_DOWNLOAD', target: '/Engineering/Docs/Architecture_Guidelines.md', ip: '10.0.0.12', ruleHits: ['R4', 'R5'], ts: t2 });
  const alert2 = await Alert.create({ eventId: evt2._id, userId: aniket._id, username: 'aniket', role: 'engineer', severity: 'HIGH', score: 45, rulesFired: [{ ruleId: 'R4', ruleName: 'Night-time access (outside 9 AM to 7 PM)', points: 15, mitreTechnique: 'T1078' }, { ruleId: 'R5', ruleName: 'Too many downloads (more than 10 in 5 minutes)', points: 30, mitreTechnique: 'T1005' }], description: 'Triggered rules: Night-time access, Too many downloads', targetAsset: evt2.target, createdAt: t2 });
  await addBlock(2, evt2, b1Hash);
  await Incident.create({
    title: 'Threat Case: aniket triggered R4, R5',
    severity: 'HIGH',
    status: 'Checking',
    suspectUserId: aniket._id,
    suspectUsername: 'aniket',
    eventIds: [evt2._id],
    alertIds: [alert2._id],
    mitreTechniques: ['T1078', 'T1005'],
    rootCause: `Off-hours mass download on ${evt2.target} (Night-time access, Too many downloads)`,
    recommendation: '1. Revoke active session tokens and reset password. 2. Interview employee regarding unauthorized file access.',
    createdAt: t2
  });

  await User.findByIdAndUpdate(samarth._id, { riskScore: 100, status: 'flagged' });
  await User.findByIdAndUpdate(aniket._id, { riskScore: 45, status: 'active' });
  await Decoy.findByIdAndUpdate(decoys[0]._id, { $inc: { triggerCount: 1 }, lastTriggeredAt: t1 });

  console.log('[Seed] Seeding completed successfully!');
  await mongoose.disconnect();
}

seedDatabase().catch(err => {
  console.error('[Seed Error]', err);
  process.exit(1);
});
