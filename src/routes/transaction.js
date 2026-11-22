const router = require('express').Router();
const { create, list, getById } = require('../controllers/transactionController');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

router.get('/', list);
router.get('/:id', getById);
router.post('/', create);

module.exports = router;
