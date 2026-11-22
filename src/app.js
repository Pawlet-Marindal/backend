const express = require("express");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/product");
const transactionRoutes = require("./routes/transaction");
const dashboardRoutes = require("./routes/dashboard");
const analyticsRoutes = require("./routes/analytics");
const aiRoutes = require("./routes/ai");
const settingsRoutes = require("./routes/settings");
const notificationRoutes = require("./routes/notification");
const userAliasRoutes = require("./routes/userAlias");

const app = express();

// Middleware CORS
app.use( cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);

// Middleware JSON
app.use(express.json());

// Middleware URL encoded
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/api/v1/health", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Pawlet API berjalan baik.",
    data: {
      status: "OK",
      environment: process.env.NODE_ENV,
    },
  });
});

// Routes API v1
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/transactions", transactionRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/analytics", analyticsRoutes);
app.use("/api/v1/ai", aiRoutes);
app.use("/api/v1/settings", settingsRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/users", userAliasRoutes);

// Route tidak ditemukan
app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: "Endpoint tidak ditemukan.",
  });
});

module.exports = app;

