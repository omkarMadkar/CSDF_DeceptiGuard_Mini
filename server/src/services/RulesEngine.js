// Evaluates security rules on user actions and updates risk scores
const settings = require('../config/settings');
const Alert = require('../models/Alert');
const User = require('../models/User');
const Event = require('../models/Event');
const Incident = require('../models/Incident');
const DeceptionManager = require('./DeceptionManager');
const ForensicsChain = require('./ForensicsChain');

class RulesEngine {
  // Sets up the real-time WebSocket connection
  constructor(io = null) {
    this.io = io;
  }

  // Connects WebSocket server to the rules engine
  setIo(io) {
    this.io = io;
  }

  // Drops a user's risk score by 10% for every hour of good behavior
  static computeDecayedScore(currentScore, lastUpdate) {
    const hoursPassed = (new Date() - new Date(lastUpdate)) / (1000 * 60 * 60);
    return Math.max(0, Math.round(currentScore * Math.pow(0.90, hoursPassed)));
  }

  // Checks user actions against our 5 rules and creates alerts when traps are hit
  async processEvent(event) {
    const firedRules = [];
    let addedScore = 0;

    // Rule R1: Trap file opened or trap address hit
    const decoyCheck = await DeceptionManager.checkDecoyHit(event.target);
    const isTrapFile = decoyCheck.isDecoy || 
      settings.TRAPS.files.some(f => event.target && event.target.includes(f.name)) ||
      (settings.TRAPS.endpoint && event.target && event.target.includes(settings.TRAPS.endpoint));
    if (isTrapFile || event.metadata?.isDecoy) {
      const r1 = settings.RULES.find(r => r.id === 'R1');
      firedRules.push(r1);
      addedScore += r1.points;
      if (decoyCheck.decoy?._id) {
        await DeceptionManager.recordTrigger(decoyCheck.decoy._id);
      }
    }

    // Rule R2: Fake admin login attempt
    if (event.action === 'LOGIN_SUCCESS' || event.action === 'LOGIN_FAILED') {
      const isFakeAccount = event.username === settings.TRAPS.account;
      const targetUser = await User.findOne({ username: event.username });
      if (isFakeAccount || (targetUser && targetUser.isDecoy)) {
        const r2 = settings.RULES.find(r => r.id === 'R2');
        firedRules.push(r2);
        addedScore += r2.points;
      }
    }

    // Rule R3: Fake canary key used
    const hasCanaryKey = event.action === 'HONEYTOKEN_SUBMIT' || 
      (event.metadata?.searchQuery && event.metadata.searchQuery.includes(settings.TRAPS.key)) ||
      (event.target && event.target.includes(settings.TRAPS.key));
    if (hasCanaryKey || event.metadata?.honeytokenHit) {
      const r3 = settings.RULES.find(r => r.id === 'R3');
      firedRules.push(r3);
      addedScore += r3.points;
    }

    // Rule R4: Night-time access (outside 9 AM to 7 PM)
    const eventTime = new Date(event.ts || event.createdAt || Date.now());
    const eventHour = eventTime.getHours();
    if (eventHour < settings.BUSINESS_HOURS.start || eventHour >= settings.BUSINESS_HOURS.end) {
      const r4 = settings.RULES.find(r => r.id === 'R4');
      firedRules.push(r4);
      addedScore += r4.points;
    }

    // Rule R5: Too many downloads (more than 10 downloads within 5 minutes)
    if (event.action === 'FILE_DOWNLOAD' && event.userId) {
      const fiveMinAgo = new Date(eventTime.getTime() - settings.DOWNLOAD_LIMITS.windowMinutes * 60 * 1000);
      const downloadCount = await Event.countDocuments({
        userId: event.userId,
        action: 'FILE_DOWNLOAD',
        ts: { $gte: fiveMinAgo }
      });
      if (downloadCount > settings.DOWNLOAD_LIMITS.maxFiles) {
        const r5 = settings.RULES.find(r => r.id === 'R5');
        firedRules.push(r5);
        addedScore += r5.points;
      }
    }

    // Update user's risk score and create alerts if any rules fired
    if (firedRules.length > 0) {
      const user = event.userId ? await User.findById(event.userId) : await User.findOne({ username: event.username });
      let newScore = addedScore;

      if (user) {
        const decayed = RulesEngine.computeDecayedScore(user.riskScore, user.lastScoreUpdate || user.updatedAt);
        newScore = decayed + addedScore;
        const newStatus = newScore >= settings.RISK_BANDS.CRITICAL ? 'flagged' : (user.status || 'active');
        await User.findByIdAndUpdate(user._id, {
          riskScore: newScore,
          lastScoreUpdate: new Date(),
          status: newStatus
        });
      }

      // Determine highest severity
      const maxSeverity = firedRules.some(r => r.severity === 'CRITICAL')
        ? 'CRITICAL'
        : (firedRules.some(r => r.severity === 'HIGH') ? 'HIGH' : 'MEDIUM');

      // Create alert document
      const createdAlert = await Alert.create({
        eventId: event._id,
        userId: user?._id || null,
        username: event.username,
        role: event.role || user?.role || 'unknown',
        severity: maxSeverity,
        score: newScore,
        rulesFired: firedRules.map(r => ({
          ruleId: r.id,
          ruleName: r.name,
          points: r.points,
          mitreTechnique: r.mitre
        })),
        description: `Triggered rules: ${firedRules.map(r => r.name).join(', ')}`,
        targetAsset: event.target
      });

      // Append evidence block to cryptographic hash chain
      const evidenceBlock = await ForensicsChain.appendEvidence(event._id, event);

      // Create or update case
      const dynamicRootCause = firedRules.some(r => r.id === 'R4' || r.id === 'R5')
        ? `Off-hours mass download on ${event.target} (${firedRules.map(r => r.name).join(', ')})`
        : `Accessed fake security trap: ${event.target} (${firedRules.map(r => r.name).join(', ')})`;

      let incident = await Incident.findOne({
        suspectUsername: event.username,
        status: { $in: ['Open', 'Checking'] }
      });

      if (!incident) {
        await Incident.create({
          title: `Threat Case: ${event.username} triggered ${firedRules.map(r => r.id).join(', ')}`,
          severity: maxSeverity,
          status: 'Open',
          suspectUserId: user?._id || null,
          suspectUsername: event.username,
          eventIds: [event._id],
          alertIds: [createdAlert._id],
          mitreTechniques: firedRules.map(r => r.mitre),
          rootCause: dynamicRootCause,
          recommendation: '1. Revoke user session and reset password. 2. Interview employee regarding unauthorized file access.'
        });
      } else {
        incident.eventIds.push(event._id);
        incident.alertIds.push(createdAlert._id);
        incident.severity = maxSeverity;
        incident.mitreTechniques = Array.from(new Set([...incident.mitreTechniques, ...firedRules.map(r => r.mitre)]));
        await incident.save();
      }

      // Broadcast live alert to connected dashboard clients
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
      addedScore
    };
  }
}

module.exports = RulesEngine;
