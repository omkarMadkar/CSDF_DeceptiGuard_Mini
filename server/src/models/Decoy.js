const mongoose = require('mongoose');

const decoySchema = new mongoose.Schema({
  type: { 
    type: String, 
    required: true, 
    enum: ['HONEYFILE', 'HONEYTOKEN', 'DECOY_ACCOUNT', 'DECOY_ENDPOINT', 'DECOY_DB_RECORD'] 
  },
  name: { type: String, required: true },
  location: { type: String, required: true },
  description: { type: String, default: '' },
  tokenValue: { type: String, default: null, index: true },
  severity: { type: String, default: 'CRITICAL', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
  enabled: { type: Boolean, default: true },
  triggerCount: { type: Number, default: 0 },
  lastTriggeredAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Decoy', decoySchema);
