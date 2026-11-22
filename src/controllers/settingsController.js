const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { success, fail } = require('../utils/response');
const { validateStore, validatePassword } = require('../validators/settingsValidator');

// Sesuai kontrak + alias frontend (catatanStruk, jamOperasional). 
const mapStore = (row) => {
  const catatan = row.footer_struk || row.catatan_struk || '';
  return {
    nama: row.store_name,
    alamat: row.store_address || '',
    telepon: row.store_phone || '',
    whatsapp: row.whatsapp || '',
    footerStruk: catatan,
    catatanStruk: catatan,
    jamOperasional: row.jam_operasional || '',
  };
};

const getStore = async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM settings WHERE id = 1 LIMIT 1');
    if (!rows.length) {
      return fail(res, 404, 'Pengaturan toko tidak ditemukan.');
    }
    return success(res, mapStore(rows[0]));
  } catch (error) {
    console.error('[settingsController.getStore]', error);
    return fail(res, 500, 'Terjadi kesalahan pada server. Silakan coba lagi.');
  }
};

const updateStore = async (req, res) => {
  const { error, value } = validateStore(req.body);
  if (error) {
    return fail(res, 422, 'Validasi data gagal. Periksa kembali isian formulir Anda.', error);
  }

  try {
    const footer = value.footerStruk !== undefined ? value.footerStruk : value.catatanStruk;

    await db.execute(
      `UPDATE settings
       SET store_name = ?, store_address = ?, store_phone = ?, whatsapp = ?,
           footer_struk = ?, jam_operasional = ?, updated_by = ?
       WHERE id = 1`,
      [
        value.nama,
        value.alamat || '',
        value.telepon || '',
        value.whatsapp || '',
        footer || '',
        value.jamOperasional || '',
        req.user.id,
      ]
    );

    const [rows] = await db.execute('SELECT * FROM settings WHERE id = 1 LIMIT 1');
    return success(res, mapStore(rows[0]));
  } catch (error) {
    console.error('[settingsController.updateStore]', error);
    return fail(res, 500, 'Gagal menyimpan pengaturan toko. Silakan coba lagi.');
  }
};

const changePassword = async (req, res) => {
  const { error, value } = validatePassword(req.body);
  if (error) {
    return fail(res, 422, 'Validasi data gagal. Periksa kembali isian formulir Anda.', error);
  }

  try {
    const [rows] = await db.execute(
      'SELECT password_hash FROM users WHERE id = ? LIMIT 1',
      [req.user.id]
    );
    const user = rows[0];
    if (!user) {
      return fail(res, 404, 'Akun tidak ditemukan.');
    }

    const matches = await bcrypt.compare(value.passwordLama, user.password_hash);
    if (!matches) {
      return fail(res, 422, 'Password lama tidak sesuai.', {
        passwordLama: 'Password lama tidak sesuai.',
      });
    }

    const newHash = await bcrypt.hash(value.passwordBaru, 10);
    await db.execute('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.user.id]);

    return success(res, { message: 'Password berhasil diubah.' });
  } catch (error) {
    console.error('[settingsController.changePassword]', error);
    return fail(res, 500, 'Gagal mengubah password. Silakan coba lagi.');
  }
};

module.exports = { getStore, updateStore, changePassword };
