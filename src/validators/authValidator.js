const Joi = require('joi');

const loginSchema = Joi.object({
  email: Joi.string()
    .trim()
    .email()
    .required()
    .messages({
      'string.empty': 'Email wajib diisi.',
      'string.email': 'Format email tidak valid.',
      'any.required': 'Email wajib diisi.',
    }),
  password: Joi.string().trim().required().messages({
    'string.empty': 'Password wajib diisi.',
    'any.required': 'Password wajib diisi.',
  }),
});


// Validasi body login.
// returns { value } jika valid, { error } berupa map { field: pesan } jika gagal.

const validateLogin = (payload) => {
  const { error, value } = loginSchema.validate(payload || {}, {
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

module.exports = { validateLogin };
