const router = require('express').Router();
const { create, list, getById, remove, returnItem } = require('../controllers/transactionController');
const { verifyToken } = require('../middleware/auth');
const { requirePemilik } = require('../middleware/rbac');

router.use(verifyToken);

router.get('/', list);
router.get('/:id', getById);
router.post('/', create);
router.delete('/:id/items/:itemId', requirePemilik, returnItem);
router.delete('/:id', requirePemilik, remove);

module.exports = router;
