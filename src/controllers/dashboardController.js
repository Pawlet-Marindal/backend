const db = require('../config/database');
const { success, fail } = require('../utils/response');

/** Ubah "YYYY-MM" jadi rentang waktu SQL + jumlah hari dalam bulan. */
const resolveMonth = (rawMonth) => {
  const fallback = new Date().toISOString().slice(0, 7);
  const month = /^\d{4}-\d{2}$/.test(String(rawMonth || '')) ? String(rawMonth) : fallback;
  const [year, monthNumber] = month.split('-').map(Number);

  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  const end = new Date(Date.UTC(year, monthNumber, 1));
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  return {
    month,
    start: start.toISOString().slice(0, 19).replace('T', ' '),
    end: end.toISOString().slice(0, 19).replace('T', ' '),
    daysInMonth,
    shift: (offset) => {
      const shifted = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
      return {
        start: shifted.toISOString().slice(0, 19).replace('T', ' '),
        end: new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 1))
          .toISOString()
          .slice(0, 19)
          .replace('T', ' '),
      };
    },
  };
};

const percentChange = (current, previous) => {
  const c = Number(current) || 0;
  const p = Number(previous) || 0;
  if (p === 0) return c === 0 ? 0 : 100;
  return ((c - p) / Math.abs(p)) * 100;
};

/** Ambil agregat modal/penjualan/keuntungan/transaksi pada rentang tertentu. */
const aggregate = async (range) => {
  const [rows] = await db.execute(
    `SELECT COALESCE(SUM(total_cost), 0) AS modal,
            COALESCE(SUM(total_sales), 0) AS penjualan,
            COALESCE(SUM(total_profit), 0) AS keuntungan,
            COUNT(*) AS transaksi
     FROM transactions
     WHERE created_at >= ? AND created_at < ?`,
    [range.start, range.end]
  );
  const row = rows[0];
  return {
    modal: Number(row.modal),
    penjualan: Number(row.penjualan),
    keuntungan: Number(row.keuntungan),
    transaksi: Number(row.transaksi),
  };
};

/** KPI ringkasan bulan ini + perubahan dibanding bulan sebelumnya. */
const summary = async (req, res) => {
  try {
    const currentMonth = resolveMonth(req.query.month);
    const previousMonth = currentMonth.shift(-1);

    const current = await aggregate(currentMonth);
    const previous = await aggregate(previousMonth);

    return success(res, {
      month: currentMonth.month,
      modal: current.modal,
      penjualan: current.penjualan,
      keuntungan: current.keuntungan,
      transaksi: current.transaksi,
      change: {
        modal: percentChange(current.modal, previous.modal),
        penjualan: percentChange(current.penjualan, previous.penjualan),
        keuntungan: percentChange(current.keuntungan, previous.keuntungan),
      },
    });
  } catch (error) {
    console.error('[dashboardController.summary]', error);
    return fail(res, 500, 'Terjadi kesalahan pada server. Silakan coba lagi.');
  }
};

/** Tren harian. Tanggal tanpa transaksi = null (bukan 0). */
const trend = async (req, res) => {
  try {
    const currentMonth = resolveMonth(req.query.month);
    const [rows] = await db.execute(
      `SELECT DAY(created_at) AS tanggal,
              SUM(total_sales) AS penjualan,
              SUM(total_profit) AS keuntungan
       FROM transactions
       WHERE created_at >= ? AND created_at < ?
       GROUP BY DAY(created_at)`,
      [currentMonth.start, currentMonth.end]
    );

    const byDay = new Map(rows.map((row) => [Number(row.tanggal), row]));
    const labels = [];
    const penjualan = [];
    const keuntungan = [];

    for (let day = 1; day <= currentMonth.daysInMonth; day += 1) {
      const row = byDay.get(day);
      labels.push(String(day));
      penjualan.push(row ? Number(row.penjualan) : null);
      keuntungan.push(row ? Number(row.keuntungan) : null);
    }

    return success(res, {
      month: currentMonth.month,
      labels,
      penjualan,
      keuntungan,
    });
  } catch (error) {
    console.error('[dashboardController.trend]', error);
    return fail(res, 500, 'Terjadi kesalahan pada server. Silakan coba lagi.');
  }
};

/** Rekap bulanan: ringkasan, per hari, dan produk terlaris. */
const report = async (req, res) => {
  try {
    const currentMonth = resolveMonth(req.query.month);
    const summaryData = await aggregate(currentMonth);

    const [dailyRows] = await db.execute(
      `SELECT DAY(created_at) AS tanggal,
              COUNT(*) AS transaksi,
              COALESCE(SUM(total_cost), 0) AS modal,
              COALESCE(SUM(total_sales), 0) AS penjualan,
              COALESCE(SUM(total_profit), 0) AS keuntungan
       FROM transactions
       WHERE created_at >= ? AND created_at < ?
       GROUP BY DAY(created_at)
       ORDER BY tanggal ASC`,
      [currentMonth.start, currentMonth.end]
    );

    const dailyByDay = new Map(dailyRows.map((row) => [Number(row.tanggal), row]));
    const daily = [];
    for (let day = 1; day <= currentMonth.daysInMonth; day += 1) {
      const row = dailyByDay.get(day);
      daily.push({
        tanggal: day,
        transaksi: row ? Number(row.transaksi) : 0,
        modal: row ? Number(row.modal) : 0,
        penjualan: row ? Number(row.penjualan) : 0,
        keuntungan: row ? Number(row.keuntungan) : 0,
      });
    }

    const [topRows] = await db.execute(
      `SELECT ti.product_id, ti.product_name_snapshot AS name,
              SUM(ti.quantity) AS qty,
              SUM(ti.subtotal_sales) AS penjualan,
              SUM(ti.subtotal_profit) AS keuntungan
       FROM transaction_items ti
       JOIN transactions t ON t.id = ti.transaction_id
       WHERE t.created_at >= ? AND t.created_at < ?
       GROUP BY ti.product_id, ti.product_name_snapshot
       ORDER BY qty DESC, penjualan DESC
       LIMIT 10`,
      [currentMonth.start, currentMonth.end]
    );

    const topProducts = topRows.map((row) => ({
      productId: row.product_id ? String(row.product_id) : '',
      name: row.name,
      qty: Number(row.qty),
      penjualan: Number(row.penjualan),
      keuntungan: Number(row.keuntungan),
    }));

    return success(res, {
      month: currentMonth.month,
      summary: summaryData,
      daily,
      topProducts,
    });
  } catch (error) {
    console.error('[dashboardController.report]', error);
    return fail(res, 500, 'Terjadi kesalahan pada server. Silakan coba lagi.');
  }
};

module.exports = { summary, trend, report };
