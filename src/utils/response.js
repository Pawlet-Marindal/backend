// Helper envelope response standar API Pawlet.
// Wajib pakai agar bentuk JSON konsisten dengan kontrak.

const success = (res, data, statusCode = 200, options) => {
  const extra =
    options && typeof options === 'object' && (Object.hasOwn(options, 'meta') || Object.hasOwn(options, 'message'))
      ? options
      : options
        ? { meta: options }
        : {};

  return res.status(statusCode).json({
    success: true,
    data,
    ...(extra.meta ? { meta: extra.meta } : {}),
    ...(extra.message ? { message: extra.message } : {}),
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
