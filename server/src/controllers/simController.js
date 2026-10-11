const User = require('../models/User');
const File = require('../models/File');
const Event = require('../models/Event');

class SimController {
  static async runScenario(req, res, rulesEngine) {
    const { scenarioId } = req.params;
    const startTime = Date.now();

    try {
      if (scenarioId === 'S1') {
        // S1 Curious employee: opens Salary_Revision_2026_CONFIDENTIAL.xlsx
        const user = await User.findOne({ username: 'intern_dave' });
        const rawEvent = await Event.create({
          userId: user?._id,
          username: 'intern_dave',
          role: 'intern',
          action: 'FILE_VIEW',
          target: '/HR/Compensation/Salary_Revision_2026_CONFIDENTIAL.xlsx',
          ip: '10.0.0.45',
          metadata: { isDecoy: true, sensitivity: 'Confidential' }
        });
        const result = await rulesEngine.processEvent(rawEvent);
        const mttdMs = Date.now() - startTime;
        return res.json({
          scenario: 'S1',
          name: 'Curious Intern accessing Honeyfile',
          expectedAlert: 'CRITICAL (Rule R1)',
          mttdMs,
          result
        });
      }

      if (scenarioId === 'S2') {
        // S2 Disgruntled admin: tries login as admin.backup and calls /api/v1/admin/export-all
        const decoyUser = await User.findOne({ username: 'admin.backup' });
        const evt1 = await Event.create({
          userId: decoyUser?._id,
          username: 'admin.backup',
          role: 'admin',
          action: 'LOGIN_FAILED',
          target: 'Decoy Administrator Account Authentication (admin.backup)',
          ip: '192.168.1.105',
          metadata: { isDecoyAccount: true }
        });
        const res1 = await rulesEngine.processEvent(evt1);

        const evt2 = await Event.create({
          userId: decoyUser?._id,
          username: 'admin.backup',
          role: 'admin',
          action: 'DECOY_ENDPOINT_HIT',
          target: '/api/v1/admin/export-all',
          ip: '192.168.1.105',
          metadata: { isDecoy: true }
        });
        const res2 = await rulesEngine.processEvent(evt2);

        const mttdMs = Date.now() - startTime;
        return res.json({
          scenario: 'S2',
          name: 'Decoy Admin Account & Endpoint Probing',
          expectedAlert: 'CRITICAL (Rules R2 & R1)',
          mttdMs,
          events: [res1, res2]
        });
      }

      if (scenarioId === 'S3') {
        // S3 Data exfiltrator: after-hours bulk download of 25 files
        const user = await User.findOne({ username: 'eng_carol' });
        const afterHoursTs = new Date();
        afterHoursTs.setHours(2, 30, 0, 0); // 02:30 AM

        const rawEvent = await Event.create({
          userId: user?._id,
          username: 'eng_carol',
          role: 'engineer',
          action: 'FILE_DOWNLOAD',
          target: '/Engineering/SourceCode/Kernel_Drivers_Archive.tar.gz',
          ip: '10.0.0.12',
          ts: afterHoursTs,
          metadata: { bulkCount: 25, sensitivity: 'Confidential' }
        });
        const result = await rulesEngine.processEvent(rawEvent);
        const mttdMs = Date.now() - startTime;
        return res.json({
          scenario: 'S3',
          name: 'After-Hours Bulk Data Staging & Exfiltration',
          expectedAlert: 'HIGH (Rules R4 & R5)',
          mttdMs,
          result
        });
      }

      if (scenarioId === 'S4') {
        // S4 Credential thief: submits canary API key
        const user = await User.findOne({ username: 'fin_bob' });
        const rawEvent = await Event.create({
          userId: user?._id,
          username: 'fin_bob',
          role: 'finance',
          action: 'HONEYTOKEN_SUBMIT',
          target: '/portal/search?q=canary_sec_key_99x88a77b',
          ip: '10.0.0.88',
          metadata: { honeytokenHit: true, tokenValue: 'canary_sec_key_99x88a77b' }
        });
        const result = await rulesEngine.processEvent(rawEvent);
        const mttdMs = Date.now() - startTime;
        return res.json({
          scenario: 'S4',
          name: 'Honeytoken Canary Credential Replay',
          expectedAlert: 'CRITICAL (Rule R3)',
          mttdMs,
          result
        });
      }

      if (scenarioId === 'S5') {
        // S5 Benign normal user: regular work, no alerts
        const user = await User.findOne({ username: 'hr_alice' });
        const dayTs = new Date();
        dayTs.setHours(11, 0, 0, 0); // 11:00 AM

        const rawEvent = await Event.create({
          userId: user?._id,
          username: 'hr_alice',
          role: 'hr',
          action: 'FILE_VIEW',
          target: '/HR/Policies/Employee_Handbook_2026.pdf',
          ip: '10.0.0.5',
          ts: dayTs,
          metadata: { isDecoy: false, sensitivity: 'Internal' }
        });
        const result = await rulesEngine.processEvent(rawEvent);
        const mttdMs = Date.now() - startTime;
        return res.json({
          scenario: 'S5',
          name: 'Benign Employee Legitimate Access',
          expectedAlert: 'NONE (0% False Positive Baseline)',
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
