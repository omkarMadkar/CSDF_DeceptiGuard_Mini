const crypto = require('crypto');

/**
 * Produces a stable, deterministic canonical JSON string
 * by sorting object keys alphabetically recursively.
 */
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

/**
 * Computes standard SHA-256 hex string
 */
function sha256(data) {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

module.exports = {
  canonicalJson,
  sha256
};
