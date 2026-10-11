const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const connectDB = require('../src/config/db');
const ForensicsChain = require('../src/services/ForensicsChain');
const RulesEngine = require('../src/services/RulesEngine');
const Event = require('../src/models/Event');

test('DeceptiGuard Unit Tests: Hash Chain & Rules Engine', async (t) => {
  await connectDB();

  await t.test('Test 1: Pristine Hash Chain Verification', async () => {
    const verification = await ForensicsChain.verifyChain();
    assert.strictEqual(verification.valid, true, 'Pristine hash chain must be 100% valid');
  });

  await t.test('Test 2: Evidence Appending & Hash Linkage', async () => {
    const testEvent = await Event.create({
      username: 'test_analyst',
      action: 'FILE_VIEW',
      target: '/HR/Policies/Employee_Handbook_2026.pdf',
      ip: '127.0.0.1'
    });
    const block = await ForensicsChain.appendEvidence(testEvent._id, testEvent);
    assert.ok(block, 'New evidence block must be created');
    assert.ok(block.hash, 'Block must contain SHA-256 hash');
    assert.ok(block.prevHash, 'Block must link to previous hash');

    const verifyAfterAppend = await ForensicsChain.verifyChain();
    assert.strictEqual(verifyAfterAppend.valid, true, 'Chain must remain valid after append');
  });

  await t.test('Test 3: Tamper Simulation and Break Detection', async () => {
    const tamperRes = await ForensicsChain.simulateTampering();
    assert.ok(tamperRes.tamperedSeq !== undefined, 'Must identify tampered sequence number');

    const verifyTampered = await ForensicsChain.verifyChain();
    assert.strictEqual(verifyTampered.valid, false, 'Chain verification must FAIL when tampered');
    assert.strictEqual(verifyTampered.brokenSeq, tamperRes.tamperedSeq, 'Must detect exact broken sequence');

    // Restore chain integrity for subsequent lab usage
    await ForensicsChain.restoreChain();
    const verifyRestored = await ForensicsChain.verifyChain();
    assert.strictEqual(verifyRestored.valid, true, 'Chain must be valid after restoration');
  });

  await t.test('Test 4: Rules Engine Decay Calculation', () => {
    const score = 100;
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600 * 1000);
    const decayed = RulesEngine.computeDecayedScore(score, oneHourAgo);
    assert.strictEqual(decayed, 90, 'Score 100 after 1 hour should decay by 10% to 90');
  });

  await mongoose.disconnect();
});
