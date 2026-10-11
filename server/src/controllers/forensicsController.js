const ForensicsChain = require('../services/ForensicsChain');
const Incident = require('../models/Incident');
const CustodyLog = require('../models/CustodyLog');
const { sha256, canonicalJson } = require('../utils/cryptoUtils');

class ForensicsController {
  static async verify(req, res) {
    try {
      const result = await ForensicsChain.verifyChain();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Chain verification failed', details: err.message });
    }
  }

  static async tamperDemo(req, res) {
    try {
      const result = await ForensicsChain.simulateTampering();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Tamper simulation failed', details: err.message });
    }
  }

  static async restoreChain(req, res) {
    try {
      const result = await ForensicsChain.restoreChain();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Chain restoration failed', details: err.message });
    }
  }

  static async getIncidents(req, res) {
    try {
      const incidents = await Incident.find().sort({ createdAt: -1 });
      res.json({ incidents });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch incidents' });
    }
  }

  static async getIncidentById(req, res) {
    try {
      const { id } = req.params;
      const incident = await Incident.findById(id)
        .populate('eventIds')
        .populate('alertIds');
      if (!incident) return res.status(404).json({ error: 'Incident not found' });

      const logs = await CustodyLog.find({ incidentId: id }).sort({ ts: 1 });
      res.json({ incident, custodyLogs: logs });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch incident details' });
    }
  }

  static async updateIncidentStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, note } = req.body;
      const actor = req.user ? req.user.username : 'soc_analyst';

      const incident = await Incident.findById(id);
      if (!incident) return res.status(404).json({ error: 'Incident not found' });

      const oldStatus = incident.status;
      incident.status = status;
      if (status === 'Closed') {
        incident.closedAt = new Date();
      }
      if (note) {
        incident.notes.push({
          author: actor,
          content: note,
          createdAt: new Date()
        });
      }
      await incident.save();

      // ISO 27037 Custody Log Entry
      await CustodyLog.create({
        incidentId: incident._id,
        actor,
        action: 'STATUS_TRANSITION',
        detail: `Status updated from ${oldStatus} to ${status}. Note: ${note || 'None'}`
      });

      res.json({ incident });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update incident' });
    }
  }

  static async exportReport(req, res) {
    try {
      const { id } = req.params;
      const { format } = req.query; // 'pdf', 'json', 'csv'
      const actor = req.user ? req.user.username : 'forensic_investigator';

      const incident = await Incident.findById(id).populate('eventIds').populate('alertIds');
      if (!incident) return res.status(404).json({ error: 'Incident not found' });

      if (format === 'pdf') {
        // Log export in custody log with placeholder hash
        await CustodyLog.create({
          incidentId: incident._id,
          actor,
          action: 'REPORT_EXPORTED_PDF',
          detail: `PDF incident dossier generated and dispatched to investigator.`
        });
        return ForensicsChain.generateIncidentPdf(id, res);
      }

      if (format === 'csv') {
        const rows = [
          ['EventID', 'Timestamp', 'Action', 'Target', 'IP', 'RuleHits'].join(','),
          ...(incident.eventIds || []).map(e => 
            [e._id, new Date(e.ts).toISOString(), e.action, `"${e.target}"`, e.ip, `"${(e.ruleHits||[]).join(';')}"`].join(',')
          )
        ].join('\n');

        const fileDigest = sha256(rows);
        await CustodyLog.create({
          incidentId: incident._id,
          actor,
          action: 'REPORT_EXPORTED_CSV',
          detail: `CSV timeline report exported.`,
          fileSha256: fileDigest
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="Incident_${id}_Timeline.csv"`);
        return res.send(rows);
      }

      // Default JSON Export with Cryptographic Hash Manifest
      const jsonPayload = {
        incident,
        generatedAt: new Date().toISOString(),
        evidentiaryStandard: 'ISO/IEC 27037:2012'
      };
      const canonicalData = canonicalJson(jsonPayload);
      const fileDigest = sha256(canonicalData);

      await CustodyLog.create({
        incidentId: incident._id,
        actor,
        action: 'REPORT_EXPORTED_JSON',
        detail: `JSON forensic manifest created.`,
        fileSha256: fileDigest
      });

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="Incident_${id}_Manifest.json"`);
      return res.json({
        ...jsonPayload,
        manifestSha256: fileDigest
      });
    } catch (err) {
      console.error('[Export Error]', err);
      res.status(500).json({ error: 'Report export failed' });
    }
  }

  static async getCustodyLogs(req, res) {
    try {
      const logs = await CustodyLog.find().sort({ ts: -1 }).limit(100);
      res.json({ custodyLogs: logs });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch custody logs' });
    }
  }
}

module.exports = ForensicsController;
