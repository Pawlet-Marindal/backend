-- Kolom pengaturan toko yang dipakai frontend tetapi belum ada di schema.sql awal.
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(30) NULL AFTER store_phone,
  ADD COLUMN IF NOT EXISTS footer_struk TEXT NULL AFTER whatsapp,
  ADD COLUMN IF NOT EXISTS jam_operasional VARCHAR(100) NULL AFTER footer_struk;
