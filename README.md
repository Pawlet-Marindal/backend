# Pawlet Backend — API Marindal Petshop POS

Back-End REST API untuk aplikasi Pawlet (Marindal Petshop POS). Dibangun dengan **Express + MySQL + JWT + Joi**.

Front-End: `pawlet-fe-prototype` (React + Vite). Kontrak API: `API_CONTRACT.md` di repo front-end.

> **Catatan keamanan:** README ini sengaja tidak memuat kredensial, token, password, maupun nilai variabel rahasia. Semua nilai sensitif hanya ada di file `.env` lokal (tidak di-commit) dan dikelola oleh tim.

---

## 1. Teknologi yang Dipakai

| Kebutuhan | Library |
|-----------|---------|
| Server HTTP | Express 5 |
| Database | MySQL / MariaDB (`mysql2/promise`) |
| Autentikasi | JSON Web Token (`jsonwebtoken`) |
| Hash password | `bcryptjs` |
| Validasi input | Joi |
| CORS | `cors` |
| Environment | `dotenv` |
| Dev reload | `nodemon` |

---

## 2. Struktur Folder

```
pawlet-be/
├── database/
│   ├── schema.sql                  # struktur tabel (install fresh)
│   ├── migrations/                 # perubahan schema untuk DB yang sudah ada
│   └── seed.js                     # data awal untuk development
├── src/
│   ├── config/database.js          # koneksi MySQL pool
│   ├── controllers/                # logika tiap endpoint
│   ├── middleware/
│   │   ├── auth.js                 # verifikasi JWT
│   │   ├── rbac.js                 # pembatasan role
│   │   └── errorHandler.js         # error global + 404 JSON
│   ├── routes/                     # daftar endpoint
│   ├── utils/
│   │   ├── period.js               # helper rentang bulan
│   │   └── response.js             # envelope response standar
│   ├── validators/                 # skema Joi
│   └── app.js                      # inisialisasi Express
├── tests/smoke.js                  # uji seluruh endpoint
├── server.js                       # entry point
└── .env.example                    # contoh nama variabel (tanpa nilai asli)
```

---

## 3. Cara Menjalankan (Untuk Junior)

### Prasyarat
- Node.js dan npm sudah terpasang
- MySQL/MariaDB sudah berjalan
- Akses database diberikan oleh tim (jangan minta password lewat chat publik)

### Langkah

**1. Install dependency**
```bash
npm install
```

**2. Siapkan file `.env`**
```bash
cp .env.example .env
```
Lalu isi nilai variabel sesuai lingkunganmu. **Jangan pernah commit `.env`** — sudah masuk `.gitignore`.

Nama variabel yang dipakai:

| Variabel | Fungsi |
|----------|--------|
| `PORT` | Port server |
| `NODE_ENV` | Mode lingkungan |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Koneksi database |
| `DB_SSL`, `DB_SSL_CA` | *(opsional)* TLS untuk database hosted; isi `DB_SSL_CA` bila provider memberi CA |
| `JWT_SECRET` | Kunci penandatanganan token (rahasia) |
| `JWT_EXPIRES_IN` | Masa berlaku token |
| `CLIENT_URL` | Asal request front-end yang diizinkan CORS |
| `AI_SERVICE_URL` | *(opsional)* alamat layanan AI; kosongkan untuk pakai jawaban lokal |

**3. Siapkan database**
```bash
mysql -u <user> -p < database/schema.sql
mysql -u <user> -p <nama_db> < database/migrations/001_settings_columns.sql
```
> Untuk database yang dibuat dari `schema.sql` versi terbaru, migrasi di atas biasanya tidak diperlukan.

**4. Isi data awal (development)**
```bash
npm run seed
```
Seeder membuat akun, produk, dan notifikasi contoh. Kredensialnya dikelola tim — **jangan ditulis di README atau dokumen publik**.

> **Production:** jangan jalankan seeder. Akun contoh memiliki password bawaan yang diketahui tim.

**5. Jalankan server**
```bash
npm run dev
```
Server aktif di `http://localhost:5000` (health check: `/api/v1/health`).

---

## 4. Script npm

| Script | Fungsi |
|--------|--------|
| `npm start` | Jalankan server biasa |
| `npm run dev` | Jalankan server dengan auto-reload |
| `npm run seed` | Isi ulang data awal development |
| `npm test` | Jalankan smoke test seluruh endpoint |
| `npm run test:netlify` | Uji wrapper Netlify Function (tanpa database) |

Smoke test butuh server aktif. Test ini membersihkan data uji yang dibuatnya sendiri. `test:netlify` hanya memanggil `/health`, jadi bisa jalan tanpa database.

---

## 5. Aturan Response

Semua endpoint memakai envelope yang sama.

**Sukses**
```json
{
  "success": true,
  "data": {},
  "meta": { "page": 1, "limit": 10, "total": 45, "totalPages": 5 }
}
```
`meta` hanya ada pada endpoint berpaginasi.

**Gagal**
```json
{
  "success": false,
  "message": "Pesan kesalahan dalam Bahasa Indonesia.",
  "errors": { "namaField": "Keterangan validasi field." }
}
```

Error tak terduga, JSON rusak, dan endpoint tidak ditemukan juga tetap balas JSON.

---

## 6. Autentikasi & Hak Akses

- Kirim header: `Authorization: Bearer <token>`
- Token didapat dari endpoint login.
- Dua role:
  - **Pemilik** — akses penuh (produk, laporan, analytics, pengaturan toko)
  - **Karyawan** — kasir, riwayat transaksi, lihat produk, lihat notifikasi, ganti password sendiri

Endpoint yang butuh token akan balas `401` jika token tidak ada/tidak valid, dan `403` jika role tidak sesuai.

---

## 7. Daftar Endpoint

Base URL: `/api/v1`

### Autentikasi
| Method | Endpoint | Token | Role |
|--------|----------|-------|------|
| POST | `/auth/login` | Tidak | Semua |
| GET | `/auth/me` | Ya | Semua |
| POST | `/auth/logout` | Ya | Semua |

### Produk
| Method | Endpoint | Token | Role |
|--------|----------|-------|------|
| GET | `/products` | Ya | Semua |
| GET | `/products/summary` | Ya | Semua |
| GET | `/products/categories` | Ya | Semua |
| POST | `/products` | Ya | Pemilik |
| PUT | `/products/:id` | Ya | Pemilik |
| DELETE | `/products/:id` | Ya | Pemilik |
| POST | `/products/bulk-delete` | Ya | Pemilik |

Query yang didukung: `page`, `limit` (atau `all`), `search`, `category` / `kategori`.

### Transaksi
| Method | Endpoint | Token | Role |
|--------|----------|-------|------|
| POST | `/transactions` | Ya | Semua |
| GET | `/transactions` | Ya | Semua |
| GET | `/transactions/:id` | Ya | Semua |

Filter: `month` (`YYYY-MM`), `employeeId`, `search`, `page`, `limit`.

### Dashboard & Laporan
| Method | Endpoint | Token | Role |
|--------|----------|-------|------|
| GET | `/dashboard/summary?month=YYYY-MM` | Ya | Pemilik |
| GET | `/dashboard/trend?month=YYYY-MM` | Ya | Pemilik |
| GET | `/dashboard/report?month=YYYY-MM` | Ya | Pemilik |

### Analytics & AI
| Method | Endpoint | Token | Role |
|--------|----------|-------|------|
| GET | `/analytics/insights?month=YYYY-MM` | Ya | Pemilik |
| GET | `/ai/chat/history` | Ya | Semua |
| POST | `/ai/chat` | Ya | Semua |

### Pengaturan & Notifikasi
| Method | Endpoint | Token | Role |
|--------|----------|-------|------|
| GET | `/settings/store` | Ya | Semua |
| PUT | `/settings/store` | Ya | Pemilik |
| PUT | `/settings/password` | Ya | Semua |
| PUT | `/users/me/password` | Ya | Semua *(alias front-end)* |
| GET | `/notifications` | Ya | Semua |
| POST | `/notifications/read-all` | Ya | Semua |
| POST | `/notifications/:id/read` | Ya | Semua |

---

## 8. Aturan Penting yang Sering Terlewat

1. **Snapshot harga transaksi** — front-end hanya mengirim `productId` dan `qty`. Server mengambil `hargaModal` dan `hargaJual` dari database lalu menyimpannya sebagai snapshot. Riwayat keuntungan tidak berubah kalau harga produk diedit kemudian.
2. **Stok otomatis berkurang** saat transaksi berhasil. Transaksi memakai database transaction agar stok dan struk konsisten.
3. **Bulan kosong mengembalikan angka `0`**, bukan `null`.
4. **Tren harian** memakai `null` untuk tanggal tanpa transaksi.
5. **Validasi Joi** dipakai pada semua input; error dikembalikan sebagai objek `errors` per field.
6. **Front-End tidak pernah memanggil provider AI langsung** — semua lewat `/api/v1/ai/chat`. Jika `AI_SERVICE_URL` diisi dan layanan gagal/timeout, server balas `503`.

---

## 9. Integrasi Front-End (yang akan datang)

Di repo `pawlet-fe-prototype`, set file `.env`:

```env
VITE_API_BASE_URL=http://localhost:5000/api/v1
VITE_USE_MOCK=false
```

Lalu restart Vite. Sebelum itu, pastikan endpoint `GET/PUT /users/me` sudah tersedia jika halaman profil memakai fitur tersebut.

---

## 10. Deploy ke Netlify Functions

Backend ini **sengaja dipaksa berjalan sebagai Netlify Function** memakai `serverless-http`. Jadi tidak ada proses Express yang listen terus di port tertentu di production.

### File pendukung

| File | Fungsi |
|------|--------|
| `netlify.toml` | Functions dir, publish dir, versi Node, redirect `/api/v1/*` |
| `netlify/functions/api.js` | Bungkus Express dengan `serverless-http` + normalisasi path |
| `public/index.html` | Halaman statis placeholder; bukan aplikasi utama |

### Prasyarat

- Database MySQL/MariaDB **external** yang bisa diakses dari internet. Netlify tidak menyediakan MySQL lokal.
- Import `database/schema.sql`. Untuk database lama, jalankan migrasi di `database/migrations/`.
- **Jangan jalankan `npm run seed` di production.**

### Langkah deploy

1. Commit & push repo `pawlet-be` ke GitHub. Pastikan `.env` tidak ikut ter-commit.
2. Di Netlify: **Add new site → Import from GitHub**, pilih repo tersebut.
3. Karena `netlify.toml` sudah ada, Netlify otomatis memakai:
   - Functions directory: `netlify/functions`
   - Publish directory: `public`
   - Node: `22` (juga tercantum di `.nvmrc`)
   - Redirect: `/api/v1/*` → Function `api`
   - Build command: kosongkan (repo ini tidak membangun frontend)
4. Isi **Environment Variables** di Netlify Dashboard. Hanya nama yang tercantum di sini; nilai aslinya dikelola tim:

   | Variabel | Catatan |
   |----------|---------|
   | `NODE_ENV` | `production` |
   | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Koneksi DB external |
   | `DB_SSL` | Aktifkan TLS bila diwajibkan provider DB |
   | `DB_SSL_CA` | Isi bila provider memberi sertifikat CA |
   | `JWT_SECRET` | Nilai acak kuat; jangan pernah ditulis di README |
   | `JWT_EXPIRES_IN` | Masa berlaku token |
   | `CLIENT_URL` | URL frontend Netlify yang diizinkan CORS |
   | `AI_SERVICE_URL` | Opsional; kosongkan untuk jawaban AI lokal |

5. Deploy.
6. Cek health check: `https://<NAMA-SITE>.netlify.app/api/v1/health`. Respons harus `success: true`.

### Frontend setelah backend live

Di repo `pawlet-fe-prototype`, isi `.env`:

```env
VITE_API_BASE_URL=https://<NAMA-SITE-BACKEND>.netlify.app/api/v1
VITE_USE_MOCK=false
```

Lalu set `CLIENT_URL` di backend dengan URL frontend Netlify, lalu redeploy kedua-duanya.

### Uji wrapper lokal

```bash
npm run test:netlify
```

Ini menyimulasikan event REST dan HTTP API v2, lalu memastikan path seperti `/.netlify/functions/api/health` tetap sampai ke route Express `/api/v1/health`.

### Catatan serverless

- Function punya **cold start** dan batas waktu eksekusi; cocok untuk request API pendek, bukan job panjang.
- Pool database dibuat sekali per container Function dan dipakai ulang antar request.
- Path di-normalisasi di wrapper, jadi route di `src/app.js` tidak perlu diubah.
- CORS tetap diatur Express lewat `CLIENT_URL`.

---

## 11. Masalah Umum

| Gejala | Penyebab mungkin | Solusi |
|--------|------------------|--------|
| Server gagal start | Koneksi DB salah | Periksa variabel DB di `.env` |
| `401` terus | Token tidak dikirim / kedaluwarsa | Login ulang, cek header Authorization |
| `403` | Role tidak sesuai | Pakai akun dengan role yang sesuai |
| `422` | Validasi gagal | Baca objek `errors` di response |
| Kolom `whatsapp` tidak ada | DB lama belum dimigrasi | Jalankan file migrasi di `database/migrations/` |
| `503` saat chat | Layanan AI tidak merespons | Periksa `AI_SERVICE_URL` atau kosongkan untuk pakai jawaban lokal |
| `404` setelah deploy | Redirect belum aktif / path bukan `/api/v1/...` | Cek `netlify.toml`, pastikan awalan `/api/v1/` |
| Error koneksi DB di Function | Env DB salah atau TLS belum sesuai | Cek variabel DB, `DB_SSL`, dan `DB_SSL_CA` di Netlify |
| CORS error di browser | `CLIENT_URL` belum sama dengan domain frontend | Samakan dengan URL frontend Netlify, lalu redeploy |

---

## 12. Prinsip Keamanan

- Simpan secret hanya di `.env` lokal; gunakan nilai acak yang kuat untuk `JWT_SECRET`.
- Jangan pernah menaruh password, token, atau kunci API di README, komentar kode, atau git.
- `.env` sudah diabaikan git — jangan dipaksa commit.
- Batasi CORS hanya ke domain front-end yang diperlukan.
- Jangan jalankan seeder di production; akun contoh memiliki password bawaan.
- Semua permintaan ke layanan AI / Data Science harus lewat server ini.
