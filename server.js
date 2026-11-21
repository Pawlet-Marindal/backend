
require("dotenv").config();

const app = require("./src/app");
const db = require("./src/config/database");

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Test koneksi database
    const connection = await db.getConnection();

    console.log("MySQL berhasil terhubung!");

    connection.release();

    // Jalankan Express
    app.listen(PORT, () => {
      console.log("--------------------------------");
      console.log("Pawlet Backend");
      console.log(`Server berjalan di port ${PORT}`);
      console.log(`URL: http://localhost:${PORT}`);
      console.log("--------------------------------");
    });
  } catch (error) {
    console.error("Gagal menjalankan server:");

    console.error(error.message);

    process.exit(1);
  }
}

startServer();

