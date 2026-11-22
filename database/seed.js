/**
 * Seed akun awal agar endpoint login bisa diuji.
 * Jalankan: npm run seed
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../src/config/database');

const users = [
  { name: 'Dini Ayu Lestari', email: 'pemilik@marindal.id', password: 'pemilik123', role: 'Pemilik' },
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
  await db.end();
};

seed().catch((error) => {
  console.error('Gagal seed users:', error.message);
  process.exit(1);
});
