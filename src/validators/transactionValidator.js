const Joi = require('joi');

const transactionSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        productId: Joi.alternatives().try(Joi.string(), Joi.number()).required().messages({
          'any.required': 'ProductId wajib diisi.',
        }),
        qty: Joi.number().integer().positive().required().messages({
          'number.base': 'Jumlah harus berupa angka.',
          'number.integer': 'Jumlah harus bilangan bulat.',
          'number.positive': 'Jumlah harus minimal 1.',
          'any.required': 'Jumlah wajib diisi.',
        }),
      })
    )
    .min(1)
    .required()
    .messages({
      'array.min': 'Pilih minimal satu produk untuk disimpan.',
      'any.required': 'Pilih minimal satu produk untuk disimpan.',
    }),
});

// Validasi payload transaksi. Frontend hanya mengirim productId + qty.
// Harga modal/jual diambil dari server.

const validateTransaction = (payload) => {
  const { error, value } = transactionSchema.validate(payload || {}, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (!error) return { value };

  const errors = {};
  error.details.forEach((detail) => {
    const field = detail.path.length ? detail.path.join('.') : 'items';
    if (!errors[field]) errors[field] = detail.message;
  });

  return { error: errors };
};

module.exports = { validateTransaction };
