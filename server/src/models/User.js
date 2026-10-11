const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true },
  role: { 
    type: String, 
    required: true, 
    enum: ['admin', 'hr', 'finance', 'engineer', 'intern', 'auditor'] 
  },
  department: { type: String, required: true },
  isDecoy: { type: Boolean, default: false },
  status: { type: String, default: 'active', enum: ['active', 'flagged', 'suspended'] },
  riskScore: { type: Number, default: 0 },
  lastScoreUpdate: { type: Date, default: Date.now },
  flaggedReason: { type: String, default: null }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
