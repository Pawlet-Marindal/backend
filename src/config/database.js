const mysql = require("mysql2/promise");
require("dotenv").config();

const config = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,

  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
};

// SSL => true | false 
if (String(process.env.DB_SSL || "").toLowerCase() === "true") {
  config.ssl = process.env.DB_SSL_CA
    ? { ca: process.env.DB_SSL_CA.replace(/\\n/g, "\n") }
    : {};
}

const pool = mysql.createPool(config);

module.exports = pool;
