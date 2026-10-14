// Returns aggregated metrics, security alerts, user risk scores, and trap statistics
const Alert = require('../models/Alert');
const User = require('../models/User');
const Incident = require('../models/Incident');
const Decoy = require('../models/Decoy');

class SocController {
  // Returns summary counts for the 4 dashboard number cards
  static async getStats(req, res) {
    try {
      const totalAlerts = await Alert.countDocuments();
      const criticalAlerts = await Alert.countDocuments({ severity: 'CRITICAL' });
      const openIncidents = await Incident.countDocuments({ status: { $in: ['Open', 'Checking'] } });
      const triggeredDecoys = await Decoy.countDocuments({ triggerCount: { $gt: 0 } });

      res.json({
        totalAlerts,
        criticalAlerts,
        openIncidents,
        triggeredDecoys
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch SOC metrics' });
    }
  }

  // Returns the latest 50 security threat alerts
  static async getAlerts(req, res) {
    try {
      const alerts = await Alert.find().sort({ createdAt: -1 }).limit(50);
      res.json({ alerts });
    } catch (err) {
      res.status(500).json({ error: 'Failed to retrieve alerts' });
    }
  }

  // Returns the user risk score leaderboard sorted from highest risk to lowest
  static async getLeaderboard(req, res) {
    try {
      const users = await User.find({ isDecoy: false })
        .select('username role department status riskScore lastScoreUpdate')
        .sort({ riskScore: -1 })
        .limit(10);
      res.json({ leaderboard: users });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch risk leaderboard' });
    }
  }

  // Returns the list of active deception traps with their hit counts
  static async getDecoys(req, res) {
    try {
      const decoys = await Decoy.find().sort({ type: 1, name: 1 });
      res.json({ decoys });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch deception traps' });
    }
  }
}

module.exports = SocController;
