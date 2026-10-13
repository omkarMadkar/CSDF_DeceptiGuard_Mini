const rules = require('../config/rules.json');
const Alert = require('../models/Alert');
const User = require('../models/User');
const Incident = require('../models/Incident');
const CustodyLog = require('../models/CustodyLog');
const DeceptionManager = require('./DeceptionManager');
const ForensicsChain = require('./ForensicsChain');

class RulesEngine {
  constructor(io = null) {
    this.io = io;
  }

  setIo(io) {
    this.io = io;
  }

  /**
   * Applies 10% per hour score decay to a user's risk score
   */
  static computeDecayedScore(currentScore, lastUpdate) {
    if (!currentScore || currentScore <= 0) return 0;
    const now = new Date();
    const hoursElapsed = (now - new Date(lastUpdate)) / (1000 * 60 * 60);
    if (hoursElapsed < 0.1) return currentScore;
    // 10% decay per hour: score * (0.90 ^ hoursElapsed)
    const decayed = currentScore * Math.pow(0.90, hoursElapsed);
    return Math.max(0, Math.round(decayed));
  }

  /**
   * Evaluates an ingested event against R1-R8 detection rules.
   */
  async processEvent(event) {
    const firedRules = [];
    let addedScore = 0;

    // 1. R1: Decoy Asset Interaction
    const decoyCheck = await DeceptionManager.checkDecoyHit(event.target);
    if (decoyCheck.isDecoy || event.metadata?.isDecoy) {
      const r1 = rules.find(r => r.id === 'R1');
      firedRules.push(r1);
      addedScore += r1.points;
      if (decoyCheck.decoy?._id) {
        await DeceptionManager.recordTrigger(decoyCheck.decoy._id);
      }
    }

    // 2. R2: Decoy Account Authentication
    if (event.action === 'LOGIN_SUCCESS' || event.action === 'LOGIN_FAILED') {
      const targetUser = await User.findOne({ username: event.username });
      if (targetUser && targetUser.isDecoy) {
        const r2 = rules.find(r => r.id === 'R2');
        firedRules.push(r2);
        addedScore += r2.points;
      }
    }

    // 3. R3: Honeytoken Canary Usage
    if (event.action === 'HONEYTOKEN_SUBMIT' || event.metadata?.honeytokenHit) {
      const r3 = rules.find(r => r.id === 'R3');
      firedRules.push(r3);
      addedScore += r3.points;
    } else if (event.metadata?.searchQuery) {
      const tokenHit = await DeceptionManager.checkHoneytoken(event.metadata.searchQuery);
      if (tokenHit) {
        const r3 = rules.find(r => r.id === 'R3');
        firedRules.push(r3);
        addedScore += r3.points;
        await DeceptionManager.recordTrigger(tokenHit._id);
      }
    }

    // 4. R4: After-Hours Privileged Access (Outside 09:00 - 19:00 IST / local time)
    const eventHour = new Date(event.ts).getHours();
    const isSensitive = event.target.includes('Confidential') || event.target.includes('Salary') || event.target.includes('Admin') || event.metadata?.sensitivity === 'Confidential';
    if ((eventHour < 9 || eventHour >= 19) && isSensitive) {
      const r4 = rules.find(r => r.id === 'R4');
      firedRules.push(r4);
      addedScore += r4.points;
    }

    // 5. R5: Bulk Download (>10 files)
    if (event.action === 'FILE_DOWNLOAD' && event.metadata?.bulkCount > 10) {
      const r5 = rules.find(r => r.id === 'R5');
      firedRules.push(r5);
      addedScore += r5.points;
    }

    // 6. R6: Cross-Department Role Violation
    if (event.action === 'ROLE_VIOLATION' || event.metadata?.roleMismatch) {
      const r6 = rules.find(r => r.id === 'R6');
      firedRules.push(r6);
      addedScore += r6.points;
    }

    // 7. R7: Failed Login Brute-force
    if (event.action === 'LOGIN_FAILED' && event.metadata?.failedCount >= 5) {
      const r7 = rules.find(r => r.id === 'R7');
      firedRules.push(r7);
      addedScore += r7.points;
    }

    // 8. R8: Directory Enumeration
    if (event.action === 'DIRECTORY_BROWSE' && event.metadata?.enumerationCount > 5) {
      const r8 = rules.find(r => r.id === 'R8');
      firedRules.push(r8);
      addedScore += r8.points;
    }

    // Update Event with fired rules
    event.ruleHits = firedRules.map(r => r.id);
    await event.save();

    // Append to Forensics Hash Chain
    const evidenceBlock = await ForensicsChain.appendEvidence(event._id, event);

    // Update User Risk Score with Decay
    let user = null;
    let newScore = addedScore;
    if (event.userId) {
      user = await User.findById(event.userId);
      if (user) {
        const baseScore = RulesEngine.computeDecayedScore(user.riskScore, user.lastScoreUpdate);
        newScore = baseScore + addedScore;
        user.riskScore = newScore;
        user.lastScoreUpdate = new Date();

        if (newScore >= 90) {
          user.status = 'flagged';
          user.flaggedReason = `Critical risk threshold breached (${newScore} pts). Rule hits: ${event.ruleHits.join(', ')}`;
        }
        await user.save();
      }
    }

    // If rules fired, dispatch Alert & create/link Incident
    let createdAlert = null;
    if (firedRules.length > 0) {
      const maxSeverity = firedRules.some(r => r.severity === 'CRITICAL') 
        ? 'CRITICAL' 
        : (firedRules.some(r => r.severity === 'HIGH') ? 'HIGH' : 'MEDIUM');

      createdAlert = await Alert.create({
        eventId: event._id,
        userId: event.userId,
        username: event.username,
        role: event.role,
        severity: maxSeverity,
        score: newScore,
        rulesFired: firedRules.map(r => ({
          ruleId: r.id,
          ruleName: r.name,
          points: r.points,
          mitreTechnique: r.mitreTechnique
        })),
        description: `Triggered ${firedRules.length} deception/behavior rule(s): ${firedRules.map(r => r.name).join('; ')}`,
        targetAsset: event.target
      });

      // Autonomous Incident Creation if CRITICAL or HIGH
      if (maxSeverity === 'CRITICAL' || maxSeverity === 'HIGH') {
        const mitreList = Array.from(new Set(firedRules.flatMap(r => r.mitreTechnique.split(' / '))));
        let incident = await Incident.findOne({ 
          suspectUsername: event.username, 
          status: { $in: ['Open', 'Investigating'] } 
        });

        if (!incident) {
          const dynamicRootCause = firedRules.some(r => r.id === 'R4' || r.id === 'R5')
            ? `Anomalous off-hours bulk data activity on ${event.target} (${firedRules.map(r=>r.name).join(', ')})`
            : `Deterministic trigger on synthetic deception asset: ${event.target} (${firedRules.map(r=>r.name).join(', ')})`;

          incident = await Incident.create({
            title: `Insider Deception Incident: ${event.username} accessed ${event.target}`,
            severity: maxSeverity,
            suspectUserId: event.userId,
            suspectUsername: event.username,
            eventIds: [event._id],
            alertIds: [createdAlert._id],
            mitreTechniques: mitreList,
            rootCause: dynamicRootCause,
            recommendation: maxSeverity === 'CRITICAL' ? 'Revoke active sessions, isolate host, and initiate forensic interview.' : 'Audit egress logs and monitor session.',
            notes: [{
              author: 'Autonomous SOC Engine',
              content: `Incident opened automatically following high-confidence trigger on ${event.target}.`
            }]
          });

          await CustodyLog.create({
            incidentId: incident._id,
            actor: 'System Autonomous Daemon',
            action: 'INCIDENT_INITIALIZED',
            detail: `Case instantiated from rule breach: ${event.ruleHits.join(', ')}`
          });
        } else {
          incident.eventIds.push(event._id);
          incident.alertIds.push(createdAlert._id);
          incident.mitreTechniques = Array.from(new Set([...incident.mitreTechniques, ...mitreList]));
          await incident.save();
        }
      }

      // Emit Live Alert via Socket.IO
      if (this.io) {
        this.io.emit('alert:new', {
          alert: createdAlert,
          event,
          evidenceBlockSeq: evidenceBlock ? evidenceBlock.seq : null
        });
      }
    }

    return {
      event,
      firedRules,
      addedScore,
      userRiskScore: newScore,
      alert: createdAlert,
      evidenceSeq: evidenceBlock ? evidenceBlock.seq : null
    };
  }
}

module.exports = RulesEngine;
