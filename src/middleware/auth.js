const jwt = require('jsonwebtoken');
const { fail } = require('../utils/response');


// Verifikasi JWT dari header: Authorization: Bearer <token>
// Jika valid, data user disimpan di req.user: { id, role }
 
const verifyToken = (req, res, next) => {
  const header = req.headers.authorization || req.headers.Authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return fail(res, 401, 'Token tidak tersedia. Silakan masuk terlebih dahulu.');
  }

  const token = header.split(' ')[1];
  if (!token) {
    return fail(res, 401, 'Token tidak valid.');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      id: String(decoded.id),
      role: decoded.role,
    };

    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return fail(res, 401, 'Token telah kedaluwarsa. Silakan masuk kembali.');
    }
    return fail(res, 401, 'Token tidak valid.');
  }
};

module.exports = { verifyToken };
