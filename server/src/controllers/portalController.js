// Handles file browsing, file viewing, file downloads, search, and trap address interception
const File = require('../models/File');
const Event = require('../models/Event');

class PortalController {
  // Returns available company files and disguised trap files for browsing
  static async getFiles(req, res, rulesEngine) {
    try {
      const user = req.user;
      const { path } = req.query;

      let query = {};
      if (path) {
        query.path = new RegExp(`^${path}`, 'i');
      } else if (user.role !== 'admin') {
        query = {
          $or: [
            { department: user.department },
            { isDecoy: true }
          ]
        };
      }

      const files = await File.find(query).select('-content');
      const sanitized = files.map(f => ({
        _id: f._id,
        name: f.name,
        path: f.path,
        department: f.department,
        sizeBytes: f.sizeBytes,
        mimeType: f.mimeType,
        sensitivity: f.sensitivity,
        updatedAt: f.updatedAt
      }));

      res.json({ files: sanitized });
    } catch (err) {
      console.error('[Portal Error]', err);
      res.status(500).json({ error: 'Failed to retrieve files' });
    }
  }

  // Opens a file and checks whether opening a trap file triggers Rule R1
  static async viewFile(req, res, rulesEngine) {
    try {
      const { id } = req.params;
      const user = req.user;
      const file = await File.findById(id);

      if (!file) {
        return res.status(404).json({ error: 'Document not found' });
      }

      const rawEvent = await Event.create({
        userId: user.userId,
        username: user.username,
        role: user.role,
        action: 'FILE_VIEW',
        target: `${file.path}/${file.name}`,
        ip: req.ip || '127.0.0.1',
        metadata: {
          isDecoy: file.isDecoy,
          sensitivity: file.sensitivity
        }
      });

      const outcome = await rulesEngine.processEvent(rawEvent);

      res.json({
        file: {
          id: file._id,
          name: file.name,
          path: file.path,
          department: file.department,
          content: file.content,
          sensitivity: file.sensitivity
        },
        alertTriggered: outcome.firedRules.length > 0
      });
    } catch (err) {
      console.error('[File View Error]', err);
      res.status(500).json({ error: 'Failed to open document' });
    }
  }

  // Allows file download and records download telemetry for Rule R5 evaluation
  static async downloadFile(req, res, rulesEngine) {
    try {
      const { id } = req.params;
      const user = req.user;
      const file = await File.findById(id);

      if (!file) return res.status(404).json({ error: 'File not found' });

      const rawEvent = await Event.create({
        userId: user.userId,
        username: user.username,
        role: user.role,
        action: 'FILE_DOWNLOAD',
        target: `${file.path}/${file.name}`,
        ip: req.ip || '127.0.0.1',
        metadata: {
          isDecoy: file.isDecoy,
          sensitivity: file.sensitivity
        }
      });

      await rulesEngine.processEvent(rawEvent);

      res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
      res.setHeader('Content-Type', 'text/plain');
      res.send(file.content || 'Acme Corp Proprietary File Content');
    } catch (err) {
      res.status(500).json({ error: 'Download failed' });
    }
  }

  // Searches documents by keyword and detects if the fake canary key was queried (Rule R3)
  static async searchFiles(req, res, rulesEngine) {
    try {
      const { q } = req.query;
      const user = req.user;

      const rawEvent = await Event.create({
        userId: user.userId,
        username: user.username,
        role: user.role,
        action: 'SEARCH',
        target: `/portal/search?q=${encodeURIComponent(q || '')}`,
        ip: req.ip || '127.0.0.1',
        metadata: { searchQuery: q || '' }
      });

      const outcome = await rulesEngine.processEvent(rawEvent);

      const files = await File.find({
        name: new RegExp(q, 'i')
      }).select('-content');

      res.json({
        files: files.map(f => ({
          _id: f._id,
          name: f.name,
          path: f.path,
          department: f.department,
          sizeBytes: f.sizeBytes,
          sensitivity: f.sensitivity
        })),
        alertTriggered: outcome.firedRules.length > 0
      });
    } catch (err) {
      res.status(500).json({ error: 'Search failed' });
    }
  }

  // Catches access attempts to hidden trap web addresses and triggers Rule R1
  static async decoyTrapHandler(req, res, rulesEngine, trapName) {
    try {
      const user = req.user || { username: 'anonymous_intruder', role: 'guest', userId: null };
      const rawEvent = await Event.create({
        userId: user.userId,
        username: user.username,
        role: user.role,
        action: 'DECOY_ENDPOINT_HIT',
        target: req.originalUrl,
        ip: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'Automated Prober',
        metadata: { isDecoy: true, trapName }
      });

      await rulesEngine.processEvent(rawEvent);

      return res.status(403).json({
        error: 'Security Audit: Access to unauthorized trap address recorded.'
      });
    } catch (err) {
      res.status(500).json({ error: 'Trap failed' });
    }
  }
}

module.exports = PortalController;
