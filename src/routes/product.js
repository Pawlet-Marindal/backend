const router = require('express').Router();
const { list, summary, categories, create, update, remove, bulkRemove, } = require('../controllers/productController');
const { verifyToken } = require('../middleware/auth');
const { requirePemilik } = require('../middleware/rbac');

router.use(verifyToken);

// Rute spesifik harus sebelum rute dengan :id
router.get('/summary', summary);
router.get('/categories', categories);

router.get('/', list);
router.post('/bulk-delete', requirePemilik, bulkRemove);
router.post('/', requirePemilik, create);
router.put('/:id', requirePemilik, update);
router.delete('/:id', requirePemilik, remove);

module.exports = router;
