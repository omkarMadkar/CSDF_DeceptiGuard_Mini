const Decoy = require('../models/Decoy');
const File = require('../models/File');

class DeceptionManager {
  /**
   * Checks if a target path, filename or decoyId corresponds to a honeyfile/decoy.
   */
  static async checkDecoyHit(targetPath, fileId = null) {
    if (fileId) {
      const file = await File.findById(fileId);
      if (file && file.isDecoy) {
        return { isDecoy: true, decoy: await Decoy.findById(file.decoyId) || { name: file.name, type: 'HONEYFILE' } };
      }
    }
    
    if (targetPath) {
      const decoy = await Decoy.findOne({ 
        location: new RegExp(targetPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
        enabled: true 
      });
      if (decoy) {
        return { isDecoy: true, decoy };
      }
    }
    return { isDecoy: false, decoy: null };
  }

  /**
   * Scans a string (search query, input parameter, body) for any active canary honeytoken.
   */
  static async checkHoneytoken(inputValue) {
    if (!inputValue || typeof inputValue !== 'string') return null;
    
    const tokens = await Decoy.find({ type: 'HONEYTOKEN', enabled: true, tokenValue: { $ne: null } });
    for (const t of tokens) {
      if (inputValue.includes(t.tokenValue)) {
        return t;
      }
    }
    return null;
  }

  /**
   * Increments trigger statistics for a decoy
   */
  static async recordTrigger(decoyId) {
    if (!decoyId) return;
    try {
      await Decoy.findByIdAndUpdate(decoyId, {
        $inc: { triggerCount: 1 },
        $set: { lastTriggeredAt: new Date() }
      });
    } catch (err) {
      console.error('[DeceptionManager] Error recording trigger:', err.message);
    }
  }
}

module.exports = DeceptionManager;
