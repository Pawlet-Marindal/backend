const router = require('express').Router();
const { summary, trend, report } = require('../controllers/dashboardController');
const { verifyToken } = require('../middleware/auth');
const { requirePemilik } = require('../middleware/rbac');

router.use(verifyToken, requirePemilik);

router.get('/summary', summary);
router.get('/trend', trend);
router.get('/report', report);

module.exports = router;
