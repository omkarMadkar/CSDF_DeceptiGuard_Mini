const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'HIGH' },
  status: { 
    type: String, 
    enum: ['Open', 'Investigating', 'Contained', 'Closed'], 
    default: 'Open' 
  },
  suspectUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  suspectUsername: { type: String, required: true },
  eventIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Event' }],
  alertIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Alert' }],
  notes: [{
    author: String,
    content: String,
    createdAt: { type: Date, default: Date.now }
  }],
  mitreTechniques: [{ type: String }],
  rootCause: { type: String, default: 'Unauthorized access to deceptive canary artifacts.' },
  recommendation: { type: String, default: 'Revoke active sessions, rotate credentials, and initiate forensic interview.' },
  closedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Incident', incidentSchema);
