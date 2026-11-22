const router = require('express').Router();
const { getStore, updateStore, changePassword } = require('../controllers/settingsController');
const { verifyToken } = require('../middleware/auth');
const { requirePemilik } = require('../middleware/rbac');

router.use(verifyToken);

router.get('/store', getStore);
router.put('/store', requirePemilik, updateStore);
router.put('/password', changePassword);

module.exports = router;
