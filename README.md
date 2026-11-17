# Celenganku

Aplikasi keuangan bertema celengan: catat uang masuk dan keluar, lihat celengan babi terisi koin sesuai saldo dan target tabungan. Dibuat dengan Express.js dan SQLite (better-sqlite3).

## Menjalankan

```bash
npm install
npm start
```

Buka http://localhost:3000

## Struktur

```
.
├── package.json
├── server.js          # REST API + SQLite
└── public/
    └── index.html     # Tampilan celengan
```

## Tabel `transactions`

| Kolom      | Tipe    | Keterangan                       |
|------------|---------|----------------------------------|
| id         | INTEGER | Primary key, otomatis            |
| type       | TEXT    | `masuk` atau `keluar`            |
| amount     | INTEGER | Jumlah dalam rupiah, lebih dari 0 |
| note       | TEXT    | Keterangan, maksimal 100 karakter |
| category   | TEXT    | Kategori, maksimal 30 karakter   |
| date       | TEXT    | Tanggal, format `YYYY-MM-DD`     |
| created_at | TEXT    | Diisi otomatis                   |

## Endpoint API

| Method | URL                      | Fungsi                              |
|--------|--------------------------|-------------------------------------|
| GET    | /api/summary             | Saldo, total masuk, total keluar    |
| GET    | /api/transactions        | Daftar semua transaksi              |
| GET    | /api/transactions/:id    | Detail satu transaksi               |
| POST   | /api/transactions        | Tambah transaksi                    |
| PUT    | /api/transactions/:id    | Ubah transaksi                      |
| DELETE | /api/transactions/:id    | Hapus transaksi                     |

Contoh body (POST/PUT):

```json
{ "type": "masuk", "amount": 50000, "date": "2026-11-17", "category": "Uang saku", "note": "Sisa bulan lalu" }
```

Aturan saldo: pengambilan uang ditolak kalau melebihi saldo, dan perubahan atau penghapusan yang membuat saldo minus juga ditolak.

## Catatan

Target tabungan disimpan di browser (localStorage), jadi tidak ada di database.

## Pembuat

Shafa Takia Zahra Yuwono, NIM 255150707111067
