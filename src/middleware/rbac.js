const { fail } = require('../utils/response');


// Batasi akses berdasarkan role.
// Contoh: requireRole('Pemilik') → hanya Pemilik yang boleh lewat.
 
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return fail(res, 401, 'Token tidak tersedia. Silakan masuk terlebih dahulu.');
  }

  if (!roles.includes(req.user.role)) {
    return fail(res, 403, 'Akses ditolak. Anda tidak memiliki hak untuk fitur ini.');
  }

  return next();
};

const requirePemilik = requireRole('Pemilik');

module.exports = { requireRole, requirePemilik };
