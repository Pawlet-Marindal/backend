const router = require('express').Router();
const { insights } = require('../controllers/analyticsController');
const { verifyToken } = require('../middleware/auth');
const { requirePemilik } = require('../middleware/rbac');

router.use(verifyToken, requirePemilik);

router.get('/insights', insights);

module.exports = router;
