// ===================== STATE & STORAGE =====================
const DB = {
  get: (key, def) => { try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; } },
  set: (key, val) => localStorage.setItem(key, JSON.stringify(val))
};

let barangList = DB.get('barang', []);
let transaksiList = DB.get('transaksi', []);
let settings = DB.get('settings', { diskon: 0, pajak: 0, namaToko: 'Quick Kasir', namaKasir: '' });
let keranjang = [];
let activeKategori = 'Semua';

// ===================== FORMAT =====================
const rupiah = n => 'Rp ' + Number(n).toLocaleString('id-ID');

// ===================== NAVIGATION =====================
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('page-' + btn.dataset.page).classList.add('active');
    if (btn.dataset.page === 'kasir') { renderKategoriTabs(); renderBarangGrid(); updateKasirBadge(); }
    if (btn.dataset.page === 'barang') renderBarangTable();
    if (btn.dataset.page === 'pengaturan') loadSettings();
    if (btn.dataset.page === 'riwayat') renderRiwayat();
  });
});

function updateKasirBadge() {
  document.getElementById('label-kasir-aktif').textContent = settings.namaKasir || 'Belum diset';
}

// ===================== KASIR PAGE =====================

function getKategoriList() {
  const set = new Set(barangList.map(b => b.kategori || 'Lainnya'));
  return ['Semua', ...Array.from(set)];
}

function renderKategoriTabs() {
  const wrap = document.getElementById('kategori-tabs');
  const list = getKategoriList();
  wrap.innerHTML = list.map(k => `
    <button class="kategori-tab ${k === activeKategori ? 'active' : ''}" data-kat="${k}">${k}</button>
  `).join('');
  wrap.querySelectorAll('.kategori-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeKategori = btn.dataset.kat;
      renderKategoriTabs();
      renderBarangGrid(document.getElementById('search-barang').value);
    });
  });
}

function renderBarangGrid(filter = '') {
  const grid = document.getElementById('barang-grid');
  let filtered = barangList.filter(b => {
    const matchKat = activeKategori === 'Semua' || (b.kategori || 'Lainnya') === activeKategori;
    const matchSearch = b.nama.toLowerCase().includes(filter.toLowerCase()) ||
      (b.kategori || '').toLowerCase().includes(filter.toLowerCase());
    return matchKat && matchSearch;
  });

  if (!filtered.length) {
    grid.innerHTML = '<div class="empty-state">Belum ada menu. Tambahkan di halaman Menu.</div>';
    return;
  }

  grid.innerHTML = filtered.map(b => `
    <div class="barang-card ${b.stok <= 0 ? 'habis' : ''}" data-id="${b.id}">
      <div class="nama">${b.nama}</div>
      <div class="kategori">${b.kategori || '-'}</div>
      <div class="harga">${rupiah(b.harga)}</div>
      <div class="stok">${b.stok > 0 ? 'Stok: ' + b.stok : '⚠️ Habis'}</div>
    </div>
  `).join('');

  grid.querySelectorAll('.barang-card:not(.habis)').forEach(card => {
    card.addEventListener('click', () => tambahKeKeranjang(card.dataset.id));
  });
}

document.getElementById('search-barang').addEventListener('input', e => renderBarangGrid(e.target.value));

function tambahKeKeranjang(id) {
  const barang = barangList.find(b => b.id === id);
  if (!barang || barang.stok <= 0) return;
  const existing = keranjang.find(k => k.id === id);
  if (existing) {
    if (existing.qty >= barang.stok) return alert('Stok tidak cukup!');
    existing.qty++;
  } else {
    keranjang.push({ id, nama: barang.nama, harga: barang.harga, qty: 1 });
  }
  renderKeranjang();
}

function renderKeranjang() {
  const list = document.getElementById('keranjang-list');
  if (!keranjang.length) {
    list.innerHTML = '<div class="empty-state">Keranjang kosong</div>';
    updateSummary();
    return;
  }
  list.innerHTML = keranjang.map((item, i) => `
    <div class="keranjang-item">
      <div class="item-nama">${item.nama}</div>
      <div class="item-qty">
        <button class="qty-btn" data-action="minus" data-idx="${i}">−</button>
        <span>${item.qty}</span>
        <button class="qty-btn" data-action="plus" data-idx="${i}">+</button>
      </div>
      <div class="item-harga">${rupiah(item.harga * item.qty)}</div>
      <button class="item-del" data-idx="${i}">🗑</button>
    </div>
  `).join('');

  list.querySelectorAll('.qty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = +btn.dataset.idx;
      const barang = barangList.find(b => b.id === keranjang[idx].id);
      if (btn.dataset.action === 'plus') {
        if (keranjang[idx].qty >= barang.stok) return alert('Stok tidak cukup!');
        keranjang[idx].qty++;
      } else {
        keranjang[idx].qty--;
        if (keranjang[idx].qty <= 0) keranjang.splice(idx, 1);
      }
      renderKeranjang();
    });
  });

  list.querySelectorAll('.item-del').forEach(btn => {
    btn.addEventListener('click', () => {
      keranjang.splice(+btn.dataset.idx, 1);
      renderKeranjang();
    });
  });

  updateSummary();
  updateKeranjangFab();
}

function updateSummary() {
  const subtotal = keranjang.reduce((s, k) => s + k.harga * k.qty, 0);
  const diskon = settings.diskon || 0;
  const pajak = settings.pajak || 0;
  const nilaiDiskon = subtotal * diskon / 100;
  const nilaiPajak = (subtotal - nilaiDiskon) * pajak / 100;
  const total = subtotal - nilaiDiskon + nilaiPajak;

  document.getElementById('subtotal').textContent = rupiah(subtotal);
  document.getElementById('label-diskon').textContent = `Diskon (${diskon}%)`;
  document.getElementById('total-diskon').textContent = `- ${rupiah(nilaiDiskon)}`;
  document.getElementById('label-pajak').textContent = `Pajak (${pajak}%)`;
  document.getElementById('total-pajak').textContent = `+ ${rupiah(nilaiPajak)}`;
  document.getElementById('grand-total').textContent = rupiah(total);

  hitungKembalian();
}

function hitungKembalian() {
  const metode = document.getElementById('metode-bayar').value;
  const totalEl = document.getElementById('grand-total').textContent;
  const total = parseFloat(totalEl.replace(/[^0-9]/g, ''));
  if (metode !== 'cash') {
    document.getElementById('kembalian').textContent = 'Lunas ✅';
    return;
  }
  const bayar = parseFloat(document.getElementById('uang-bayar').value) || 0;
  const kembalian = bayar - total;
  document.getElementById('kembalian').textContent = kembalian >= 0 ? rupiah(kembalian) : '⚠️ Kurang';
}

document.getElementById('metode-bayar').addEventListener('change', e => {
  const isCash = e.target.value === 'cash';
  document.getElementById('cash-input-wrap').style.display = isCash ? 'block' : 'none';
  hitungKembalian();
});

document.getElementById('uang-bayar').addEventListener('input', hitungKembalian);

document.getElementById('btn-clear').addEventListener('click', () => {
  keranjang = [];
  renderKeranjang();
  document.getElementById('uang-bayar').value = '';
});

document.getElementById('btn-bayar').addEventListener('click', () => {
  if (!keranjang.length) return alert('Keranjang masih kosong!');
  const metode = document.getElementById('metode-bayar').value;
  const subtotal = keranjang.reduce((s, k) => s + k.harga * k.qty, 0);
  const diskon = settings.diskon || 0;
  const pajak = settings.pajak || 0;
  const nilaiDiskon = subtotal * diskon / 100;
  const nilaiPajak = (subtotal - nilaiDiskon) * pajak / 100;
  const total = subtotal - nilaiDiskon + nilaiPajak;

  let uangBayar = total;
  let kembalian = 0;

  if (metode === 'cash') {
    uangBayar = parseFloat(document.getElementById('uang-bayar').value) || 0;
    if (uangBayar < total) return alert('Uang bayar kurang!');
    kembalian = uangBayar - total;
  }

  keranjang.forEach(item => {
    const b = barangList.find(b => b.id === item.id);
    if (b) b.stok -= item.qty;
  });
  DB.set('barang', barangList);

  const trx = {
    id: 'TRX-' + Date.now(),
    tanggal: new Date().toISOString(),
    namaPelanggan: document.getElementById('nama-pelanggan').value.trim() || 'Umum',
    namaKasir: settings.namaKasir || '-',
    items: keranjang.map(k => ({ ...k })),
    subtotal, diskon, pajak, nilaiDiskon, nilaiPajak, total,
    metode, uangBayar, kembalian
  };
  transaksiList.unshift(trx);
  DB.set('transaksi', transaksiList);

  tampilStruk(trx);

  keranjang = [];
  renderKeranjang();
  renderBarangGrid(document.getElementById('search-barang').value);
  document.getElementById('uang-bayar').value = '';
  document.getElementById('nama-pelanggan').value = '';
});

// ===================== STRUK =====================
function tampilStruk(trx) {
  const tgl = new Date(trx.tanggal).toLocaleString('id-ID');
  const metodeLabel = { cash: 'Cash', qris: 'QRIS / e-Wallet', transfer: 'Transfer Bank' };
  const itemsHtml = trx.items.map(i =>
    `<div class="struk-row"><span>${i.nama} x${i.qty}</span><span>${rupiah(i.harga * i.qty)}</span></div>`
  ).join('');

  document.getElementById('struk-content').innerHTML = `
    <div class="struk">
      <div class="struk-title">${settings.namaToko || 'Quick Kasir'}</div>
      <div class="struk-sub">${tgl}</div>
      <div class="struk-sub">${trx.id}</div>
      <div class="struk-divider"></div>
      <div class="struk-row"><span>Pelanggan</span><span>${trx.namaPelanggan || 'Umum'}</span></div>
      <div class="struk-row"><span>Kasir</span><span>${trx.namaKasir || '-'}</span></div>
      <div class="struk-divider"></div>
      ${itemsHtml}
      <div class="struk-divider"></div>
      <div class="struk-row"><span>Subtotal</span><span>${rupiah(trx.subtotal)}</span></div>
      ${trx.nilaiDiskon > 0 ? `<div class="struk-row"><span>Diskon (${trx.diskon}%)</span><span>- ${rupiah(trx.nilaiDiskon)}</span></div>` : ''}
      ${trx.nilaiPajak > 0 ? `<div class="struk-row"><span>Pajak (${trx.pajak}%)</span><span>+ ${rupiah(trx.nilaiPajak)}</span></div>` : ''}
      <div class="struk-divider"></div>
      <div class="struk-row struk-total"><span>TOTAL</span><span>${rupiah(trx.total)}</span></div>
      <div class="struk-row"><span>Metode</span><span>${metodeLabel[trx.metode]}</span></div>
      ${trx.metode === 'cash' ? `<div class="struk-row"><span>Bayar</span><span>${rupiah(trx.uangBayar)}</span></div><div class="struk-row"><span>Kembalian</span><span>${rupiah(trx.kembalian)}</span></div>` : ''}
      <div class="struk-lunas">✅ LUNAS</div>
    </div>
  `;
  document.getElementById('modal-struk').style.display = 'flex';
}

document.getElementById('btn-close-modal').addEventListener('click', () => {
  document.getElementById('modal-struk').style.display = 'none';
});

document.getElementById('btn-print').addEventListener('click', () => window.print());

// ===================== BARANG PAGE =====================
function renderBarangTable(filter = '') {
  const filtered = barangList.filter(b =>
    b.nama.toLowerCase().includes(filter.toLowerCase()) ||
    (b.kategori || '').toLowerCase().includes(filter.toLowerCase())
  );
  const tbody = document.getElementById('barang-tbody');
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:#aaa">Belum ada menu.</td></tr>';
    return;
  }
  tbody.innerHTML = filtered.map(b => `
    <tr>
      <td>${b.nama}</td>
      <td>${b.kategori || '-'}</td>
      <td>${rupiah(b.harga)}</td>
      <td>${b.stok}</td>
      <td>
        <button class="action-btn" data-edit="${b.id}" title="Edit">✏️</button>
        <button class="action-btn" data-del="${b.id}" title="Hapus">🗑️</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => editBarang(btn.dataset.edit));
  });
  tbody.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', () => hapusBarang(btn.dataset.del));
  });
}

document.getElementById('search-barang-table').addEventListener('input', e => renderBarangTable(e.target.value));

document.getElementById('btn-simpan-barang').addEventListener('click', () => {
  const nama = document.getElementById('nama-barang').value.trim();
  const kategori = document.getElementById('kategori-barang').value.trim();
  const harga = parseFloat(document.getElementById('harga-barang').value);
  const stok = parseInt(document.getElementById('stok-barang').value);
  const editId = document.getElementById('edit-id').value;

  if (!nama || isNaN(harga) || isNaN(stok)) return alert('Nama, harga, dan stok wajib diisi!');

  if (editId) {
    const idx = barangList.findIndex(b => b.id === editId);
    if (idx !== -1) barangList[idx] = { ...barangList[idx], nama, kategori, harga, stok };
  } else {
    barangList.push({ id: 'B-' + Date.now(), nama, kategori, harga, stok });
  }

  DB.set('barang', barangList);
  renderBarangTable();
  resetFormBarang();
});

function editBarang(id) {
  const b = barangList.find(b => b.id === id);
  if (!b) return;
  document.getElementById('edit-id').value = b.id;
  document.getElementById('nama-barang').value = b.nama;
  document.getElementById('kategori-barang').value = b.kategori || '';
  document.getElementById('harga-barang').value = b.harga;
  document.getElementById('stok-barang').value = b.stok;
  document.getElementById('form-barang-title').textContent = 'Edit Menu';
  document.getElementById('btn-batal-barang').style.display = 'inline-block';
  document.getElementById('btn-simpan-barang').textContent = 'Update';
}

function hapusBarang(id) {
  if (!confirm('Hapus menu ini?')) return;
  barangList = barangList.filter(b => b.id !== id);
  DB.set('barang', barangList);
  renderBarangTable();
}

function resetFormBarang() {
  document.getElementById('edit-id').value = '';
  document.getElementById('nama-barang').value = '';
  document.getElementById('kategori-barang').value = '';
  document.getElementById('harga-barang').value = '';
  document.getElementById('stok-barang').value = '';
  document.getElementById('form-barang-title').textContent = 'Tambah Menu';
  document.getElementById('btn-batal-barang').style.display = 'none';
  document.getElementById('btn-simpan-barang').textContent = 'Simpan';
}

document.getElementById('btn-batal-barang').addEventListener('click', resetFormBarang);

// ===================== PENGATURAN PAGE =====================
function loadSettings() {
  document.getElementById('set-diskon').value = settings.diskon || 0;
  document.getElementById('set-pajak').value = settings.pajak || 0;
  document.getElementById('set-nama-toko').value = settings.namaToko || 'Quick Kasir';
  document.getElementById('set-nama-kasir').value = settings.namaKasir || '';
}

document.getElementById('btn-simpan-setting').addEventListener('click', () => {
  settings.diskon = parseFloat(document.getElementById('set-diskon').value) || 0;
  settings.pajak = parseFloat(document.getElementById('set-pajak').value) || 0;
  settings.namaToko = document.getElementById('set-nama-toko').value.trim() || 'Quick Kasir Cafe';
  settings.namaKasir = document.getElementById('set-nama-kasir').value.trim();
  DB.set('settings', settings);
  updateKasirBadge();
  const msg = document.getElementById('setting-saved');
  msg.style.display = 'block';
  setTimeout(() => msg.style.display = 'none', 2000);
  updateSummary();
});

// ===================== RIWAYAT PAGE =====================
function renderRiwayat(filter = '') {
  const container = document.getElementById('riwayat-list');
  let list = transaksiList;
  if (filter) list = list.filter(t => t.tanggal.startsWith(filter));
  if (!list.length) {
    container.innerHTML = '<div class="empty-state">Belum ada transaksi.</div>';
    return;
  }
  const metodeLabel = { cash: 'Cash', qris: 'QRIS / e-Wallet', transfer: 'Transfer Bank' };
  container.innerHTML = list.map(t => {
    const tgl = new Date(t.tanggal).toLocaleString('id-ID');
    const itemsSummary = t.items.map(i => `${i.nama} x${i.qty}`).join(', ');
    return `
      <div class="riwayat-card">
        <div class="riwayat-header">
          <div>
            <div class="riwayat-id">${t.id}</div>
            <div class="riwayat-tanggal">${tgl}</div>
            <div class="riwayat-tanggal">👤 ${t.namaPelanggan || 'Umum'} &nbsp;|&nbsp; 🧑‍💼 ${t.namaKasir || '-'}</div>
          </div>
          <div style="text-align:right">
            <div class="riwayat-total">${rupiah(t.total)}</div>
            <span class="riwayat-metode">${metodeLabel[t.metode] || t.metode}</span>
          </div>
        </div>
        <div class="riwayat-items">${itemsSummary}</div>
      </div>
    `;
  }).join('');
}

document.getElementById('btn-filter').addEventListener('click', () => {
  renderRiwayat(document.getElementById('filter-tanggal').value);
});

document.getElementById('btn-reset-filter').addEventListener('click', () => {
  document.getElementById('filter-tanggal').value = '';
  renderRiwayat();
});

document.getElementById('btn-hapus-riwayat').addEventListener('click', () => {
  if (!confirm('Hapus semua riwayat transaksi?')) return;
  transaksiList = [];
  DB.set('transaksi', transaksiList);
  renderRiwayat();
});

// ===================== MOBILE KERANJANG TOGGLE =====================
function isMobile() { return window.innerWidth <= 900; }

function updateKeranjangFab() {
  const total = keranjang.reduce((s, k) => s + k.qty, 0);
  const fab = document.getElementById('btn-buka-keranjang');
  const toggleBtn = document.getElementById('btn-toggle-keranjang');
  const countFab = document.getElementById('keranjang-count-fab');
  if (countFab) countFab.textContent = total;
  if (isMobile()) {
    fab.style.display = total > 0 ? 'block' : 'none';
    if (toggleBtn) toggleBtn.style.display = 'flex';
  } else {
    fab.style.display = 'none';
    if (toggleBtn) toggleBtn.style.display = 'none';
    document.getElementById('keranjang-panel').classList.remove('open');
  }
}

document.getElementById('btn-buka-keranjang').addEventListener('click', () => {
  document.getElementById('keranjang-panel').classList.add('open');
});

document.getElementById('btn-toggle-keranjang').addEventListener('click', () => {
  document.getElementById('keranjang-panel').classList.remove('open');
});

window.addEventListener('resize', updateKeranjangFab);

// ===================== INIT =====================
renderKategoriTabs();
renderBarangGrid();
renderKeranjang();
updateKasirBadge();
updateKeranjangFab();
