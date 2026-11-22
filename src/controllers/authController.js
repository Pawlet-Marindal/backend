const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { success, fail } = require('../utils/response');
const { validateLogin } = require('../validators/authValidator');


// Gunakan snake_case agar sesuai dengan frontend:

const mapUser = (row) => ({
  id: String(row.id),
  nama: row.name,
  email: row.email,
  role: row.role,
  avatar: row.avatar_url || null,
  status: row.is_active ? 'Aktif' : 'Nonaktif',
});

const login = async (req, res) => {
  const { error, value } = validateLogin(req.body);
  if (error) {
    return fail(res, 422, 'Validasi data gagal. Periksa kembali isian formulir Anda.', error);
  }

  try {
    const [rows] = await db.execute(
      'SELECT id, name, email, password_hash, role, is_active FROM users WHERE email = ? LIMIT 1',
      [value.email.toLowerCase()]
    );

    const user = rows[0];
    if (!user || !(await bcrypt.compare(value.password, user.password_hash))) {
      return fail(res, 401, 'Email atau password salah.');
    }

    if (!user.is_active) {
      return fail(res, 403, 'Akun Anda tidak aktif. Hubungi pemilik toko.');
    }

    const token = jwt.sign(
      { id: String(user.id), role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
    );

    return success(res, { token, user: mapUser(user) }, 200);
  } catch (error) {
    console.error('[authController.login]', error);
    return fail(res, 500, 'Terjadi kesalahan pada server. Silakan coba lagi.');
  }
};

const me = async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, name, email, role, is_active FROM users WHERE id = ? LIMIT 1',
      [req.user.id]
    );

    const user = rows[0];
    if (!user) {
      return fail(res, 401, 'Akun tidak ditemukan. Silakan masuk kembali.');
    }

    if (!user.is_active) {
      return fail(res, 403, 'Akun Anda tidak aktif.');
    }

    return success(res, mapUser(user), 200);
  } catch (error) {
    console.error('[authController.me]', error);
    return fail(res, 500, 'Terjadi kesalahan pada server. Silakan coba lagi.');
  }
};

// JWT bersifat stateless, jadi logout cukup mengembalikan pesan sukses.
// Frontend bertugas menghapus token dari localStorage/sessionStorage.

const logout = async (req, res) => {
  return success(res, { message: 'Berhasil keluar.' }, 200);
};

module.exports = { login, me, logout };
