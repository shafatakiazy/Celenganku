const express = require('express');
const path = require('path');
const { DatabaseSync } = require('node:sqlite'); // SQLite bawaan Node.js, tanpa kompilasi

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Database (satu tabel: transactions) ----------
const db = new DatabaseSync(process.env.DB_FILE || path.join(__dirname, 'celengan.db'));
db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    type       TEXT    NOT NULL CHECK (type IN ('masuk', 'keluar')),
    amount     INTEGER NOT NULL CHECK (amount > 0),
    note       TEXT    NOT NULL DEFAULT '',
    category   TEXT    NOT NULL DEFAULT '',
    date       TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`);

// ---------- Middleware ----------
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Helper ----------
const rupiah = (n) => 'Rp ' + Number(n).toLocaleString('id-ID');
const signed = (type, amount) => (type === 'masuk' ? amount : -amount);

// Saldo celengan, opsional tanpa menghitung satu transaksi (untuk ubah/hapus)
function balance(excludeId = null) {
  return db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN type = 'masuk' THEN amount ELSE -amount END), 0) AS b
       FROM transactions WHERE (? IS NULL OR id != ?)`
    )
    .get(excludeId, excludeId).b;
}

function validate(body) {
  const errors = [];
  const type = body.type;
  const amount = Number(body.amount);
  const note = typeof body.note === 'string' ? body.note.trim() : '';
  const category = typeof body.category === 'string' ? body.category.trim() : '';
  const date = typeof body.date === 'string' ? body.date : '';

  if (type !== 'masuk' && type !== 'keluar') errors.push('Pilih jenis: masuk atau keluar.');
  if (!Number.isInteger(amount) || amount <= 0 || amount > 1e12) {
    errors.push('Jumlah harus bilangan bulat lebih dari 0.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    errors.push('Tanggal tidak valid. Gunakan format tahun-bulan-hari.');
  }
  if (note.length > 100) errors.push('Keterangan maksimal 100 karakter.');
  if (category.length > 30) errors.push('Kategori maksimal 30 karakter.');

  return { errors, data: { type, amount, note, category, date } };
}

// ---------- Routes ----------

// Ringkasan: saldo, total masuk, total keluar
app.get('/api/summary', (req, res) => {
  const row = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'masuk'  THEN amount END), 0) AS total_masuk,
         COALESCE(SUM(CASE WHEN type = 'keluar' THEN amount END), 0) AS total_keluar,
         COUNT(*) AS jumlah
       FROM transactions`
    )
    .get();
  res.json({ ...row, saldo: row.total_masuk - row.total_keluar });
});

// READ semua
app.get('/api/transactions', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM transactions ORDER BY date DESC, id DESC')
    .all();
  res.json(rows);
});

// READ satu
app.get('/api/transactions/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
  res.json(row);
});

// CREATE
app.post('/api/transactions', (req, res) => {
  const { errors, data } = validate(req.body || {});
  if (errors.length) return res.status(400).json({ errors });

  const saldo = balance();
  if (saldo + signed(data.type, data.amount) < 0) {
    return res.status(409).json({
      error: `Saldo tidak cukup. Saldo celengan ${rupiah(saldo)}, jumlah yang diambil ${rupiah(data.amount)}.`,
    });
  }

  const info = db
    .prepare('INSERT INTO transactions (type, amount, note, category, date) VALUES (?, ?, ?, ?, ?)')
    .run(data.type, data.amount, data.note, data.category, data.date);
  res.status(201).json(db.prepare('SELECT * FROM transactions WHERE id = ?').get(info.lastInsertRowid));
});

// UPDATE
app.put('/api/transactions/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Transaksi tidak ditemukan.' });

  const { errors, data } = validate(req.body || {});
  if (errors.length) return res.status(400).json({ errors });

  const saldoTanpaIni = balance(existing.id);
  if (saldoTanpaIni + signed(data.type, data.amount) < 0) {
    return res.status(409).json({
      error: `Perubahan ini membuat saldo minus. Saldo tanpa transaksi ini ${rupiah(saldoTanpaIni)}.`,
    });
  }

  db.prepare('UPDATE transactions SET type = ?, amount = ?, note = ?, category = ?, date = ? WHERE id = ?')
    .run(data.type, data.amount, data.note, data.category, data.date, existing.id);
  res.json(db.prepare('SELECT * FROM transactions WHERE id = ?').get(existing.id));
});

// DELETE
app.delete('/api/transactions/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Transaksi tidak ditemukan.' });

  const saldoTanpaIni = balance(existing.id);
  if (saldoTanpaIni < 0) {
    return res.status(409).json({
      error: `Transaksi ini tidak bisa dihapus karena saldo akan minus (${rupiah(saldoTanpaIni)}). Hapus dulu pengambilan yang bergantung padanya.`,
    });
  }

  db.prepare('DELETE FROM transactions WHERE id = ?').run(existing.id);
  res.status(204).end();
});

// JSON rusak -> 400 yang jelas
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Format data tidak valid.' });
  }
  console.error(err);
  const detail = (err.code ? err.code + ': ' : '') + err.message;
  res.status(500).json({ error: 'Terjadi kesalahan di server (' + detail + ').' });
});

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`Celengan berjalan di http://localhost:${PORT}`);
});