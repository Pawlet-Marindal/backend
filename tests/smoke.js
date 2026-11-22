/**
 * Smoke test seluruh endpoint API Pawlet.
 * Jalankan: npm test  (server harus aktif di PORT 5000)
 */
require('dotenv').config();
const assert = require('node:assert/strict');
const db = require('../src/config/database');

const BASE = process.env.TEST_API_BASE || 'http://localhost:5000/api/v1';
let passed = 0;
let failed = 0;

const step = async (label, fn) => {
  try {
    await fn();
    console.log(`  OK   ${label}`);
    passed += 1;
  } catch (error) {
    console.error(`  FAIL ${label}: ${error.message}`);
    failed += 1;
  }
};

const request = async (method, path, { token, body, rawBody } = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(BASE + path, {
    method,
    headers,
    body: rawBody !== undefined ? rawBody : body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  return { status: response.status, data };
};

const expectStatus = (res, status) => {
  assert.equal(res.status, status, `status ${res.status}, body ${JSON.stringify(res.data)}`);
  assert.equal(typeof res.data.success, 'boolean', 'envelope success harus ada');
};

let tokenP;
let tokenK;
let tempProductId;
let tempTransactionCode;
let tempVoidTransactionCode;
let chatBaselineId = 0;

(async () => {
  console.log('\n=== SMOKE TEST API PAWLET ===\n');

  try {
    // --- AUTH ---
    await step('Health check', async () => {
      const res = await request('GET', '/health');
      expectStatus(res, 200);
    });

    await step('Login Pemilik', async () => {
      const res = await request('POST', '/auth/login', {
        body: { email: 'pemilik@marindal.id', password: 'pemilik123' },
      });
      expectStatus(res, 200);
      assert.ok(res.data.data.token);
      assert.equal(res.data.data.user.role, 'Pemilik');
      tokenP = res.data.data.token;
    });

    await step('Login Karyawan', async () => {
      const res = await request('POST', '/auth/login', {
        body: { email: 'karyawan@marindal.id', password: 'karyawan123' },
      });
      expectStatus(res, 200);
      tokenK = res.data.data.token;
    });

    await step('GET /auth/me', async () => {
      const res = await request('GET', '/auth/me', { token: tokenP });
      expectStatus(res, 200);
      assert.equal(res.data.data.role, 'Pemilik');
    });

    await step('POST /auth/logout', async () => {
      expectStatus(await request('POST', '/auth/logout', { token: tokenP }), 200);
    });

    await step('Login salah → 401', async () => {
      expectStatus(await request('POST', '/auth/login', {
        body: { email: 'pemilik@marindal.id', password: 'salah' },
      }), 401);
    });

    // --- PRODUK ---
    await step('GET /products + meta', async () => {
      const res = await request('GET', '/products?page=1&limit=5', { token: tokenP });
      expectStatus(res, 200);
      assert.ok(res.data.meta);
    });

    await step('GET /products/summary & /categories', async () => {
      expectStatus(await request('GET', '/products/summary', { token: tokenP }), 200);
      expectStatus(await request('GET', '/products/categories', { token: tokenP }), 200);
    });

    await step('POST → PUT → DELETE produk uji', async () => {
      const created = await request('POST', '/products', {
        token: tokenP,
        body: {
          nama: 'Produk Smoke Test', kategori: 'Aksesoris Kucing',
          hargaModal: 1000, hargaJual: 2000, stok: 10, imageUrl: '',
        },
      });
      expectStatus(created, 201);
      tempProductId = created.data.data.id;

      const updated = await request('PUT', `/products/${tempProductId}`, {
        token: tokenP,
        body: {
          nama: 'Produk Smoke Test Ubah', kategori: 'Aksesoris Kucing',
          hargaModal: 1200, hargaJual: 2200, stok: 8, imageUrl: '',
        },
      });
      expectStatus(updated, 200);
      assert.equal(updated.data.data.stok, 8);
    });

    await step('Validasi produk → 422', async () => {
      expectStatus(await request('POST', '/products', {
        token: tokenP, body: { nama: '', hargaModal: -1 },
      }), 422);
    });

    await step('Karyawan dilarang ubah produk → 403', async () => {
      expectStatus(await request('POST', '/products', {
        token: tokenK,
        body: {
          nama: 'Produk Karyawan', kategori: 'Obat Kucing',
          hargaModal: 1, hargaJual: 2, stok: 1,
        },
      }), 403);
    });

    // --- TRANSAKSI ---
    await step('POST /transactions (snapshot harga)', async () => {
      const res = await request('POST', '/transactions', {
        token: tokenK,
        body: { items: [{ productId: tempProductId, qty: 2 }] },
      });
      expectStatus(res, 201);
      assert.equal(res.data.data.items[0].hargaModal, 1200);
      assert.equal(res.data.data.items[0].hargaJual, 2200);
      assert.equal(res.data.data.totalPenjualan, 4400);
      tempTransactionCode = res.data.data.id;
    });

    await step('GET /transactions + detail', async () => {
      const list = await request('GET', '/transactions?limit=5', { token: tokenP });
      expectStatus(list, 200);
      const detail = await request('GET', `/transactions/${tempTransactionCode}`, { token: tokenP });
      expectStatus(detail, 200);
    });

    await step('Transaksi stok berlebih → 422', async () => {
      expectStatus(await request('POST', '/transactions', {
        token: tokenP, body: { items: [{ productId: tempProductId, qty: 99999 }] },
      }), 422);
    });

    await step('Retur item parsial mengembalikan stok dan recalc total', async () => {
      const [[before]] = await db.execute('SELECT stock FROM products WHERE id = ?', [tempProductId]);
      const stockBefore = Number(before.stock);

      const ret = await request('DELETE', `/transactions/${tempTransactionCode}/items/${tempProductId}`, {
        token: tokenP,
        body: { quantity: 1, reason: 'Smoke test retur parsial' },
      });
      expectStatus(ret, 200);
      assert.equal(ret.data.data.transactionId, tempTransactionCode);
      assert.equal(ret.data.data.itemId, String(tempProductId));
      assert.equal(ret.data.data.returnedQty, 1);
      assert.equal(ret.data.data.voided, false);
      assert.equal(ret.data.data.transaction.totalPenjualan, 2200);
      assert.equal(ret.data.data.transaction.keuntungan, 1000);
      assert.equal(ret.data.message, 'Item berhasil diretur.');

      const [[after]] = await db.execute('SELECT stock FROM products WHERE id = ?', [tempProductId]);
      assert.equal(Number(after.stock), stockBefore + 1);

      const detail = await request('GET', `/transactions/${tempTransactionCode}`, { token: tokenP });
      expectStatus(detail, 200);
      assert.equal(detail.data.data.totalPenjualan, 2200);
      assert.equal(detail.data.data.items[0].qty, 1);
    });

    await step('Retur item terakhir mem-void transaksi (soft delete)', async () => {
      const [[before]] = await db.execute('SELECT stock FROM products WHERE id = ?', [tempProductId]);
      const stockBefore = Number(before.stock);

      const ret = await request('DELETE', `/transactions/${tempTransactionCode}/items/${tempProductId}`, {
        token: tokenP,
        body: { reason: 'Smoke test retur terakhir' },
      });
      expectStatus(ret, 200);
      assert.equal(ret.data.data.voided, true);
      assert.equal(ret.data.data.transaction, null);
      assert.equal(ret.data.message, 'Item terakhir diretur, transaksi dihapus.');

      const [[after]] = await db.execute('SELECT stock FROM products WHERE id = ?', [tempProductId]);
      assert.equal(Number(after.stock), stockBefore + 1);

      expectStatus(await request('GET', `/transactions/${tempTransactionCode}`, { token: tokenP }), 404);
    });

    await step('Hapus/void seluruh transaksi (Pemilik)', async () => {
      const created = await request('POST', '/transactions', {
        token: tokenK,
        body: { items: [{ productId: tempProductId, qty: 1 }] },
      });
      expectStatus(created, 201);
      tempVoidTransactionCode = created.data.data.id;

      const [[before]] = await db.execute('SELECT stock FROM products WHERE id = ?', [tempProductId]);
      const stockBefore = Number(before.stock);

      const del = await request('DELETE', `/transactions/${tempVoidTransactionCode}`, {
        token: tokenP,
        body: { reason: 'Smoke test void transaksi' },
      });
      expectStatus(del, 200);
      assert.equal(del.data.data.transactionId, tempVoidTransactionCode);
      assert.equal(del.data.data.voided, true);
      assert.equal(del.data.message, 'Transaksi berhasil dihapus.');

      const [[after]] = await db.execute('SELECT stock FROM products WHERE id = ?', [tempProductId]);
      assert.equal(Number(after.stock), stockBefore + 1);
      expectStatus(await request('GET', `/transactions/${tempVoidTransactionCode}`, { token: tokenP }), 404);
    });

    await step('Retur/hapus transaksi ditolak untuk Karyawan → 403', async () => {
      expectStatus(
        await request('DELETE', `/transactions/${tempVoidTransactionCode}`, { token: tokenK }),
        403
      );
      expectStatus(
        await request('DELETE', `/transactions/${tempVoidTransactionCode}/items/${tempProductId}`, { token: tokenK }),
        403
      );
    });

    await step('Retur/hapus transaksi tidak ditemukan → 404', async () => {
      expectStatus(await request('DELETE', '/transactions/TRX-TIDAK-ADA', { token: tokenP }), 404);
      expectStatus(
        await request('DELETE', `/transactions/${tempVoidTransactionCode}/items/999999`, { token: tokenP }),
        404
      );
    });

    await step('Validasi retur transaksi → 422', async () => {
      const created = await request('POST', '/transactions', {
        token: tokenK,
        body: { items: [{ productId: tempProductId, qty: 1 }] },
      });
      expectStatus(created, 201);
      const trx = created.data.data.id;

      expectStatus(
        await request('DELETE', `/transactions/${trx}/items/${tempProductId}`, {
          token: tokenP,
          body: { quantity: 99 },
        }),
        422
      );
      expectStatus(
        await request('DELETE', `/transactions/${trx}`, {
          token: tokenP,
          body: { reason: 'x'.repeat(201) },
        }),
        422
      );

      // cleanup tx ini lewat void valid lalu hapus row uji
      expectStatus(await request('DELETE', `/transactions/${trx}`, { token: tokenP, body: { reason: 'cleanup' } }), 200);
      await db.execute('DELETE FROM transaction_audits WHERE transaction_id = (SELECT id FROM transactions WHERE transaction_code = ?)', [trx]);
      await db.execute('DELETE FROM transaction_items WHERE transaction_id = (SELECT id FROM transactions WHERE transaction_code = ?)', [trx]);
      await db.execute('DELETE FROM transactions WHERE transaction_code = ?', [trx]);
    });

    // --- DASHBOARD & ANALYTICS ---
    const month = new Date().toISOString().slice(0, 7);
    await step('GET /dashboard summary, trend, report', async () => {
      expectStatus(await request('GET', `/dashboard/summary?month=${month}`, { token: tokenP }), 200);
      expectStatus(await request('GET', `/dashboard/trend?month=${month}`, { token: tokenP }), 200);
      expectStatus(await request('GET', `/dashboard/report?month=${month}`, { token: tokenP }), 200);
    });

    await step('Karyawan dilarang akses dashboard → 403', async () => {
      expectStatus(await request('GET', '/dashboard/summary', { token: tokenK }), 403);
    });

    await step('GET /analytics/insights', async () => {
      const res = await request('GET', `/analytics/insights?month=${month}`, { token: tokenP });
      expectStatus(res, 200);
      assert.equal(res.data.data.insights.length, 3);
    });

    // --- AI ---
    await step('Catat baseline chat untuk cleanup', async () => {
      const [rows] = await db.execute(
        `SELECT COALESCE(MAX(m.id), 0) AS max_id
         FROM ai_messages m
         JOIN ai_conversations c ON c.id = m.conversation_id
         WHERE c.user_id = 1`
      );
      chatBaselineId = Number(rows[0].max_id);
    });

    await step('AI history & chat', async () => {
      expectStatus(await request('GET', '/ai/chat/history', { token: tokenP }), 200);
      const res = await request('POST', '/ai/chat', {
        token: tokenP, body: { message: 'Berapa keuntungan bulan ini?' },
      });
      expectStatus(res, 200);
      assert.equal(res.data.data.role, 'assistant');
    });

    await step('AI pesan kosong → 422', async () => {
      expectStatus(await request('POST', '/ai/chat', {
        token: tokenP, body: { message: '' },
      }), 422);
    });

    // --- SETTINGS & NOTIFIKASI ---
    await step('GET/PUT /settings/store', async () => {
      const get = await request('GET', '/settings/store', { token: tokenP });
      expectStatus(get, 200);
      const store = get.data.data;
      const put = await request('PUT', '/settings/store', {
        token: tokenP,
        body: {
          nama: store.nama, alamat: store.alamat, telepon: store.telepon,
          whatsapp: store.whatsapp, footerStruk: store.footerStruk,
          jamOperasional: store.jamOperasional,
        },
      });
      expectStatus(put, 200);
    });

    await step('GET /notifications & tandai dibaca', async () => {
      expectStatus(await request('GET', '/notifications', { token: tokenP }), 200);
      expectStatus(await request('POST', '/notifications/read-all', { token: tokenP }), 200);
    });

    // --- ERROR HANDLING ---
    await step('Endpoint tidak ada → 404 JSON', async () => {
      const res = await request('GET', '/tidak-ada');
      expectStatus(res, 404);
      assert.equal(res.data.success, false);
    });

    await step('JSON rusak → 400 JSON', async () => {
      const res = await request('POST', '/auth/login', { rawBody: '{ "email": ' });
      expectStatus(res, 400);
      assert.equal(res.data.success, false);
    });

    await step('Tanpa token → 401 JSON', async () => {
      expectStatus(await request('GET', '/products'), 401);
    });
  } finally {
    // --- CLEANUP ---
    for (const code of [tempTransactionCode, tempVoidTransactionCode]) {
      if (!code) continue;
      await db.execute(
        'DELETE FROM transaction_audits WHERE transaction_id = (SELECT id FROM transactions WHERE transaction_code = ?)',
        [code]
      );
      await db.execute(
        'DELETE FROM transaction_items WHERE transaction_id = (SELECT id FROM transactions WHERE transaction_code = ?)',
        [code]
      );
      await db.execute('DELETE FROM transactions WHERE transaction_code = ?', [code]);
    }
    // Bersihkan transaksi uji lain yang mungkin tertinggal (prefix TRX- dari smoke test create).
    // Tidak dilakukan agresif; test di atas sudah cleanup eksplisit.
    if (tempProductId) {
      await db.execute('DELETE FROM products WHERE id = ?', [tempProductId]);
    }
    if (chatBaselineId) {
      await db.execute(
        'DELETE FROM ai_messages WHERE id > ? AND conversation_id IN (SELECT id FROM ai_conversations WHERE user_id = 1)',
        [chatBaselineId]
      );
    }
    await db.execute('UPDATE notifications SET is_read = 0, read_at = NULL WHERE user_id = 1');
    await db.end();
  }

  console.log(`\nHasil: ${passed} lolos, ${failed} gagal\n`);
  process.exit(failed ? 1 : 0);
})();
