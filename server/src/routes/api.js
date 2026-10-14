// API router defining endpoints for auth, files, traps, dashboard, forensics, and test attacks
const express = require('express');
const router = express.Router();

const AuthController = require('../controllers/authController');
const PortalController = require('../controllers/portalController');
const SocController = require('../controllers/socController');
const ForensicsController = require('../controllers/forensicsController');
const SimController = require('../controllers/simController');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');

module.exports = (rulesEngine) => {
  // Authentication endpoints
  router.post('/auth/login', (req, res) => AuthController.login(req, res, rulesEngine));
  router.post('/auth/logout', authMiddleware, (req, res) => AuthController.logout(req, res, rulesEngine));
  router.get('/auth/me', authMiddleware, AuthController.getMe);

  // Company file portal endpoints
  router.get('/files', authMiddleware, (req, res) => PortalController.getFiles(req, res, rulesEngine));
  router.get('/files/:id', authMiddleware, (req, res) => PortalController.viewFile(req, res, rulesEngine));
  router.get('/files/:id/download', authMiddleware, (req, res) => PortalController.downloadFile(req, res, rulesEngine));
  router.get('/search', authMiddleware, (req, res) => PortalController.searchFiles(req, res, rulesEngine));

  // Trap web address endpoint
  router.all('/v1/admin/export-all', (req, res) => PortalController.decoyTrapHandler(req, res, rulesEngine, 'ADMIN_EXPORT_TRAP'));

  // Dashboard metrics and trap statistics
  router.get('/soc/stats', SocController.getStats);
  router.get('/soc/alerts', SocController.getAlerts);
  router.get('/soc/leaderboard', SocController.getLeaderboard);
  router.get('/soc/decoys', SocController.getDecoys);

  // Evidence verification and cases management
  router.get('/forensics/verify', ForensicsController.verify);
  router.post('/forensics/tamper-demo', authMiddleware, roleMiddleware(['admin']), ForensicsController.tamperDemo);
  router.post('/forensics/restore-chain', authMiddleware, roleMiddleware(['admin']), ForensicsController.restoreChain);
  router.get('/forensics/incidents', ForensicsController.getIncidents);
  router.get('/forensics/incidents/:id', ForensicsController.getIncidentById);
  router.patch('/forensics/incidents/:id/status', authMiddleware, ForensicsController.updateIncidentStatus);
  router.get('/forensics/incidents/:id/export', ForensicsController.exportReport);

  // Test attacks simulator (Admin only)
  router.post('/sim/run/:scenarioId', authMiddleware, roleMiddleware(['admin']), (req, res) => SimController.runScenario(req, res, rulesEngine));

  return router;
};
