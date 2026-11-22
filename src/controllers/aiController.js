const db = require('../config/database');
const { success, fail } = require('../utils/response');
const { resolveMonth } = require('../utils/period');
const { validateMessage } = require('../validators/aiValidator');

const rupiah = (value) => `Rp ${Math.round(Number(value) || 0).toLocaleString('id-ID')}`;

const mapMessage = (row) => ({
  id: String(row.id),
  role: row.role,
  text: row.content,
  createdAt: new Date(row.created_at).toISOString(),
});

// Satu percakapan per user. Dibuat otomatis jika belum ada. 
const getConversationId = async (connection, userId) => {
  const [rows] = await connection.execute(
    'SELECT id FROM ai_conversations WHERE user_id = ? ORDER BY id DESC LIMIT 1',
    [userId]
  );
  if (rows.length) return rows[0].id;

  const [result] = await connection.execute(
    "INSERT INTO ai_conversations (user_id, title) VALUES (?, 'Riwayat Chat')",
    [userId]
  );
  return result.insertId;
};

// Jawaban placeholder berbasis data toko.
// Front-End tidak pernah memanggil provider AI langsung — semua lewat Express.
 
const localReply = async (message) => {
  const range = resolveMonth();
  const [rows] = await db.execute(
    `SELECT COALESCE(SUM(total_sales), 0) AS penjualan,
            COALESCE(SUM(total_profit), 0) AS keuntungan,
            COUNT(*) AS transaksi
     FROM transactions
     WHERE created_at >= ? AND created_at < ?`,
    [range.start, range.end]
  );
  const stat = rows[0];
  const query = String(message).toLowerCase();

  if (/(untung|laba|profit)/.test(query)) {
    return `Total keuntungan bersih Marindal Petshop per ${range.month} adalah ${rupiah(stat.keuntungan)} dari ${Number(stat.transaksi)} transaksi.`;
  }
  if (/modal/.test(query)) {
    return `Total modal bulan ${range.month} adalah ${rupiah(Number(stat.penjualan) - Number(stat.keuntungan))}.`;
  }
  if (/(jual|omzet|penjualan)/.test(query)) {
    return `Total penjualan bulan ${range.month} adalah ${rupiah(stat.penjualan)} dari ${Number(stat.transaksi)} transaksi.`;
  }
  if (/(laris|terbaik|populer)/.test(query)) {
    const [topRows] = await db.execute(
      `SELECT ti.product_name_snapshot AS name, SUM(ti.quantity) AS qty
       FROM transaction_items ti
       JOIN transactions t ON t.id = ti.transaction_id
       WHERE t.created_at >= ? AND t.created_at < ?
       GROUP BY ti.product_id, ti.product_name_snapshot
       ORDER BY qty DESC
       LIMIT 3`,
      [range.start, range.end]
    );
    return topRows.length
      ? `Produk terlaris bulan ini: ${topRows.map((r) => `${r.name} (${Number(r.qty)} unit)`).join(', ')}.`
      : 'Belum ada transaksi bulan ini.';
  }

  return 'Saya dapat membantu menjawab ringkasan penjualan, modal, keuntungan, dan produk terlaris. Coba tanyakan salah satunya.';
};

// Jika AI_SERVICE_URL diisi, kirim ke layanan AI sungguhan (timeout 10 detik).
// Gagal/timeout → null, dan controller akan membalas 503 sesuai kontrak.
 
const requestAiService = async (message) => {
  if (!process.env.AI_SERVICE_URL) return null;

  try {
    const response = await fetch(process.env.AI_SERVICE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) throw new Error(`AI service status ${response.status}`);

    const data = await response.json();
    const text = String(data.text || data.reply || data.answer || '').trim();
    return text || null;
  } catch (error) {
    console.error('[aiController.requestAiService]', error.message);
    return null;
  }
};

// Histori 50 pesan terakhir milik user yang login. 
const history = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT m.id, m.role, m.content, m.created_at
       FROM ai_messages m
       JOIN ai_conversations c ON c.id = m.conversation_id
       WHERE c.user_id = ? AND m.role IN ('user', 'assistant')
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT 50`,
      [req.user.id]
    );

    return success(res, rows.reverse().map(mapMessage));
  } catch (error) {
    console.error('[aiController.history]', error);
    return fail(res, 500, 'Terjadi kesalahan pada server. Silakan coba lagi.');
  }
};

// Kirim pertanyaan, simpan pesan user + jawaban assistant. 
const send = async (req, res) => {
  const { error, value } = validateMessage(req.body);
  if (error) {
    return fail(res, 422, 'Validasi data gagal. Periksa kembali isian formulir Anda.', error);
  }

  const externalReply = await requestAiService(value.message);

  if (process.env.AI_SERVICE_URL && !externalReply) {
    return fail(res, 503, 'Layanan AI sedang sibuk. Silakan coba kirim ulang pertanyaan Anda.');
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const conversationId = await getConversationId(connection, req.user.id);

    await connection.execute(
      "INSERT INTO ai_messages (conversation_id, role, content) VALUES (?, 'user', ?)",
      [conversationId, value.message]
    );

    const replyText = externalReply || (await localReply(value.message));

    const [assistantMessage] = await connection.execute(
      "INSERT INTO ai_messages (conversation_id, role, content) VALUES (?, 'assistant', ?)",
      [conversationId, replyText]
    );

    await connection.commit();

    const [rows] = await connection.execute(
      'SELECT id, role, content, created_at FROM ai_messages WHERE id = ?',
      [assistantMessage.insertId]
    );

    return success(res, mapMessage(rows[0]), 200);
  } catch (error) {
    await connection.rollback();
    console.error('[aiController.send]', error);
    return fail(res, 500, 'Gagal memproses pertanyaan. Silakan coba lagi.');
  } finally {
    connection.release();
  }
};

module.exports = { history, send };
