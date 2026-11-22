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

const reasonSchema = Joi.string().trim().max(200).allow('', null).messages({
  'string.max': 'Alasan maksimal 200 karakter.',
  'string.base': 'Alasan harus berupa teks.',
});

const voidTransactionSchema = Joi.object({
  reason: reasonSchema,
});

const returnItemSchema = Joi.object({
  quantity: Joi.number().integer().positive().messages({
    'number.base': 'Jumlah retur harus bilangan bulat.',
    'number.integer': 'Jumlah retur harus bilangan bulat.',
    'number.positive': 'Jumlah retur harus minimal 1.',
  }),
  reason: reasonSchema,
});

const formatJoiError = (error, fallbackField = 'items') => {
  const errors = {};
  error.details.forEach((detail) => {
    const field = detail.path.length ? detail.path.join('.') : fallbackField;
    if (!errors[field]) errors[field] = detail.message;
  });
  return errors;
};

// Validasi payload transaksi. Frontend hanya mengirim productId + qty.
// Harga modal/jual diambil dari server.

const validateTransaction = (payload) => {
  const { error, value } = transactionSchema.validate(payload || {}, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (!error) return { value };
  return { error: formatJoiError(error) };
};

const validateVoidTransaction = (payload) => {
  const { error, value } = voidTransactionSchema.validate(payload || {}, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (!error) return { value };
  return { error: formatJoiError(error, 'reason') };
};

const validateReturnItem = (payload) => {
  const { error, value } = returnItemSchema.validate(payload || {}, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (!error) return { value };
  return { error: formatJoiError(error, 'quantity') };
};

module.exports = { validateTransaction, validateVoidTransaction, validateReturnItem };
