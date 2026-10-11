const File = require('../models/File');
const Event = require('../models/Event');
const DeceptionManager = require('../services/DeceptionManager');

class PortalController {
  static async getFiles(req, res, rulesEngine) {
    try {
      const user = req.user;
      const { path } = req.query;

      // Log Directory Browse
      if (path) {
        const rawEvent = await Event.create({
          userId: user.userId,
          username: user.username,
          role: user.role,
          action: 'DIRECTORY_BROWSE',
          target: path || '/',
          ip: req.ip || '127.0.0.1'
        });
        await rulesEngine.processEvent(rawEvent);
      }

      // Return files matching path or user's department + honeyfiles in realistic locations
      let query = {};
      if (path) {
        query.path = new RegExp(`^${path}`, 'i');
      } else if (user.role !== 'admin') {
        // Return own department files + realistic honeyfiles
        query = {
          $or: [
            { department: user.department },
            { isDecoy: true }
          ]
        };
      }

      const files = await File.find(query).select('-content');
      // Crucial requirement: No "decoy" badge visible to normal users
      const sanitized = files.map(f => ({
        id: f._id,
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

  static async viewFile(req, res, rulesEngine) {
    try {
      const { id } = req.params;
      const user = req.user;
      const file = await File.findById(id);

      if (!file) {
        return res.status(404).json({ error: 'Document not found' });
      }

      const isCrossDepartment = user.role !== 'admin' && file.department !== user.department && file.department !== 'Public';
      const rawEvent = await Event.create({
        userId: user.userId,
        username: user.username,
        role: user.role,
        action: 'FILE_VIEW',
        target: `${file.path}/${file.name}`,
        ip: req.ip || '127.0.0.1',
        metadata: {
          isDecoy: file.isDecoy,
          sensitivity: file.sensitivity,
          roleMismatch: isCrossDepartment
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
      res.send(file.content || 'Acme Corp Proprietary Artifact Content');
    } catch (err) {
      res.status(500).json({ error: 'Download failed' });
    }
  }

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
        results: files.map(f => ({
          id: f._id,
          name: f.name,
          path: f.path,
          department: f.department,
          sensitivity: f.sensitivity
        })),
        alertTriggered: outcome.firedRules.length > 0
      });
    } catch (err) {
      res.status(500).json({ error: 'Search failed' });
    }
  }

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
        error: 'Security Audit Violation: Unauthorized Shadow Endpoint Access Detected and Logged.'
      });
    } catch (err) {
      res.status(500).json({ error: 'Trap failed' });
    }
  }
}

module.exports = PortalController;
