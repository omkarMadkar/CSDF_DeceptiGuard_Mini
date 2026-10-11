const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  username: { type: String, required: true },
  role: { type: String, default: 'unknown' },
  severity: { type: String, required: true, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
  score: { type: Number, required: true },
  rulesFired: [{
    ruleId: String,
    ruleName: String,
    points: Number,
    mitreTechnique: String
  }],
  description: { type: String, required: true },
  targetAsset: { type: String, required: true },
  status: { type: String, default: 'NEW', enum: ['NEW', 'ACKNOWLEDGED', 'RESOLVED', 'FALSE_POSITIVE'] },
  createdAt: { type: Date, default: Date.now, index: true }
}, { timestamps: true });

module.exports = mongoose.model('Alert', alertSchema);
