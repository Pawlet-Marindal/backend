# Pawlet Backend — API Marindal Petshop POS

Back-End REST API untuk aplikasi Pawlet (Marindal Petshop POS). Dibangun dengan **Express + MySQL + JWT + Joi**.

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

## 3. Cara Menjalankan

### Prasyarat
- Node.js dan npm sudah terpasang
- MySQL/MariaDB sudah berjalan
- Akses database 

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

**3. Siapkan database**
```bash
mysql -u <user> -p < database/schema.sql
```

**4. Isi data awal (development)**
```bash
npm run seed
```
Seeder membuat akun, produk, dan notifikasi contoh.

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
| DELETE | `/transactions/:id` | Ya | Pemilik |
| DELETE | `/transactions/:id/items/:itemId` | Ya | Pemilik |

Filter: `month` (`YYYY-MM`), `employeeId`, `search`, `page`, `limit`. Body retur opsional: `{ "reason": "...", "quantity": 1 }` (`quantity` hanya untuk retur item; kosong = retur seluruh qty item).

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
3. **Retur/void transaksi bersifat soft-delete** — transaksi tidak di-hard-delete; status diubah `voided`, stok dikembalikan, total dihitung ulang dari snapshot item, dan jejak audit dicatat di `transaction_audits`. Transaksi voided disembunyikan dari list/detail/dashboard/laporan/analytics/AI.
4. **Bulan kosong mengembalikan angka `0`**, bukan `null`.
5. **Tren harian** memakai `null` untuk tanggal tanpa transaksi.
6. **Validasi Joi** dipakai pada semua input; error dikembalikan sebagai objek `errors` per field.
7. **Front-End tidak pernah memanggil provider AI langsung** — semua lewat `/api/v1/ai/chat`. Jika `AI_SERVICE_URL` diisi dan layanan gagal/timeout, server balas `503`.

---

## 9. Prinsip Keamanan

- Simpan secret hanya di `.env` lokal; gunakan nilai acak yang kuat untuk `JWT_SECRET`.
- Jangan pernah menaruh password, token, atau kunci API di README, komentar kode, atau git.
- `.env` sudah diabaikan git — jangan dipaksa commit.
- Batasi CORS hanya ke domain front-end yang diperlukan.
- Jangan jalankan seeder di production; akun contoh memiliki password bawaan.
- Semua permintaan ke layanan AI / Data Science harus lewat server ini.
