# Panduan Cepat Petugas Yudea

**GPIB Yudea · Sistem Informasi Warga Jemaat**

Orientation satu halaman untuk staf, koordinator, dan administrator baru. Untuk
penjelasan setiap kolom dan dialog, lanjutkan ke
[Panduan Pengguna lengkap](USER_MANUAL.md).

---

## 1. Masuk dan keluar

1. Buka `/public/login`.
2. Masukkan email dan password akun yang diberikan administrator.
3. Setelah masuk, Anda diarahkan sesuai peran:

| Peran | Halaman awal |
|-------|--------------|
| ADMIN, STAFF | Dashboard |
| COORDINATOR | Keluarga |
| MEMBER | Warga Jemaat (hanya baca) |

Klik **avatar** di kanan atas lalu **Logout** saat selesai, terutama di komputer
bersama. Tidak ada pendaftaran mandiri dan tidak ada tombol lupa password;
minta administrator mereset password Anda.

---

## 2. Mengenal layar

- **Sidebar** hanya menampilkan halaman yang boleh Anda buka. Di ponsel, buka
  dengan tombol menu (☰).
- **Bilah atas** menampilkan halaman aktif, peran, dan email Anda.
- **Tabel** memiliki pencarian, judul kolom yang bisa diklik untuk mengurutkan,
  pilihan 10/20/50 baris, dan tombol halaman sebelumnya/berikutnya.
- Tombol **Create**, **Edit**, dan **Delete** hanya muncul jika peran Anda boleh
  mengedit halaman tersebut.
- Jika Anda membuka halaman tanpa izin, muncul **Access Restricted**. Itu
  pengaturan peran, bukan kerusakan; hubungi administrator bila seharusnya
  Anda memiliki akses.

---

## 3. Tugas yang paling sering

### Mencari warga jemaat

Buka **Warga Jemaat**, ketik nama/email/telepon/nama keluarga di kolom
pencarian, lalu persempit dengan filter **Sektor Pelayanan** atau **Pelkat**.
Klik **Edit** pada baris untuk membuka data lengkap.

### Menambah keluarga dan anggotanya

1. Buka **Keluarga** → **Create Family**.
2. Isi nama keluarga, **Sektor Pelayanan**, detail alamat, dan Provinsi/
   Kota-Kabupaten/Kecamatan/Kelurahan (pilih berurutan).
3. Opsional: klik **Add Member** dan isi anggota baru langsung di dialog.
4. Klik **Create**.

Anda juga dapat menambahkan anggota belakangan dari halaman **Warga Jemaat**.

### Menambah warga ke keluarga yang sudah ada

Buka **Warga Jemaat** → **Create Member**. Isi data wajib, pilih **Family**
(keluarga) yang benar, lalu **Create**. Setiap warga harus berada di satu
keluarga dan satu sektor.

### Mencatat pindah atau meninggal

- **Satu warga pindah:** Warga Jemaat → **Status**, pilih tidak aktif, isi
  **Tanggal Pindah**.
- **Seluruh keluarga pindah:** klik badge **Aktif/Tidak Aktif** pada baris
  keluarga. Status berlaku untuk semua anggotanya sekaligus.
- **Meninggal:** Warga Jemaat → **Status Hidup**.

Jangan menghapus data untuk mencatat kepindahan atau kematian; gunakan status
agar riwayat tetap ada.

### Memisahkan keluarga

Buka **Keluarga** → **Pisah** pada keluarga yang memiliki kepala keluarga.
Pilih anggota yang pindah ke rumah tangga baru, periksa alamat/sektor, lalu
**Buat Keluarga Baru**.

### Rutinitas mingguan

| Tugas | Halaman | Catatan |
|-------|---------|---------|
| Daftar ulang tahun minggu ini | **Ulang Tahun** | Pilih tanggal dalam minggu; bisa dicetak/diekspor |
| Mencatat kehadiran ibadah | **Attendance** | Isi jumlah laki-laki dan perempuan; total dihitung otomatis |
| Laporan warga | `/dashboard/report` | Khusus ADMIN/STAFF secara default; halaman ini tidak ada di sidebar, buka langsung atau simpan bookmark |

Satu tanggal dan jenis ibadah hanya boleh punya satu catatan kehadiran. Jika
muncul pesan data sudah ada, edit catatan tersebut, jangan membuat duplikat.

---

## 4. Koordinator: satu sektor

Akun **COORDINATOR** wajib terhubung ke satu **Sektor Pelayanan**.

- Daftar keluarga, warga, sektor, ulang tahun, dan dashboard hanya menampilkan
  sektor tersebut.
- Jika administrator memberi akses halaman **Report**, isinya juga dibatasi ke
  sektor tersebut.
- Membuat atau memindahkan data ke sektor lain ditolak.
- Jika akun koordinator tidak memiliki sektor (misalnya sektornya dihapus),
  setelah login berikutnya permintaan datanya ditolak dengan **403**. Sesi
  lama tetap terbatas pada sektor yang sudah dihapus, sehingga hasilnya
  kosong. Administrator harus menetapkan sektor baru; setelah itu koordinator
  harus logout dan login lagi.
- Perubahan peran atau sektor juga baru berlaku setelah login ulang, karena
  sesi masih membawa peran/sektor saat login.

---

## 5. Administrator: akun dan izin

- **Users → Add User**: buat akun. Peran **COORDINATOR** mewajibkan pilihan
  **Sektor Pelayanan**. Password minimal 6 karakter.
- Untuk mereset password, edit pengguna dan isi **New password (optional)**.
- Anda tidak dapat menghapus akun sendiri.
- **Settings** mengatur matriks View/Edit per halaman. Settings selalu khusus
  ADMIN; Edit hanya bisa dipilih jika View aktif.
- Menghapus **wilayah**, **sektor**, **keluarga**, atau **warga** bersifat
  permanen. Menghapus sektor juga menghapus keluarga dan warganya; menghapus
  wilayah menghapus seluruh sektor di bawahnya. Nonaktifkan atau pindahkan data
  jika hanya ingin mencatat perubahan.

---

## 6. Jika ada masalah

| Gejala | Yang perlu dicek |
|--------|-----------------|
| **Invalid email or password** | Salah ketik, Caps Lock, atau akun belum dibuat |
| Menu tidak muncul / **Access Restricted** | Peran tidak punya izin View; minta admin memeriksa Settings |
| Koordinator melihat data kosong atau **403** | Akun belum/tidak lagi punya sektor; minta admin menetapkan sektor lalu login ulang |
| Perubahan peran belum berlaku | Logout dan login lagi |
| Kehadiran ditolak | Sudah ada catatan untuk tanggal dan jenis ibadah yang sama |
| Tombol ekspor nonaktif | Daftar masih dimuat atau hasil filter kosong |
| Data lama masih tampil | Muat ulang halaman; query di-cache sekitar 30 detik |

---

## 7. Bantuan lanjutan

- [Panduan Pengguna lengkap](USER_MANUAL.md) — semua halaman, kolom, dan FAQ
- [Dokumentasi proyek](PROJECT_DOCUMENTATION.md) — arsitektur, penyiapan, operasi
- [API](API.md) · [Model data](DATA_MODEL.md) · [Autentikasi & RBAC](AUTH_RBAC.md)
- [README](../README.md) — ringkasan proyek dan cara menjalankan aplikasi

> **Akun demo:** hanya untuk instalasi dengan data contoh. Jangan pakai di
> produksi. Contoh: `admin@example.com` / `admin123`,
> `demo@example.com` / `demo1234`, dan
> `coordinator-a@example.com` / `coordinator123`.
