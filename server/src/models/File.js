const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  name: { type: String, required: true },
  path: { type: String, required: true, index: true },
  department: { type: String, required: true },
  content: { type: String, default: '' },
  sizeBytes: { type: Number, default: 1024 },
  mimeType: { type: String, default: 'text/plain' },
  sensitivity: { type: String, enum: ['Internal', 'Confidential', 'Restricted'], default: 'Internal' },
  isDecoy: { type: Boolean, default: false },
  decoyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Decoy', default: null }
}, { timestamps: true });

module.exports = mongoose.model('File', fileSchema);
