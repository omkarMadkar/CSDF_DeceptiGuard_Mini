const mongoose = require('mongoose');

const custodyLogSchema = new mongoose.Schema({
  incidentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Incident', required: true, index: true },
  actor: { type: String, required: true },
  action: { type: String, required: true },
  detail: { type: String, required: true },
  fileSha256: { type: String, default: null },
  ts: { type: Date, default: Date.now }
}, { timestamps: false, versionKey: false });

module.exports = mongoose.model('CustodyLog', custodyLogSchema);
