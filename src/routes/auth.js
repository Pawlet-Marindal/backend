const router = require('express').Router();
const { login, me, logout } = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

router.post('/login', login); // { "email": "....", "password": "...." }
router.get('/me', verifyToken, me);
router.post('/logout', verifyToken, logout);

module.exports = router;
