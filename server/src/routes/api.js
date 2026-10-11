const express = require('express');
const router = express.Router();

const AuthController = require('../controllers/authController');
const PortalController = require('../controllers/portalController');
const SocController = require('../controllers/socController');
const ForensicsController = require('../controllers/forensicsController');
const SimController = require('../controllers/simController');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');

module.exports = (rulesEngine) => {
  // Auth Routes
  router.post('/auth/login', (req, res) => AuthController.login(req, res, rulesEngine));
  router.post('/auth/logout', authMiddleware, (req, res) => AuthController.logout(req, res, rulesEngine));
  router.get('/auth/me', authMiddleware, AuthController.getMe);

  // Portal & Virtual File Routes
  router.get('/files', authMiddleware, (req, res) => PortalController.getFiles(req, res, rulesEngine));
  router.get('/files/:id', authMiddleware, (req, res) => PortalController.viewFile(req, res, rulesEngine));
  router.get('/files/:id/download', authMiddleware, (req, res) => PortalController.downloadFile(req, res, rulesEngine));
  router.get('/search', authMiddleware, (req, res) => PortalController.searchFiles(req, res, rulesEngine));

  // Decoy Shadow Trap Endpoints
  router.all('/v1/admin/export-all', (req, res) => PortalController.decoyTrapHandler(req, res, rulesEngine, 'ADMIN_EXPORT_TRAP'));
  router.all('/internal/db-dump', (req, res) => PortalController.decoyTrapHandler(req, res, rulesEngine, 'INTERNAL_DB_DUMP_TRAP'));
  router.all('/backup/old', (req, res) => PortalController.decoyTrapHandler(req, res, rulesEngine, 'LEGACY_BACKUP_TRAP'));

  // SOC Telemetry & Detection Console
  router.get('/soc/stats', SocController.getStats);
  router.get('/soc/alerts', SocController.getAlerts);
  router.get('/soc/leaderboard', SocController.getLeaderboard);
  router.get('/soc/heatmap', SocController.getHeatmap);
  router.get('/soc/decoys', SocController.getDecoys);
  router.patch('/soc/decoys/:id/toggle', SocController.toggleDecoy);

  // Digital Forensics & Case Management
  router.get('/forensics/verify', ForensicsController.verify);
  router.post('/forensics/tamper-demo', ForensicsController.tamperDemo);
  router.post('/forensics/restore-chain', ForensicsController.restoreChain);
  router.get('/forensics/incidents', ForensicsController.getIncidents);
  router.get('/forensics/incidents/:id', ForensicsController.getIncidentById);
  router.patch('/forensics/incidents/:id/status', authMiddleware, ForensicsController.updateIncidentStatus);
  router.get('/forensics/incidents/:id/export', ForensicsController.exportReport);
  router.get('/forensics/custody', ForensicsController.getCustodyLogs);

  // Attack Simulator
  router.post('/sim/run/:scenarioId', (req, res) => SimController.runScenario(req, res, rulesEngine));

  return router;
};
