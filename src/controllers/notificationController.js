const db = require('../config/database');
const { success, fail } = require('../utils/response');

const mapNotification = (row) => ({
  id: String(row.id),
  type: row.type,
  title: row.title,
  message: row.message,
  read: Boolean(row.is_read),
  createdAt: new Date(row.created_at).toISOString(),
});

// Notifikasi milik user yang login, terbaru di atas, maksimal 50. 
const list = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, type, title, message, is_read, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT 50`,
      [req.user.id]
    );

    return success(res, rows.map(mapNotification));
  } catch (error) {
    console.error('[notificationController.list]', error);
    return fail(res, 500, 'Terjadi kesalahan pada server. Silakan coba lagi.');
  }
};

const markAllRead = async (req, res) => {
  try {
    await db.execute(
      'UPDATE notifications SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0',
      [req.user.id]
    );
    return success(res, { updated: true });
  } catch (error) {
    console.error('[notificationController.markAllRead]', error);
    return fail(res, 500, 'Gagal memperbarui notifikasi. Silakan coba lagi.');
  }
};

const markRead = async (req, res) => {
  try {
    const [result] = await db.execute(
      'UPDATE notifications SET is_read = 1, read_at = NOW() WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    if (!result.affectedRows) {
      return fail(res, 404, 'Notifikasi tidak ditemukan.');
    }

    return success(res, { updated: true });
  } catch (error) {
    console.error('[notificationController.markRead]', error);
    return fail(res, 500, 'Gagal memperbarui notifikasi. Silakan coba lagi.');
  }
};

module.exports = { list, markAllRead, markRead };
