const { fail } = require('../utils/response');

/** Rute tidak ditemukan — tetap balas JSON envelope. */
const notFound = (req, res) => {
  return fail(res, 404, 'Endpoint tidak ditemukan.');
};

/**
 * Error handler global (harus didaftarkan paling akhir).
 * Semua error — termasuk JSON rusak dari express.json() — dijawab JSON,
 * bukan halaman HTML bawaan Express.
 */
const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const rawStatus = Number(err.status || err.statusCode);
  const status = rawStatus >= 400 && rawStatus <= 599 ? rawStatus : 500;

  // Jangan log objek error mentah: bisa memuat body request (password/token).
  console.error('[errorHandler]', {
    method: req.method,
    path: String(req.originalUrl || req.url || '').split('?')[0],
    status,
    code: err.code,
    type: err.type,
  });

  // Body JSON tidak valid, misalnya "{ "nama": "
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return fail(res, 400, 'Format JSON tidak valid.');
  }

  if (err.type === 'entity.too.large') {
    return fail(res, 413, 'Ukuran permintaan terlalu besar.');
  }

  if (err.code === 'ER_DUP_ENTRY') {
    return fail(res, 409, 'Data sudah ada. Periksa kembali data yang dikirim.');
  }

  const message = status === 500
    ? 'Terjadi kesalahan pada server. Silakan coba lagi.'
    : err.message || 'Permintaan tidak dapat diproses.';

  return fail(res, status, message, err.errors);
};

module.exports = { notFound, errorHandler };
