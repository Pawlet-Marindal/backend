const router = require('express').Router();
const { changePassword } = require('../controllers/settingsController');
const { verifyToken } = require('../middleware/auth');

// Alias untuk frontend: userService.changePassword() memanggil /users/me/password.
router.use(verifyToken);
router.put('/me/password', changePassword);

module.exports = router;
