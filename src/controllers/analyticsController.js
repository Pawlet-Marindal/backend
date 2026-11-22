const db = require('../config/database');
const { success, fail } = require('../utils/response');
const { resolveMonth } = require('../utils/period');

// DAYOFWEEK MySQL: 1 = Minggu ... 7 = Sabtu
const DAY_NAMES = ['', 'Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const rupiah = (value) => `Rp ${Math.round(Number(value) || 0).toLocaleString('id-ID')}`;

// Insight bisnis hasil olahan data transaksi.
// Saat ini dihitung internal Express. Nanti bisa diganti panggil engine Data Science
// lewat env DS_SERVICE_URL tanpa mengubah kontrak response.

const insights = async (req, res) => {
  try {
    const range = resolveMonth(req.query.month);

    const [topRows] = await db.execute(
      `SELECT ti.product_name_snapshot AS name,
              SUM(ti.quantity) AS qty,
              SUM(ti.subtotal_sales) AS penjualan
       FROM transaction_items ti
       JOIN transactions t ON t.id = ti.transaction_id
       WHERE t.created_at >= ? AND t.created_at < ? AND t.status = 'active'
       GROUP BY ti.product_id, ti.product_name_snapshot
       ORDER BY qty DESC, penjualan DESC
       LIMIT 1`,
      [range.start, range.end]
    );
    const top = topRows[0];

    const [dayRows] = await db.execute(
      `SELECT DAYOFWEEK(created_at) AS day_index, COUNT(*) AS transaksi
       FROM transactions
       WHERE created_at >= ? AND created_at < ? AND status = 'active'
       GROUP BY DAYOFWEEK(created_at)
       ORDER BY transaksi DESC, day_index ASC
       LIMIT 1`,
      [range.start, range.end]
    );
    const busiest = dayRows[0];

    const [marginRows] = await db.execute(
      `SELECT name, ((selling_price - cost_price) / selling_price) AS margin
       FROM products
       WHERE is_active = 1 AND selling_price > 0
       ORDER BY margin ASC
       LIMIT 1`
    );
    const lowMargin = marginRows[0];

    const result = [];

    result.push(
      top
        ? {
            id: 'ins_01',
            type: 'produk',
            title: 'Produk Terlaris Bulan Ini',
            description: `${top.name} terjual ${Number(top.qty)} unit dan menyumbang ${rupiah(top.penjualan)} dari total penjualan.`,
            metric: `${Number(top.qty)} unit terjual`,
          }
        : {
            id: 'ins_01',
            type: 'produk',
            title: 'Produk Terlaris Bulan Ini',
            description: 'Belum ada transaksi pada bulan ini.',
            metric: '0 unit terjual',
          }
    );

    result.push(
      busiest
        ? {
            id: 'ins_02',
            type: 'waktu',
            title: 'Hari Penjualan Paling Ramai',
            description: `${DAY_NAMES[Number(busiest.day_index)]} mencatat ${Number(busiest.transaksi)} transaksi pada bulan ini.`,
            metric: DAY_NAMES[Number(busiest.day_index)],
          }
        : {
            id: 'ins_02',
            type: 'waktu',
            title: 'Hari Penjualan Paling Ramai',
            description: 'Belum ada transaksi pada bulan ini.',
            metric: '-',
          }
    );

    result.push(
      lowMargin
        ? {
            id: 'ins_03',
            type: 'rekomendasi',
            title: 'Rekomendasi Penyesuaian Harga',
            description: `${lowMargin.name} memiliki margin laba paling tipis (${Math.round(Number(lowMargin.margin) * 100)}%). Pertimbangkan meninjau harga jualnya.`,
            metric: `Margin ${Math.round(Number(lowMargin.margin) * 100)}%`,
          }
        : {
            id: 'ins_03',
            type: 'rekomendasi',
            title: 'Rekomendasi Penyesuaian Harga',
            description: 'Belum ada produk aktif untuk dianalisis.',
            metric: '-',
          }
    );

    return success(res, {
      generatedAt: new Date().toISOString(),
      source: 'data-science-engine',
      insights: result,
    });
  } catch (error) {
    console.error('[analyticsController.insights]', error);
    return fail(res, 500, 'Terjadi kesalahan pada server. Silakan coba lagi.');
  }
};

module.exports = { insights };
