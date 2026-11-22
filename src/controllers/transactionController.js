const db = require('../config/database');
const { success, fail } = require('../utils/response');
const { validateTransaction } = require('../validators/transactionValidator');

const mapItem = (row) => ({
  productId: String(row.product_id),
  name: row.product_name_snapshot,
  hargaModal: Number(row.cost_price_snapshot),
  hargaJual: Number(row.selling_price_snapshot),
  qty: Number(row.quantity),
});

const mapTransaction = (row, items = []) => ({
  id: row.transaction_code,
  employeeId: String(row.employee_id),
  employeeName: row.employee_name,
  totalModal: Number(row.total_cost),
  totalPenjualan: Number(row.total_sales),
  keuntungan: Number(row.total_profit),
  createdAt: new Date(row.created_at).toISOString(),
  items,
});

// Ambil items banyak transaksi sekaligus lalu dikelompokkan per transaction_id. 
const loadItems = async (transactionIds) => {
  if (!transactionIds.length) return new Map();

  const placeholders = transactionIds.map(() => '?').join(',');
  const [rows] = await db.execute(
    `SELECT transaction_id, product_id, product_name_snapshot, cost_price_snapshot,
            selling_price_snapshot, quantity
     FROM transaction_items
     WHERE transaction_id IN (${placeholders})
     ORDER BY id ASC`,
    transactionIds
  );

  const grouped = new Map();
  rows.forEach((row) => {
    const key = String(row.transaction_id);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(mapItem(row));
  });
  return grouped;
};

// Buat nomor struk otomatis: TRX-0001, TRX-0002, ... 
const nextTransactionCode = async (connection) => {
  const [rows] = await connection.execute(
    "SELECT MAX(CAST(SUBSTRING(transaction_code, 5) AS UNSIGNED)) AS max_seq FROM transactions WHERE transaction_code LIKE 'TRX-%'"
  );
  return `TRX-${String(Number(rows[0]?.max_seq || 0) + 1).padStart(4, '0')}`;
};

// Simpan transaksi kasir.
// ATURAN KRUSIAL: harga modal & harga jual diambil dari tabel products saat ini,
// lalu disimpan sebagai snapshot. Perubahan harga nanti tidak mengubah riwayat.
 
const create = async (req, res) => {
  const { error, value } = validateTransaction(req.body);
  if (error) {
    return fail(res, 422, 'Validasi data gagal. Periksa kembali isian formulir Anda.', error);
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Gabungkan productId yang sama agar pengecekan stok tidak dobel.
    const qtyByProduct = new Map();
    value.items.forEach((item) => {
      const key = String(item.productId);
      qtyByProduct.set(key, (qtyByProduct.get(key) || 0) + Number(item.qty));
    });

    const productIds = [...qtyByProduct.keys()];
    const placeholders = productIds.map(() => '?').join(',');
    const [productRows] = await connection.execute(
      `SELECT id, name, cost_price, selling_price, stock
       FROM products
       WHERE id IN (${placeholders}) AND is_active = 1
       FOR UPDATE`,
      productIds
    );

    const productMap = new Map(productRows.map((row) => [String(row.id), row]));
    const items = [];
    const stockErrors = {};

    for (const [productId, qty] of qtyByProduct) {
      const product = productMap.get(productId);
      if (!product) {
        await connection.rollback();
        return fail(res, 404, 'Salah satu produk tidak ditemukan. Muat ulang halaman.');
      }
      if (qty > Number(product.stock)) {
        stockErrors[productId] = `Stok ${product.name} hanya tersedia ${product.stock}.`;
        continue;
      }

      // Snapshot harga diambil DARI DATABASE, bukan dari request client.
      items.push({
        productId,
        name: product.name,
        hargaModal: Number(product.cost_price),
        hargaJual: Number(product.selling_price),
        qty,
      });
    }

    if (Object.keys(stockErrors).length) {
      await connection.rollback();
      return fail(res, 422, Object.values(stockErrors)[0], stockErrors);
    }

    const totalModal = items.reduce((sum, item) => sum + item.hargaModal * item.qty, 0);
    const totalPenjualan = items.reduce((sum, item) => sum + item.hargaJual * item.qty, 0);
    const keuntungan = totalPenjualan - totalModal;
    const transactionCode = await nextTransactionCode(connection);

    const [result] = await connection.execute(
      `INSERT INTO transactions
        (transaction_code, employee_id, total_cost, total_sales, total_profit)
       VALUES (?, ?, ?, ?, ?)`,
      [transactionCode, req.user.id, totalModal, totalPenjualan, keuntungan]
    );
    const transactionId = result.insertId;

    for (const item of items) {
      await connection.execute(
        `INSERT INTO transaction_items
          (transaction_id, product_id, product_name_snapshot, cost_price_snapshot,
           selling_price_snapshot, quantity, subtotal_cost, subtotal_sales, subtotal_profit)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          transactionId,
          item.productId,
          item.name,
          item.hargaModal,
          item.hargaJual,
          item.qty,
          item.hargaModal * item.qty,
          item.hargaJual * item.qty,
          (item.hargaJual - item.hargaModal) * item.qty,
        ]
      );

      await connection.execute(
        'UPDATE products SET stock = stock - ? WHERE id = ?',
        [item.qty, item.productId]
      );
    }

    const [employeeRows] = await connection.execute(
      'SELECT name FROM users WHERE id = ?',
      [req.user.id]
    );

    await connection.commit();

    return success(
      res,
      {
        id: transactionCode,
        employeeId: String(req.user.id),
        employeeName: employeeRows[0]?.name || '',
        totalModal,
        totalPenjualan,
        keuntungan,
        createdAt: new Date().toISOString(),
        items,
      },
      201
    );
  } catch (error) {
    await connection.rollback();
    console.error('[transactionController.create]', error);
    return fail(res, 500, 'Gagal menyimpan transaksi. Silakan coba lagi.');
  } finally {
    connection.release();
  }
};

// Riwayat transaksi: filter month, employeeId, search + pagination. 
const list = async (req, res) => {
  try {
    const month = String(req.query.month || '').trim();
    const employeeId = String(req.query.employeeId || '').trim();
    const search = String(req.query.search || '').trim().replace('#', '');
    const rawLimit = String(req.query.limit ?? '');
    const all = rawLimit.toLowerCase() === 'all';
    const requestedLimit = all ? 0 : Math.max(1, parseInt(rawLimit, 10) || 10);
    const requestedPage = Math.max(1, parseInt(req.query.page, 10) || 1);

    const where = ['1 = 1'];
    const params = [];

    if (/^\d{4}-\d{2}$/.test(month)) {
      where.push("DATE_FORMAT(t.created_at, '%Y-%m') = ?");
      params.push(month);
    }
    if (employeeId) {
      where.push('t.employee_id = ?');
      params.push(employeeId);
    }
    if (search) {
      where.push(
        `(t.transaction_code LIKE ? OR u.name LIKE ? OR EXISTS (
            SELECT 1 FROM transaction_items ti
            WHERE ti.transaction_id = t.id AND ti.product_name_snapshot LIKE ?
          ))`
      );
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    const whereSql = where.join(' AND ');
    const [[{ total }]] = await db.execute(
      `SELECT COUNT(*) AS total
       FROM transactions t
       JOIN users u ON u.id = t.employee_id
       WHERE ${whereSql}`,
      params
    );

    const totalPages = Math.max(1, Math.ceil(total / (all ? Math.max(total, 1) : requestedLimit)));
    const page = all ? 1 : Math.min(requestedPage, totalPages);
    const limit = all ? Math.max(total, 1) : requestedLimit;
    const offset = (page - 1) * limit;

    const [rows] = await db.execute(
      `SELECT t.id, t.transaction_code, t.employee_id, u.name AS employee_name,
              t.total_cost, t.total_sales, t.total_profit, t.created_at
       FROM transactions t
       JOIN users u ON u.id = t.employee_id
       WHERE ${whereSql}
       ORDER BY t.created_at DESC, t.id DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    const itemsByTransaction = await loadItems(rows.map((row) => row.id));

    return success(
      res,
      rows.map((row) => mapTransaction(row, itemsByTransaction.get(String(row.id)) || [])),
      200,
      { page, limit, total: Number(total), totalPages }
    );
  } catch (error) {
    console.error('[transactionController.list]', error);
    return fail(res, 500, 'Terjadi kesalahan pada server. Silakan coba lagi.');
  }
};

// Detail satu transaksi (dipakai service frontend untuk fitur detail struk). 
const getById = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT t.id, t.transaction_code, t.employee_id, u.name AS employee_name,
              t.total_cost, t.total_sales, t.total_profit, t.created_at
       FROM transactions t
       JOIN users u ON u.id = t.employee_id
       WHERE t.id = ? OR t.transaction_code = ?
       LIMIT 1`,
      [req.params.id, req.params.id]
    );

    if (!rows.length) {
      return fail(res, 404, 'Transaksi tidak ditemukan.');
    }

    const itemsByTransaction = await loadItems([rows[0].id]);
    return success(res, mapTransaction(rows[0], itemsByTransaction.get(String(rows[0].id)) || []));
  } catch (error) {
    console.error('[transactionController.getById]', error);
    return fail(res, 500, 'Terjadi kesalahan pada server. Silakan coba lagi.');
  }
};

module.exports = { create, list, getById };
