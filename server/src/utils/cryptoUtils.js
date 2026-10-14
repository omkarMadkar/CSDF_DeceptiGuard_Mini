// Cryptographic utilities providing deterministic JSON serialization and SHA-256 hashing
const crypto = require('crypto');

// Produces a deterministic canonical JSON string by recursively sorting object keys
function canonicalJson(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJson).join(',') + ']';
  }
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map(k => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`);
  return '{' + pairs.join(',') + '}';
}

// Computes the SHA-256 cryptographic hash digest of input string data
function sha256(data) {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

module.exports = {
  canonicalJson,
  sha256
};
