const Joi = require('joi');

const messageSchema = Joi.object({
  message: Joi.string().trim().min(1).max(500).required().messages({
    'string.empty': 'Pesan tidak boleh kosong.',
    'string.max': 'Pesan maksimal 500 karakter.',
    'any.required': 'Pesan tidak boleh kosong.',
  }),
});

const validateMessage = (payload) => {
  const { error, value } = messageSchema.validate(payload || {}, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (!error) return { value };

  const errors = {};
  error.details.forEach((detail) => {
    const field = detail.path[0] || 'message';
    if (!errors[field]) errors[field] = detail.message;
  });

  return { error: errors };
};

module.exports = { validateMessage };
