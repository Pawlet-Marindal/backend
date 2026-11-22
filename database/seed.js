/**
 * Seed akun awal & produk agar endpoint bisa diuji.
 * Jalankan: npm run seed
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../src/config/database');

const users = [
  { name: 'Tiara Nurin Zahirah', email: 'pemilik@marindal.id', password: 'pemilik123', role: 'Pemilik' },
  { name: 'Rizky Pratama', email: 'karyawan@marindal.id', password: 'karyawan123', role: 'Karyawan' },
  { name: 'Putri Maharani', email: 'putri@marindal.id', password: 'putri12345', role: 'Karyawan' },
  { name: 'Andi Saputra', email: 'andi@marindal.id', password: 'andi123456', role: 'Karyawan', isActive: false },
];

const seed = async () => {
  for (const user of users) {
    const passwordHash = await bcrypt.hash(user.password, 10);

    await db.execute(
      `INSERT INTO users (name, email, password_hash, role, is_active)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         password_hash = VALUES(password_hash),
         role = VALUES(role),
         is_active = VALUES(is_active)`,
      [
        user.name,
        user.email,
        passwordHash,
        user.role,
        user.isActive === false ? 0 : 1,
      ]
    );
  }

  console.log('Seed users selesai.');

  // [sku, nama, kategori, hargaModal, hargaJual, stok]
  const products = [
    ['PRD-001', 'Whiskas Tuna Salmon', 'Makanan Kucing', 52000, 62000, 50],
    ['PRD-002', 'Whiskas Adult Ocean Fish 1,1 kg', 'Makanan Kucing', 48000, 58000, 40],
    ['PRD-003', 'Royal Canin Kitten 2 kg', 'Makanan Kucing', 215000, 245000, 18],
    ['PRD-004', 'Me-O Creamy Treats', 'Makanan Kucing', 3500, 5000, 120],
    ['PRD-005', 'Pasir Gumpal Bentonite 10L', 'Perawatan Kucing', 42000, 55000, 30],
    ['PRD-006', 'Royal Canin Maxi Adult 4kg', 'Makanan Anjing', 310000, 385000, 15],
  ];

  for (const [sku, name, category, costPrice, sellingPrice, stock] of products) {
    await db.execute(
      `INSERT INTO products (sku, name, category, cost_price, selling_price, stock)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         category = VALUES(category),
         cost_price = VALUES(cost_price),
         selling_price = VALUES(selling_price),
         stock = VALUES(stock)`,
      [sku, name, category, costPrice, sellingPrice, stock]
    );
  }

  console.log('Seed produk selesai.');
  await db.end();
};

seed().catch((error) => {
  console.error('Gagal seed users:', error.message);
  process.exit(1);
});
