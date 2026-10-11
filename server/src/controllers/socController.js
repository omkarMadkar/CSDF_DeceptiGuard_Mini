const Alert = require('../models/Alert');
const User = require('../models/User');
const Incident = require('../models/Incident');
const Decoy = require('../models/Decoy');
const Event = require('../models/Event');

class SocController {
  static async getStats(req, res) {
    try {
      const totalAlerts = await Alert.countDocuments();
      const criticalAlerts = await Alert.countDocuments({ severity: 'CRITICAL' });
      const openIncidents = await Incident.countDocuments({ status: { $in: ['Open', 'Investigating'] } });
      const totalDecoys = await Decoy.countDocuments();
      const triggeredDecoys = await Decoy.countDocuments({ triggerCount: { $gt: 0 } });
      const flaggedUsers = await User.countDocuments({ status: 'flagged' });

      // Simulated MTTD metric (Mean Time to Detect)
      const mttdSeconds = totalAlerts > 0 ? 1.42 : 0;

      res.json({
        totalAlerts,
        criticalAlerts,
        openIncidents,
        totalDecoys,
        triggeredDecoys,
        flaggedUsers,
        mttdSeconds
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch SOC metrics' });
    }
  }

  static async getAlerts(req, res) {
    try {
      const alerts = await Alert.find().sort({ createdAt: -1 }).limit(50);
      res.json({ alerts });
    } catch (err) {
      res.status(500).json({ error: 'Failed to retrieve alerts' });
    }
  }

  static async getLeaderboard(req, res) {
    try {
      const users = await User.find({ isDecoy: false })
        .select('username role department status riskScore lastScoreUpdate flaggedReason')
        .sort({ riskScore: -1 })
        .limit(10);
      res.json({ leaderboard: users });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch risk leaderboard' });
    }
  }

  static async getDecoys(req, res) {
    try {
      const decoys = await Decoy.find().sort({ type: 1, name: 1 });
      res.json({ decoys });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch deception registry' });
    }
  }

  static async toggleDecoy(req, res) {
    try {
      const { id } = req.params;
      const decoy = await Decoy.findById(id);
      if (!decoy) return res.status(404).json({ error: 'Decoy not found' });
      decoy.enabled = !decoy.enabled;
      await decoy.save();
      res.json({ decoy });
    } catch (err) {
      res.status(500).json({ error: 'Failed to toggle decoy' });
    }
  }

  static async getHeatmap(req, res) {
    try {
      // Group access events by hour of the day (0-23)
      const events = await Event.find().select('ts');
      const hourCounts = new Array(24).fill(0);
      events.forEach(e => {
        const hour = new Date(e.ts).getHours();
        hourCounts[hour]++;
      });
      res.json({
        heatmap: hourCounts.map((count, hour) => ({
          hour: `${hour.toString().padStart(2, '0')}:00`,
          count,
          isAfterHours: hour < 9 || hour >= 19
        }))
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch heatmap' });
    }
  }
}

module.exports = SocController;
