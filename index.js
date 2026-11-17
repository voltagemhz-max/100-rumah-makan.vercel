const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database sementara (in-memory). Data kembali ke awal saat server restart.
const db = {
  customers: [
    { id: 1, nama: 'Andi Pratama', telepon: '081234567890', alamat: 'Boyolali' },
    { id: 2, nama: 'Sari Wulandari', telepon: '085711223344', alamat: 'Surakarta' }
  ],
  employees: [
    { id: 1, nama: 'Budi', jabatan: 'Koki', shift: 'Pagi', telepon: '081300000001' },
    { id: 2, nama: 'Joko', jabatan: 'Koki', shift: 'Siang', telepon: '081300000002' },
    { id: 3, nama: 'Siti', jabatan: 'Barista', shift: 'Pagi', telepon: '081300000003' },
    { id: 4, nama: 'Rina', jabatan: 'Kasir', shift: 'Siang', telepon: '081300000004' }
  ],
  menu: [
    { id: 1, nama: 'Nasi Goreng Spesial', kategori: 'Makanan', harga: 25000, stok: 15 },
    { id: 2, nama: 'Sate Ayam Madura', kategori: 'Makanan', harga: 30000, stok: 10 },
    { id: 3, nama: 'Es Teh Manis', kategori: 'Minuman', harga: 5000, stok: 40 },
    { id: 4, nama: 'Es Jeruk', kategori: 'Minuman', harga: 7000, stok: 30 }
  ],
  tables: [
    { id: 1, nomor: 'Meja 01', kapasitas: 4, status: 'Terisi' },
    { id: 2, nomor: 'Meja 03', kapasitas: 2, status: 'Kosong' },
    { id: 3, nomor: 'VIP 02', kapasitas: 8, status: 'Dipesan' }
  ],
  orders: [
    { id: 1, customerId: 1, tableId: 1, menuId: 1, jumlah: 2, metode: 'Tunai', status: 'Belum bayar', total: 50000 },
    { id: 2, customerId: 2, tableId: 2, menuId: 2, jumlah: 1, metode: 'QRIS', status: 'Lunas', total: 30000 }
  ]
};

// Skema kolom: s = teks, n = angka
const schemas = {
  customers: { nama: 's', telepon: 's', alamat: 's' },
  employees: { nama: 's', jabatan: 's', shift: 's', telepon: 's' },
  menu: { nama: 's', kategori: 's', harga: 'n', stok: 'n' },
  tables: { nomor: 's', kapasitas: 'n', status: 's' },
  orders: { customerId: 'n', tableId: 'n', menuId: 'n', jumlah: 'n', metode: 's', status: 's' }
};
const refs = { customers: 'customerId', tables: 'tableId', menu: 'menuId' };
const nextId = {};
for (const k in db) nextId[k] = Math.max(0, ...db[k].map(r => r.id)) + 1;

function clean(res, body) {
  const out = {};
  for (const [key, type] of Object.entries(schemas[res])) {
    let v = body[key];
    if (v === undefined || v === null || String(v).trim() === '') return { error: `Kolom "${key}" wajib diisi` };
    if (type === 'n') {
      v = Number(v);
      if (!Number.isFinite(v) || v < 0) return { error: `Kolom "${key}" harus berupa angka` };
    } else v = String(v).trim();
    out[key] = v;
  }
  if (res === 'orders') {
    const m = db.menu.find(x => x.id === out.menuId);
    if (!m || !db.customers.some(x => x.id === out.customerId) || !db.tables.some(x => x.id === out.tableId))
      return { error: 'Pelanggan, meja, atau menu tidak ditemukan' };
    out.total = m.harga * out.jumlah;
  }
  return { data: out };
}

const exists = (req, res, next) =>
  db[req.params.res] ? next() : res.status(404).json({ error: 'Data tidak ditemukan' });

app.get('/api/:res', exists, (req, res) => res.json(db[req.params.res]));

app.post('/api/:res', exists, (req, res) => {
  const r = clean(req.params.res, req.body);
  if (r.error) return res.status(400).json({ error: r.error });
  const row = { id: nextId[req.params.res]++, ...r.data };
  db[req.params.res].push(row);
  res.status(201).json(row);
});

app.put('/api/:res/:id', exists, (req, res) => {
  const list = db[req.params.res];
  const i = list.findIndex(x => x.id === Number(req.params.id));
  if (i < 0) return res.status(404).json({ error: 'Data tidak ditemukan' });
  const r = clean(req.params.res, req.body);
  if (r.error) return res.status(400).json({ error: r.error });
  list[i] = { id: list[i].id, ...r.data };
  res.json(list[i]);
});

app.delete('/api/:res/:id', exists, (req, res) => {
  const name = req.params.res;
  const id = Number(req.params.id);
  const list = db[name];
  const i = list.findIndex(x => x.id === id);
  if (i < 0) return res.status(404).json({ error: 'Data tidak ditemukan' });
  if (refs[name] && db.orders.some(o => o[refs[name]] === id))
    return res.status(409).json({ error: 'Data masih dipakai pada pesanan, hapus pesanannya dulu' });
  list.splice(i, 1);
  res.status(204).end();
});

// Lokal: node index.js. Vercel: memakai app yang diekspor.
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server berjalan di http://localhost:${PORT}`));
}
module.exports = app;
