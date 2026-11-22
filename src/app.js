const express = require("express");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/product");

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

// Route tidak ditemukan
app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: "Endpoint tidak ditemukan.",
  });
});

module.exports = app;

