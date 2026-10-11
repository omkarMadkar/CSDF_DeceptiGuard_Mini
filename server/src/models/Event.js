const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  username: { type: String, required: true },
  role: { type: String, default: 'anonymous' },
  action: { 
    type: String, 
    required: true, 
    enum: [
      'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 
      'FILE_VIEW', 'FILE_DOWNLOAD', 'SEARCH', 
      'DIRECTORY_BROWSE', 'DECOY_ENDPOINT_HIT', 
      'HONEYTOKEN_SUBMIT', 'ROLE_VIOLATION'
    ] 
  },
  target: { type: String, required: true },
  ip: { type: String, default: '127.0.0.1' },
  userAgent: { type: String, default: 'Mozilla/5.0' },
  ts: { type: Date, default: Date.now, index: true },
  sessionId: { type: String, default: 'sess_default' },
  ruleHits: [{ type: String }],
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

module.exports = mongoose.model('Event', eventSchema);
