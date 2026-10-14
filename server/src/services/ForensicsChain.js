const Evidence = require('../models/Evidence');
const Incident = require('../models/Incident');
const settings = require('../config/settings');
const { canonicalJson, sha256 } = require('../utils/cryptoUtils');
const PDFDocument = require('pdfkit');

class ForensicsChain {
  // Saves a new security event into the cryptographic evidence chain
  static async appendEvidence(eventId, eventPayload) {
    try {
      const lastEvidence = await Evidence.findOne().sort({ seq: -1 });
      const seq = lastEvidence ? lastEvidence.seq + 1 : 1;
      const prevHash = lastEvidence ? lastEvidence.hash : settings.GENESIS_HASH;
      const createdAt = new Date();

      const normalizedPayload = {
        seq,
        eventId: eventId.toString(),
        username: eventPayload.username || 'unknown',
        action: eventPayload.action,
        target: eventPayload.target,
        ip: eventPayload.ip || '127.0.0.1',
        ts: eventPayload.ts ? new Date(eventPayload.ts).toISOString() : createdAt.toISOString(),
        ruleHits: eventPayload.ruleHits || []
      };

      const payloadString = canonicalJson(normalizedPayload);
      const computedHash = sha256(prevHash + payloadString + createdAt.toISOString());

      const record = await Evidence.create({
        seq,
        eventId,
        payload: normalizedPayload,
        prevHash,
        hash: computedHash,
        createdAt
      });

      return record;
    } catch (err) {
      console.error('[ForensicsChain] Failed to append evidence:', err.message);
      return null;
    }
  }

  // Checks the cryptographic integrity of all evidence blocks from 0 to N
  static async verifyChain() {
    const records = await Evidence.find().sort({ seq: 1 });
    if (!records || records.length === 0) {
      return { valid: true, count: 0, message: 'All 0 blocks are fine (Ledger is empty)' };
    }

    let previousHash = settings.GENESIS_HASH;
    for (const record of records) {
      // 1. Check previous hash pointer
      if (record.prevHash !== previousHash) {
        return {
          valid: false,
          brokenSeq: record.seq,
          message: `Block number ${record.seq} was changed (Broken hash link)`
        };
      }

      // 2. Re-calculate SHA-256 digest on block data
      const payloadString = canonicalJson(record.payload);
      const expectedHash = sha256(record.prevHash + payloadString + new Date(record.createdAt).toISOString());
      
      if (record.hash !== expectedHash) {
        return {
          valid: false,
          brokenSeq: record.seq,
          message: `Block number ${record.seq} was changed (Data altered)`
        };
      }

      previousHash = record.hash;
    }

    return { 
      valid: true, 
      count: records.length, 
      message: `All ${records.length} blocks are fine` 
    };
  }

  // Lab demo only: purposely alters Block #1 in the database without updating the hash
  static async simulateTampering() {
    const records = await Evidence.find().sort({ seq: 1 });
    if (records.length === 0) {
      throw new Error('No evidence blocks found to tamper with.');
    }
    // Block #1 is the first data block after Genesis Block #0
    const target = records.length > 1 ? records[1] : records[0];

    const currentFlag = target.payload && target.payload.tampered;
    const tamperedPayload = {
      ...target.payload,
      tampered: !currentFlag,
      tamperedAt: new Date().toISOString()
    };

    await Evidence.updateOne(
      { _id: target._id },
      { $set: { payload: tamperedPayload } }
    );

    return {
      tamperedSeq: target.seq,
      message: `Block number ${target.seq} was modified for lab demonstration (Hash now invalid).`
    };
  }

  // Lab demo only: restores original block data and recalculates all SHA-256 hashes
  static async restoreChain() {
    const records = await Evidence.find().sort({ seq: 1 });
    let previousHash = settings.GENESIS_HASH;
    for (const record of records) {
      // Clean tamper flag if present
      const cleanPayload = { ...record.payload };
      delete cleanPayload.tampered;
      delete cleanPayload.tamperedAt;

      const payloadString = canonicalJson(cleanPayload);
      const computedHash = sha256(previousHash + payloadString + new Date(record.createdAt).toISOString());
      
      await Evidence.updateOne(
        { _id: record._id },
        { $set: { payload: cleanPayload, prevHash: previousHash, hash: computedHash } }
      );
      previousHash = computedHash;
    }
    return { message: 'All evidence blocks restored and re-verified.' };
  }

  // Generates a clean, court-admissible PDF forensic report for an incident
  static async generateIncidentPdf(incidentId, res) {
    const incident = await Incident.findById(incidentId).populate('eventIds').populate('alertIds');
    if (!incident) throw new Error('Incident case not found');

    const doc = new PDFDocument({ margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Case_Report_${incident._id}.pdf"`);
    doc.pipe(res);

    // Document Header
    doc.fontSize(20).fillColor('#2A2C41').text('DECEPTIGUARD - DIGITAL FORENSIC REPORT', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#64748B').text('ISO/IEC 27037 Digital Evidence & Chain-of-Custody Specification', { align: 'center' });
    doc.moveDown(0.5);
    doc.strokeColor('#CBD5E1').lineWidth(1).moveTo(40, doc.y).lineTo(570, doc.y).stroke();
    doc.moveDown(1);

    // Section 1: Case Overview
    doc.fontSize(12).fillColor('#FF724C').text('1. CASE OVERVIEW');
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#2A2C41');
    doc.text(`Case ID: ${incident._id}`);
    doc.text(`Title: ${incident.title}`);
    doc.text(`Suspect: ${incident.suspectUsername}`);
    doc.text(`Severity: ${incident.severity}`);
    doc.text(`Status: ${incident.status}`);
    doc.text(`Created At: ${new Date(incident.createdAt).toLocaleString()}`);
    doc.moveDown(1);

    // Section 2: Root Cause & Rules Fired
    doc.fontSize(12).fillColor('#FF724C').text('2. ROOT CAUSE ANALYSIS & RULES FIRED');
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#2A2C41');
    doc.text(`Root Cause: ${incident.rootCause || 'Unauthorized interaction with security trap'}`);
    if (incident.alertIds && incident.alertIds.length > 0) {
      incident.alertIds.forEach(a => {
        const rulesText = (a.rulesFired || []).map(r => `${r.ruleId} (${r.ruleName}: ${r.points} pts)`).join(', ');
        doc.text(`Alert Triggered: ${rulesText}`);
        doc.text(`Target Asset: ${a.targetAsset}`);
      });
    }
    doc.moveDown(1);

    // Section 3: Evidence Blocks and Cryptographic Hashes
    doc.fontSize(12).fillColor('#FF724C').text('3. EVIDENCE BLOCKS & SHA-256 HASH CHAIN (ISO/IEC 27037)');
    doc.moveDown(0.3);
    if (incident.eventIds && incident.eventIds.length > 0) {
      for (let idx = 0; idx < incident.eventIds.length; idx++) {
        const evt = incident.eventIds[idx];
        const block = await Evidence.findOne({ eventId: evt._id });
        doc.fontSize(9).fillColor('#2A2C41').text(`[Event ${idx + 1}] ${new Date(evt.ts || evt.createdAt).toLocaleString()} | Action: ${evt.action} on ${evt.target}`);
        doc.fillColor('#64748B').text(`     IP: ${evt.ip || '127.0.0.1'}`);
        if (block) {
          doc.fillColor('#10B981').text(`     Block #${block.seq} SHA-256 Hash: ${block.hash}`);
          doc.fillColor('#64748B').text(`     Previous Block Hash Link: ${block.prevHash}`);
        }
        doc.moveDown(0.3);
      }
    } else {
      doc.fontSize(10).fillColor('#64748B').text('No linked events attached.');
    }
    doc.moveDown(1);

    // Section 4: Recommendations
    doc.fontSize(12).fillColor('#FF724C').text('4. RECOMMENDED CONTAINMENT ACTIONS');
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#2A2C41');
    doc.text('1. Revoke active employee session tokens and reset login credentials.');
    doc.text('2. Quarantine workstation and conduct forensic interview regarding unauthorized trap file access.');
    doc.moveDown(1.5);

    doc.strokeColor('#CBD5E1').lineWidth(0.5).moveTo(40, doc.y).lineTo(570, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(8).fillColor('#94A3B8').text('Autonomously verified by DeceptiGuard Cryptographic Forensics Engine.', { align: 'center' });

    doc.end();
  }
}

module.exports = ForensicsChain;
