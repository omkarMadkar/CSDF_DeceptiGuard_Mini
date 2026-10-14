// Runs the 5 test attack scenarios to demonstrate trap detection and measuring MTTD
const User = require('../models/User');
const Event = require('../models/Event');
const settings = require('../config/settings');

class SimController {
  // Executes one of the 5 predefined attack scenarios and measures time-to-detect
  static async runScenario(req, res, rulesEngine) {
    const { scenarioId } = req.params;
    const startTime = Date.now();

    try {
      // 1. Curious Intern: samarth opens the salary trap file
      if (scenarioId === 'S1') {
        const user = await User.findOne({ username: 'samarth' });
        const dayTime = new Date();
        dayTime.setHours(14, 0, 0, 0); // 2:00 PM (Business hours)

        const rawEvent = await Event.create({
          userId: user?._id,
          username: 'samarth',
          role: 'intern',
          action: 'FILE_VIEW',
          target: settings.TRAPS.files[0].path,
          ip: '10.0.0.45',
          ts: dayTime,
          metadata: { isDecoy: true, sensitivity: 'Confidential' }
        });
        const result = await rulesEngine.processEvent(rawEvent);
        const mttdMs = Date.now() - startTime;
        return res.json({
          scenario: 'S1',
          name: 'Curious Intern',
          who: 'samarth',
          what: `Opened salary trap file (${settings.TRAPS.files[0].name})`,
          expected: 'Critical alert (R1)',
          rulesFired: result.firedRules.map(r => `${r.id}: ${r.name}`),
          points: result.addedScore,
          mttdMs,
          result
        });
      }

      // 2. Fake Admin Login: admin.backup attempts login and calls trap web address
      if (scenarioId === 'S2') {
        const decoyUser = await User.findOne({ username: settings.TRAPS.account });
        const dayTime = new Date();
        dayTime.setHours(14, 0, 0, 0);

        const evt1 = await Event.create({
          userId: decoyUser?._id,
          username: settings.TRAPS.account,
          role: 'admin',
          action: 'LOGIN_FAILED',
          target: `Decoy Admin Account Authentication (${settings.TRAPS.account})`,
          ip: '192.168.1.105',
          ts: dayTime,
          metadata: { isDecoyAccount: true }
        });
        const res1 = await rulesEngine.processEvent(evt1);

        const evt2 = await Event.create({
          userId: decoyUser?._id,
          username: settings.TRAPS.account,
          role: 'admin',
          action: 'DECOY_ENDPOINT_HIT',
          target: settings.TRAPS.endpoint,
          ip: '192.168.1.105',
          ts: dayTime,
          metadata: { isDecoy: true }
        });
        const res2 = await rulesEngine.processEvent(evt2);

        const mttdMs = Date.now() - startTime;
        const allRules = [...(res1.firedRules || []), ...(res2.firedRules || [])];
        const totalPoints = (res1.addedScore || 0) + (res2.addedScore || 0);

        return res.json({
          scenario: 'S2',
          name: 'Fake Admin Login',
          who: 'admin.backup',
          what: `Decoy admin login attempt and called trap address (${settings.TRAPS.endpoint})`,
          expected: 'Critical alerts (R2, R1)',
          rulesFired: allRules.map(r => `${r.id}: ${r.name}`),
          points: totalPoints,
          mttdMs,
          events: [res1, res2]
        });
      }

      // 3. Night Download: aniket downloads 12 files at 2 AM
      if (scenarioId === 'S3') {
        const user = await User.findOne({ username: 'aniket' });
        const twoAm = new Date();
        twoAm.setHours(2, 0, 0, 0);

        // Pre-insert 11 prior downloads in the 5-minute window
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

        // 12th download triggers both R4 (Night-time) and R5 (Too many downloads)
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
        const mttdMs = Date.now() - startTime;

        return res.json({
          scenario: 'S3',
          name: 'Night Download',
          who: 'aniket',
          what: 'Downloaded 12 files at 2:00 AM (Outside 9 AM - 7 PM)',
          expected: 'High alert (R4, R5)',
          rulesFired: result.firedRules.map(r => `${r.id}: ${r.name}`),
          points: result.addedScore,
          mttdMs,
          result
        });
      }

      // 4. Stolen Key: pranav types the fake canary key in search
      if (scenarioId === 'S4') {
        const user = await User.findOne({ username: 'pranav' });
        const dayTime = new Date();
        dayTime.setHours(14, 0, 0, 0); // 2:00 PM (Business hours)

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
        const mttdMs = Date.now() - startTime;

        return res.json({
          scenario: 'S4',
          name: 'Stolen Key',
          who: 'pranav',
          what: `Typed fake key into search (${settings.TRAPS.key})`,
          expected: 'Critical alert (R3)',
          rulesFired: result.firedRules.map(r => `${r.id}: ${r.name}`),
          points: result.addedScore,
          mttdMs,
          result
        });
      }

      // 5. Normal Day: mugdha opens an allowed file at 11 AM
      if (scenarioId === 'S5') {
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
          metadata: { isDecoy: false, sensitivity: 'Internal' }
        });
        const result = await rulesEngine.processEvent(rawEvent);
        const mttdMs = Date.now() - startTime;

        return res.json({
          scenario: 'S5',
          name: 'Normal Day',
          who: 'mugdha',
          what: 'Opened allowed file (Employee_Handbook_2026.pdf) at 11:00 AM',
          expected: 'NO alert',
          rulesFired: result.firedRules.map(r => `${r.id}: ${r.name}`),
          points: result.addedScore,
          mttdMs,
          result
        });
      }

      return res.status(400).json({ error: 'Invalid scenario ID. Use S1, S2, S3, S4, or S5.' });
    } catch (err) {
      console.error('[Sim Error]', err);
      res.status(500).json({ error: 'Failed to run scenario', details: err.message });
    }
  }
}

module.exports = SimController;
