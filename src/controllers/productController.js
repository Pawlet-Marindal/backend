const db = require('../config/database');
const { success, fail } = require('../utils/response');
const { validateProduct } = require('../validators/productValidator');

const DEFAULT_CATEGORIES = [
  'Makanan Kucing',
  'Obat Kucing',
  'Aksesoris Kucing',
  'Perawatan Kucing',
  'Makanan Anjing',
];

// Gunakan snake_case agar sesuai dengan frontend:
const mapProduct = (row) => ({
  id: String(row.id),
  kode: row.sku,
  nama: row.name,
  kategori: row.category,
  hargaModal: Number(row.cost_price),
  hargaJual: Number(row.selling_price),
  stok: Number(row.stock),
  imageUrl: row.image_url || '',
  createdAt: new Date(row.created_at).toISOString(),
});

const percentChange = (current, previous) => {
  const c = Number(current) || 0;
  const p = Number(previous) || 0;
  if (p === 0) return c === 0 ? 0 : 100;
  return ((c - p) / Math.abs(p)) * 100;
};

// Daftar produk: search, filter kategori, pagination (limit bisa "all"). 
const list = async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const kategori = String(req.query.category || req.query.kategori || '').trim();
    const rawLimit = String(req.query.limit ?? '');
    const all = rawLimit.toLowerCase() === 'all';
    const requestedLimit = all ? 0 : Math.max(1, parseInt(rawLimit, 10) || 10);
    const requestedPage = Math.max(1, parseInt(req.query.page, 10) || 1);

    const where = ['is_active = 1'];
    const params = [];

    if (kategori) {
      where.push('category = ?');
      params.push(kategori);
    }
    if (search) {
      where.push('(name LIKE ? OR sku LIKE ? OR category LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    const whereSql = where.join(' AND ');
    const [[{ total }]] = await db.execute(
      `SELECT COUNT(*) AS total FROM products WHERE ${whereSql}`,
      params
    );

    const totalPages = Math.max(1, Math.ceil(total / (all ? Math.max(total, 1) : requestedLimit)));
    const page = all ? 1 : Math.min(requestedPage, totalPages);
    const limit = all ? Math.max(total, 1) : requestedLimit;
    const offset = (page - 1) * limit;

    const [rows] = await db.execute(
      `SELECT id, sku, name, category, cost_price, selling_price, stock, image_url, created_at
       FROM products
       WHERE ${whereSql}
       ORDER BY created_at DESC, id DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    return success(
      res,
      rows.map(mapProduct),
      200,
      { page, limit, total: Number(total), totalPages }
    );
  } catch (error) {
    console.error('[productController.list]', error);
    return fail(res, 500, 'Terjadi kesalahan pada server. Silakan coba lagi.');
  }
};

// Ringkasan produk untuk kartu KPI halaman Produk. 
const summary = async (req, res) => {
  try {
    const [productRows] = await db.execute(
      'SELECT COUNT(*) AS totalProduk, COALESCE(SUM(stock), 0) AS totalStok FROM products WHERE is_active = 1'
    );
    const productStat = productRows[0];

    const [newRows] = await db.execute(
      'SELECT COUNT(*) AS total FROM products WHERE is_active = 1 AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)'
    );
    const newProducts = Number(newRows[0].total);

    const [soldRows] = await db.execute(
      `SELECT COALESCE(SUM(ti.quantity), 0) AS sold, COUNT(DISTINCT t.id) AS buyers
       FROM transaction_items ti
       JOIN transactions t ON t.id = ti.transaction_id
       WHERE t.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND t.status = 'active'`
    );
    const soldCurrent = Number(soldRows[0].sold);
    const buyersCurrent = Number(soldRows[0].buyers);

    const [prevRows] = await db.execute(
      `SELECT COALESCE(SUM(ti.quantity), 0) AS sold, COUNT(DISTINCT t.id) AS buyers
       FROM transaction_items ti
       JOIN transactions t ON t.id = ti.transaction_id
       WHERE t.created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
         AND t.created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)
         AND t.status = 'active'`
    );
    const soldPrevious = Number(prevRows[0].sold);
    const buyersPrevious = Number(prevRows[0].buyers);

    const totalProduk = Number(productStat.totalProduk);
    const totalStok = Number(productStat.totalStok);

    return success(res, {
      totalProduk,
      totalProdukChange: percentChange(totalProduk, totalProduk - newProducts),
      totalStok,
      totalStokChange: percentChange(totalStok, totalStok + soldCurrent),
      stokTerjual: soldCurrent,
      stokTerjualChange: percentChange(soldCurrent, soldPrevious),
      pembeli: buyersCurrent,
      pembeliChange: percentChange(buyersCurrent, buyersPrevious),
    });
  } catch (error) {
    console.error('[productController.summary]', error);
    return fail(res, 500, 'Terjadi kesalahan pada server. Silakan coba lagi.');
  }
};

// Daftar kategori unik (default kategori + kategori yang dipakai produk). 
const categories = async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT DISTINCT category FROM products WHERE is_active = 1 ORDER BY category ASC'
    );
    const used = rows.map((row) => row.category).filter(Boolean);
    return success(res, [...new Set([...DEFAULT_CATEGORIES, ...used])]);
  } catch (error) {
    console.error('[productController.categories]', error);
    return fail(res, 500, 'Terjadi kesalahan pada server. Silakan coba lagi.');
  }
};

// Buat produk baru. Kode (sku) dibuat otomatis: PRD-001, PRD-002, ... 
const create = async (req, res) => {
  const { error, value } = validateProduct(req.body);
  if (error) {
    return fail(res, 422, 'Validasi data gagal. Periksa kembali isian formulir Anda.', error);
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [seqRows] = await connection.execute(
      "SELECT MAX(CAST(SUBSTRING(sku, 5) AS UNSIGNED)) AS max_seq FROM products WHERE sku LIKE 'PRD-%'"
    );
    const nextSeq = Number(seqRows[0]?.max_seq || 0) + 1;
    const sku = `PRD-${String(nextSeq).padStart(3, '0')}`;

    const [result] = await connection.execute(
      `INSERT INTO products (sku, name, category, cost_price, selling_price, stock, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [sku, value.nama, value.kategori, value.hargaModal, value.hargaJual, value.stok, value.imageUrl || '']
    );

    await connection.commit();

    const [rows] = await connection.execute(
      `SELECT id, sku, name, category, cost_price, selling_price, stock, image_url, created_at
       FROM products WHERE id = ?`,
      [result.insertId]
    );

    return success(res, mapProduct(rows[0]), 201);
  } catch (error) {
    await connection.rollback();
    console.error('[productController.create]', error);
    return fail(res, 500, 'Gagal menyimpan produk. Silakan coba lagi.');
  } finally {
    connection.release();
  }
};

// Ubah produk berdasarkan id. 
const update = async (req, res) => {
  const { error, value } = validateProduct(req.body);
  if (error) {
    return fail(res, 422, 'Validasi data gagal. Periksa kembali isian formulir Anda.', error);
  }

  try {
    const [existing] = await db.execute(
      'SELECT id FROM products WHERE id = ? AND is_active = 1',
      [req.params.id]
    );
    if (!existing.length) {
      return fail(res, 404, 'Produk tidak ditemukan.');
    }

    await db.execute(
      `UPDATE products
       SET name = ?, category = ?, cost_price = ?, selling_price = ?, stock = ?, image_url = ?
       WHERE id = ?`,
      [
        value.nama,
        value.kategori,
        value.hargaModal,
        value.hargaJual,
        value.stok,
        value.imageUrl || '',
        req.params.id,
      ]
    );

    const [rows] = await db.execute(
      `SELECT id, sku, name, category, cost_price, selling_price, stock, image_url, created_at
       FROM products WHERE id = ?`,
      [req.params.id]
    );

    return success(res, mapProduct(rows[0]), 200);
  } catch (error) {
    console.error('[productController.update]', error);
    return fail(res, 500, 'Gagal mengubah produk. Silakan coba lagi.');
  }
};

// Hapus satu produk. Snapshot di riwayat transaksi tetap aman. 
const remove = async (req, res) => {
  try {
    const [result] = await db.execute('DELETE FROM products WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) {
      return fail(res, 404, 'Produk tidak ditemukan.');
    }
    return success(res, { deleted: result.affectedRows }, 200);
  } catch (error) {
    console.error('[productController.remove]', error);
    return fail(res, 500, 'Gagal menghapus produk. Silakan coba lagi.');
  }
};

// Hapus banyak produk sekaligus (dipakai fitur bulk delete frontend). 
const bulkRemove = async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const cleanIds = ids.map(String).filter((id) => /^\d+$/.test(id));

  if (!cleanIds.length) {
    return fail(res, 422, 'Pilih minimal satu produk.', { ids: 'Pilih minimal satu produk.' });
  }

  try {
    const placeholders = cleanIds.map(() => '?').join(',');
    const [result] = await db.execute(
      `DELETE FROM products WHERE id IN (${placeholders})`,
      cleanIds
    );
    return success(res, { deleted: result.affectedRows }, 200);
  } catch (error) {
    console.error('[productController.bulkRemove]', error);
    return fail(res, 500, 'Gagal menghapus produk. Silakan coba lagi.');
  }
};

module.exports = { list, summary, categories, create, update, remove, bulkRemove };
