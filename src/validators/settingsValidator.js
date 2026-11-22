const Joi = require('joi');

const phone = Joi.string()
  .pattern(/^[0-9+\-\s()]{6,20}$/)
  .allow('', null)
  .messages({ 'string.pattern.base': 'Nomor telepon tidak valid.' });

const storeSchema = Joi.object({
  nama: Joi.string().trim().min(2).max(150).required().messages({
    'string.empty': 'Nama toko wajib diisi.',
    'any.required': 'Nama toko wajib diisi.',
  }),
  alamat: Joi.string().trim().allow('', null).optional(),
  telepon: phone.optional().messages({ 'string.pattern.base': 'Nomor telepon tidak valid.' }),
  whatsapp: phone.optional().messages({ 'string.pattern.base': 'Nomor WhatsApp tidak valid.' }),
  footerStruk: Joi.string().trim().allow('', null).optional(),
  catatanStruk: Joi.string().trim().allow('', null).optional(),
  jamOperasional: Joi.string().trim().allow('', null).optional(),
});

const passwordSchema = Joi.object({
  passwordLama: Joi.string().required().messages({
    'any.required': 'Password lama wajib diisi.',
  }),
  passwordBaru: Joi.string().min(6).required().messages({
    'string.min': 'Password baru minimal 6 karakter.',
    'any.required': 'Password baru wajib diisi.',
  }),
});

const validate = (schema, payload) => {
  const { error, value } = schema.validate(payload || {}, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (!error) return { value };

  const errors = {};
  error.details.forEach((detail) => {
    const field = detail.path[0] || 'body';
    if (!errors[field]) errors[field] = detail.message;
  });

  return { error: errors };
};

module.exports = {
  validateStore: (payload) => validate(storeSchema, payload),
  validatePassword: (payload) => validate(passwordSchema, payload),
};
