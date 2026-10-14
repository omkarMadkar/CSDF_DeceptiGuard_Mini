// Database model for security threat cases and incident investigations
const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'HIGH' },
  status: { 
    type: String, 
    enum: ['Open', 'Checking', 'Closed', 'Investigating', 'Contained'], 
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
  rootCause: { type: String, default: 'Unauthorized access to security trap.' },
  recommendation: { type: String, default: '1. Revoke active user session. 2. Conduct forensic interview.' },
  closedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Incident', incidentSchema);
