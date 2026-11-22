const Joi = require('joi');

const productSchema = Joi.object({
  nama: Joi.string().trim().min(2).max(100).required().messages({
    'string.empty': 'Nama wajib diisi.',
    'string.min': 'Nama minimal 2 karakter.',
    'string.max': 'Nama maksimal 100 karakter.',
    'any.required': 'Nama wajib diisi.',
  }),
  kategori: Joi.string().trim().required().messages({
    'string.empty': 'Kategori wajib diisi.',
    'any.required': 'Kategori wajib diisi.',
  }),
  hargaModal: Joi.number().positive().required().messages({
    'number.base': 'Harga modal harus berupa angka.',
    'number.positive': 'Harga modal harus lebih dari 0.',
    'any.required': 'Harga modal wajib diisi.',
  }),
  hargaJual: Joi.number().positive().required().messages({
    'number.base': 'Harga jual harus berupa angka.',
    'number.positive': 'Harga jual harus lebih dari 0.',
    'any.required': 'Harga jual wajib diisi.',
  }),
  stok: Joi.number().integer().min(0).required().messages({
    'number.base': 'Stok harus berupa angka.',
    'number.integer': 'Stok harus bilangan bulat.',
    'number.min': 'Stok tidak boleh negatif.',
    'any.required': 'Stok wajib diisi.',
  }),
  imageUrl: Joi.string().uri().allow('', null).optional().messages({
    'string.uri': 'Tautan gambar tidak valid.',
  }),
});


// Validasi payload produk (POST & PUT).
// returns { value } jika valid, { error } berupa map { field: pesan } jika gagal.

const validateProduct = (payload) => {
  const { error, value } = productSchema.validate(payload || {}, {
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

module.exports = { validateProduct };
