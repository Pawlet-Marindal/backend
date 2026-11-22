const router = require('express').Router();
const { list, markAllRead, markRead } = require('../controllers/notificationController');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

router.get('/', list);
router.post('/read-all', markAllRead);
router.post('/:id/read', markRead);

module.exports = router;
