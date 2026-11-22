const router = require('express').Router();
const { history, send } = require('../controllers/aiController');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

router.get('/chat/history', history);
router.post('/chat', send);

module.exports = router;
