// Automated unit tests verifying the evidence chain, tamper detection, score decay, and the 5 test attacks
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const connectDB = require('../src/config/db');
const settings = require('../src/config/settings');
const ForensicsChain = require('../src/services/ForensicsChain');
const RulesEngine = require('../src/services/RulesEngine');
const Event = require('../src/models/Event');
const User = require('../src/models/User');

test('DeceptiGuard Unit Tests: Hash Chain, Decay, and 5 Test Attacks', async (t) => {
  await connectDB();
  const rulesEngine = new RulesEngine();

  // Test 1: Pristine Hash Chain Verification
  await t.test('Test 1: Pristine Hash Chain Verification', async () => {
    const verification = await ForensicsChain.verifyChain();
    assert.strictEqual(verification.valid, true, 'Pristine hash chain must be 100% valid');
  });

  // Test 2: Tamper Simulation and Break Detection
  await t.test('Test 2: Tamper Simulation and Break Detection', async () => {
    const tamperRes = await ForensicsChain.simulateTampering();
    assert.ok(tamperRes.tamperedSeq !== undefined, 'Must identify tampered sequence number');

    const verifyTampered = await ForensicsChain.verifyChain();
    assert.strictEqual(verifyTampered.valid, false, 'Chain verification must FAIL when tampered');
    assert.strictEqual(verifyTampered.brokenSeq, tamperRes.tamperedSeq, 'Must detect exact broken sequence');

    // Restore chain integrity
    await ForensicsChain.restoreChain();
    const verifyRestored = await ForensicsChain.verifyChain();
    assert.strictEqual(verifyRestored.valid, true, 'Chain must be valid after restoration');
  });

  // Test 3: Score Decay (10% per hour)
  await t.test('Test 3: Score Decay Calculation (10% drop per hour)', () => {
    const score = 100;
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600 * 1000);
    const decayed = RulesEngine.computeDecayedScore(score, oneHourAgo);
    assert.strictEqual(decayed, 90, 'Score 100 after 1 hour should decay by 10% to 90');
  });

  // Test 4: Attack 1 - Curious Intern (samarth opens salary trap file -> R1)
  await t.test('Test 4: Attack 1 - Curious Intern triggers Rule R1', async () => {
    const user = await User.findOne({ username: 'samarth' });
    const dayTime = new Date();
    dayTime.setHours(14, 0, 0, 0); // 2:00 PM (business hours)

    const rawEvent = await Event.create({
      userId: user?._id,
      username: 'samarth',
      role: 'intern',
      action: 'FILE_VIEW',
      target: settings.TRAPS.files[0].path,
      ip: '10.0.0.45',
      ts: dayTime,
      metadata: { isDecoy: true }
    });
    const result = await rulesEngine.processEvent(rawEvent);
    assert.ok(result.firedRules.some(r => r.id === 'R1'), 'Rule R1 must fire');
    assert.strictEqual(result.addedScore, 100, 'R1 must add 100 points');
  });

  // Test 5: Attack 2 - Fake Admin Login (admin.backup login + trap address -> R2, R1)
  await t.test('Test 5: Attack 2 - Fake Admin Login triggers Rules R2 and R1', async () => {
    const decoyUser = await User.findOne({ username: settings.TRAPS.account });
    const dayTime = new Date();
    dayTime.setHours(14, 0, 0, 0);

    const evtLogin = await Event.create({
      userId: decoyUser?._id,
      username: settings.TRAPS.account,
      role: 'admin',
      action: 'LOGIN_FAILED',
      target: `Decoy Admin Account Authentication (${settings.TRAPS.account})`,
      ip: '192.168.1.105',
      ts: dayTime,
      metadata: { isDecoyAccount: true }
    });
    const resLogin = await rulesEngine.processEvent(evtLogin);
    assert.ok(resLogin.firedRules.some(r => r.id === 'R2'), 'Rule R2 must fire on decoy account login');

    const evtAddress = await Event.create({
      userId: decoyUser?._id,
      username: settings.TRAPS.account,
      role: 'admin',
      action: 'DECOY_ENDPOINT_HIT',
      target: settings.TRAPS.endpoint,
      ip: '192.168.1.105',
      ts: dayTime,
      metadata: { isDecoy: true }
    });
    const resAddress = await rulesEngine.processEvent(evtAddress);
    assert.ok(resAddress.firedRules.some(r => r.id === 'R1'), 'Rule R1 must fire on trap web address hit');
  });

  // Test 6: Attack 3 - Night Download (aniket downloads 12 files at 2 AM -> R4, R5)
  await t.test('Test 6: Attack 3 - Night Download triggers Rules R4 and R5', async () => {
    const user = await User.findOne({ username: 'aniket' });
    const twoAm = new Date();
    twoAm.setHours(2, 0, 0, 0);

    for (let i = 0; i < 11; i++) {
      await Event.create({
        userId: user?._id,
        username: 'aniket',
        role: 'engineer',
        action: 'FILE_DOWNLOAD',
        target: `/Engineering/SourceCode/driver_part_${i}.tar.gz`,
        ip: '10.0.0.12',
        ts: new Date(twoAm.getTime() - (11 - i) * 1000)
      });
    }

    const rawEvent = await Event.create({
      userId: user?._id,
      username: 'aniket',
      role: 'engineer',
      action: 'FILE_DOWNLOAD',
      target: '/Engineering/SourceCode/Kernel_Drivers_Archive.tar.gz',
      ip: '10.0.0.12',
      ts: twoAm
    });
    const result = await rulesEngine.processEvent(rawEvent);
    assert.ok(result.firedRules.some(r => r.id === 'R4'), 'Rule R4 (Night-time) must fire');
    assert.ok(result.firedRules.some(r => r.id === 'R5'), 'Rule R5 (Too many downloads) must fire');
    assert.strictEqual(result.addedScore, 45, 'R4 + R5 must add 15 + 30 = 45 points');
  });

  // Test 7: Attack 4 - Stolen Key (pranav searches fake key -> R3)
  await t.test('Test 7: Attack 4 - Stolen Key triggers Rule R3', async () => {
    const user = await User.findOne({ username: 'pranav' });
    const dayTime = new Date();
    dayTime.setHours(14, 0, 0, 0);

    const rawEvent = await Event.create({
      userId: user?._id,
      username: 'pranav',
      role: 'finance',
      action: 'HONEYTOKEN_SUBMIT',
      target: `/portal/search?q=${settings.TRAPS.key}`,
      ip: '10.0.0.88',
      ts: dayTime,
      metadata: { honeytokenHit: true, tokenValue: settings.TRAPS.key, searchQuery: settings.TRAPS.key }
    });
    const result = await rulesEngine.processEvent(rawEvent);
    assert.ok(result.firedRules.some(r => r.id === 'R3'), 'Rule R3 must fire');
    assert.strictEqual(result.addedScore, 100, 'R3 must add 100 points');
  });

  // Test 8: Attack 5 - Normal Day (mugdha opens allowed file at 11 AM -> NO alert)
  await t.test('Test 8: Attack 5 - Normal Day triggers NO alert', async () => {
    const user = await User.findOne({ username: 'mugdha' });
    const elevenAm = new Date();
    elevenAm.setHours(11, 0, 0, 0);

    const rawEvent = await Event.create({
      userId: user?._id,
      username: 'mugdha',
      role: 'hr',
      action: 'FILE_VIEW',
      target: '/HR/Policies/Employee_Handbook_2026.pdf',
      ip: '10.0.0.5',
      ts: elevenAm,
      metadata: { isDecoy: false }
    });
    const result = await rulesEngine.processEvent(rawEvent);
    assert.strictEqual(result.firedRules.length, 0, 'No rules should fire during normal access');
    assert.strictEqual(result.addedScore, 0, '0 points added during normal access');
  });

  await mongoose.disconnect();
});
