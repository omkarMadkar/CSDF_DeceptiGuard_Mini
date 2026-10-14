// Manages evidence chain verification, tamper testing, case files, and court-admissible PDF reports
const ForensicsChain = require('../services/ForensicsChain');
const Incident = require('../models/Incident');

class ForensicsController {
  // Verifies the cryptographic SHA-256 integrity of all blocks in the evidence chain
  static async verify(req, res) {
    try {
      const result = await ForensicsChain.verifyChain();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Chain verification failed', details: err.message });
    }
  }

  // Lab demo only: modifies block #1 in the database to demonstrate tamper detection
  static async tamperDemo(req, res) {
    try {
      const result = await ForensicsChain.simulateTampering();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Tamper simulation failed', details: err.message });
    }
  }

  // Lab demo only: restores original evidence blocks and recalculates valid SHA-256 hashes
  static async restoreChain(req, res) {
    try {
      const result = await ForensicsChain.restoreChain();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Chain restoration failed', details: err.message });
    }
  }

  // Returns all recorded incident threat cases
  static async getIncidents(req, res) {
    try {
      const incidents = await Incident.find().sort({ createdAt: -1 });
      res.json({ incidents });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch incidents' });
    }
  }

  // Returns detailed information for a single incident case
  static async getIncidentById(req, res) {
    try {
      const { id } = req.params;
      const incident = await Incident.findById(id).populate('eventIds').populate('alertIds');
      if (!incident) return res.status(404).json({ error: 'Incident not found' });
      res.json({ incident });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch incident details' });
    }
  }

  // Updates the triage status of an incident (Open, Checking, Closed)
  static async updateIncidentStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const incident = await Incident.findById(id);
      if (!incident) return res.status(404).json({ error: 'Incident not found' });

      incident.status = status;
      if (status === 'Closed') {
        incident.closedAt = new Date();
      }
      await incident.save();

      res.json({ incident });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update incident' });
    }
  }

  // Generates and streams the formal PDF forensic investigation report
  static async exportReport(req, res) {
    try {
      const { id } = req.params;
      const incident = await Incident.findById(id);
      if (!incident) return res.status(404).json({ error: 'Incident not found' });
      return ForensicsChain.generateIncidentPdf(id, res);
    } catch (err) {
      console.error('[Export Error]', err);
      res.status(500).json({ error: 'Report export failed' });
    }
  }
}

module.exports = ForensicsController;
