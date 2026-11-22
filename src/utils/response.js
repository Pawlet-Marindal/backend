// Helper envelope response standar API Pawlet.
// Wajib pakai agar bentuk JSON konsisten dengan kontrak.

const success = (res, data, statusCode = 200, meta) => {
  return res.status(statusCode).json({
    success: true,
    data,
    ...(meta ? { meta } : {}),
  });
};

const fail = (res, statusCode, message, errors) => {
  return res.status(statusCode).json({
    success: false,
    message,
    ...(errors ? { errors } : {}),
  });
};

module.exports = { success, fail };
