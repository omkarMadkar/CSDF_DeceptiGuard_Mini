const mongoose = require('mongoose');

const evidenceSchema = new mongoose.Schema({
  seq: { type: Number, required: true, unique: true, index: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  prevHash: { type: String, required: true },
  hash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
}, { 
  timestamps: false,
  versionKey: false
});

module.exports = mongoose.model('Evidence', evidenceSchema);
