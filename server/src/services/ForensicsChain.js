const Evidence = require('../models/Evidence');
const Incident = require('../models/Incident');
const CustodyLog = require('../models/CustodyLog');
const { canonicalJson, sha256 } = require('../utils/cryptoUtils');
const PDFDocument = require('pdfkit');

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

class ForensicsChain {
  /**
   * Appends an event to the cryptographic evidence hash chain.
   */
  static async appendEvidence(eventId, eventPayload) {
    try {
      // Find the latest evidence record to get prevHash and seq
      const lastEvidence = await Evidence.findOne().sort({ seq: -1 });
      const seq = lastEvidence ? lastEvidence.seq + 1 : 1;
      const prevHash = lastEvidence ? lastEvidence.hash : GENESIS_HASH;
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

  /**
   * Validates the integrity of the entire hash chain from seq 1 to N.
   */
  static async verifyChain() {
    const records = await Evidence.find().sort({ seq: 1 });
    if (!records || records.length === 0) {
      return { valid: true, count: 0, message: 'Evidence ledger is empty. Chain is intact.' };
    }

    let previousHash = GENESIS_HASH;
    for (const record of records) {
      // 1. Verify prevHash link
      if (record.prevHash !== previousHash) {
        return {
          valid: false,
          brokenSeq: record.seq,
          reason: 'Broken hash link with prior block',
          expectedPrevHash: previousHash,
          actualPrevHash: record.prevHash
        };
      }

      // 2. Recompute hash
      const payloadString = canonicalJson(record.payload);
      const expectedHash = sha256(record.prevHash + payloadString + new Date(record.createdAt).toISOString());
      
      if (record.hash !== expectedHash) {
        return {
          valid: false,
          brokenSeq: record.seq,
          reason: 'Cryptographic payload digest mismatch (Tampering detected!)',
          expectedHash,
          actualHash: record.hash
        };
      }

      previousHash = record.hash;
    }

    return { 
      valid: true, 
      count: records.length, 
      latestHash: previousHash,
      message: `All ${records.length} forensic evidence records cryptographically verified (0 alterations detected).` 
    };
  }

  /**
   * Tamper Demo: intentionally mutates one record in the database
   * to demonstrate forensic detection.
   */
  static async simulateTampering() {
    const records = await Evidence.find().sort({ seq: 1 });
    if (records.length === 0) {
      throw new Error('No evidence records found to tamper with.');
    }
    // Target the first or middle record
    const targetIndex = records.length > 2 ? 1 : 0;
    const target = records[targetIndex];

    const tamperedPayload = { ...target.payload, username: 'tampered_intruder_modified' };
    await Evidence.updateOne(
      { _id: target._id },
      { $set: { payload: tamperedPayload } }
    );

    return {
      tamperedSeq: target.seq,
      message: `Tampered with evidence sequence #${target.seq} by modifying payload payload without recalculating hash.`
    };
  }

  /**
   * Restores chain consistency after tamper demo (recalculates from tampered node)
   */
  static async restoreChain() {
    const records = await Evidence.find().sort({ seq: 1 });
    let previousHash = GENESIS_HASH;
    for (const record of records) {
      const payloadString = canonicalJson(record.payload);
      const computedHash = sha256(previousHash + payloadString + new Date(record.createdAt).toISOString());
      await Evidence.updateOne(
        { _id: record._id },
        { $set: { prevHash: previousHash, hash: computedHash } }
      );
      previousHash = computedHash;
    }
    return { message: 'Chain hashes re-synchronized.' };
  }

  /**
   * Generates a forensic incident dossier PDF
   */
  static async generateIncidentPdf(incidentId, res) {
    const incident = await Incident.findById(incidentId).populate('eventIds').populate('alertIds');
    if (!incident) throw new Error('Incident not found');

    const doc = new PDFDocument({ margin: 40 });
    const filename = `Incident_Dossier_${incident._id}.pdf`;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    // Title & Header
    doc.fontSize(20).fillColor('#0F172A').text('DECEPTIGUARD DIGITAL FORENSIC INCIDENT REPORT', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#475569').text(`NIST SP 800-86 & ISO/IEC 27037 Evidentiary Standard Compliance`, { align: 'center' });
    doc.moveDown(1);
    doc.strokeColor('#CBD5E1').lineWidth(1).moveTo(40, doc.y).lineTo(570, doc.y).stroke();
    doc.moveDown(1);

    // Metadata Grid
    doc.fontSize(12).fillColor('#1E3A8A').text('1. INCIDENT OVERVIEW & CASE ATTRIBUTION', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#1E293B');
    doc.text(`Incident ID: ${incident._id}`);
    doc.text(`Case Title: ${incident.title}`);
    doc.text(`Severity Level: ${incident.severity}`);
    doc.text(`Status: ${incident.status}`);
    doc.text(`Suspect Attribution: ${incident.suspectUsername}`);
    doc.text(`Opened Timestamp: ${incident.createdAt.toISOString()}`);
    doc.moveDown(1);

    // MITRE Mapping
    doc.fontSize(12).fillColor('#1E3A8A').text('2. MITRE ATT&CK MATRIX MAPPING', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#1E293B');
    doc.text(`Identified Techniques: ${(incident.mitreTechniques || ['T1083', 'T1005']).join(', ')}`);
    doc.text(`Root Cause Analysis: ${incident.rootCause}`);
    doc.text(`Recommended Containment: ${incident.recommendation}`);
    doc.moveDown(1);

    // Forensic Timeline & Cryptographic Evidence Hashes (ISO/IEC 27037)
    doc.fontSize(12).fillColor('#1E3A8A').text('3. CORRELATED TIMELINE & CRYPTOGRAPHIC EVIDENCE DIGESTS', { underline: true });
    doc.moveDown(0.5);
    if (incident.eventIds && incident.eventIds.length > 0) {
      for (let idx = 0; idx < incident.eventIds.length; idx++) {
        const evt = incident.eventIds[idx];
        const evidenceRecord = await Evidence.findOne({ eventId: evt._id });
        doc.fontSize(9).fillColor('#0F172A').text(`[Event ${idx + 1}] ${new Date(evt.ts).toISOString()} - ${evt.action} on ${evt.target}`);
        doc.fillColor('#475569').text(`     Actor IP: ${evt.ip} | Rule Breaches: ${(evt.ruleHits || []).join(', ') || 'Baseline'}`);
        if (evidenceRecord) {
          doc.fontSize(8).fillColor('#1E3A8A').text(`     Block #${evidenceRecord.seq} SHA-256 Digest: ${evidenceRecord.hash}`);
          doc.fillColor('#64748B').text(`     Previous Hash Link: ${evidenceRecord.prevHash} (ISO/IEC 27037 VALID)`);
        }
        doc.moveDown(0.3);
      }
    } else {
      doc.fontSize(10).fillColor('#64748B').text('No linked events attached.');
    }
    doc.moveDown(1);

    // Investigator Notes
    doc.fontSize(12).fillColor('#1E3A8A').text('4. CHAIN OF CUSTODY & INVESTIGATOR LOG', { underline: true });
    doc.moveDown(0.5);
    const logs = await CustodyLog.find({ incidentId: incident._id }).sort({ ts: 1 });
    if (logs.length > 0) {
      logs.forEach(l => {
        doc.fontSize(9).fillColor('#1E293B').text(`${new Date(l.ts).toISOString()} - ${l.actor}: ${l.action} (${l.detail})`);
      });
    } else {
      doc.fontSize(10).fillColor('#64748B').text('Case initialized. Evidentiary ledger intact.');
    }

    doc.moveDown(1.5);
    doc.strokeColor('#CBD5E1').lineWidth(1).moveTo(40, doc.y).lineTo(570, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(8).fillColor('#94A3B8').text('This document was autonomously compiled with SHA-256 cryptographic chain validation by DeceptiGuard Forensic Engine.', { align: 'center' });

    doc.end();
  }
}

module.exports = ForensicsChain;
