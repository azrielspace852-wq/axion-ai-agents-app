# Axion AI Agents App

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](./LICENSE)

Axion AI Agents App adalah antarmuka web statis untuk membuat, mengelola, dan menjalankan "AI Agents" (agen cerdas) yang terhubung ke penyedia model (provider) berbeda. Proyek ini berfokus pada pengalaman pengguna (UI) untuk konfigurasi provider, pembuatan agen/template, dan pengaturan privasi.

Ringkasan singkat:
- Frontend statis: HTML, CSS, dan JavaScript
- Halaman dokumentasi & panduan bawaan
- Halaman konfigurasi provider untuk memasukkan API keys (ditampilkan di UI, sebaiknya tidak menyimpan kunci di repositori)

Daftar file penting:
- `index.html` — Halaman utama / dashboard
- `guide.html` — Panduan penggunaan
- `features.html` — Ringkasan fitur
- `library.html` — Template agen / library
- `provider-settings.html` — Pengaturan penyedia/model & API keys
- `settings.html` — Pengaturan aplikasi
- `privacy.html` — Kebijakan privasi
- `css/` — Stylesheet
- `js/` — Skrip JavaScript
- `CHANGELOG.md` — Riwayat perubahan

Bahasa kode (komposisi repo):
- JavaScript: 73.1%
- CSS: 14%
- HTML: 12.9%

Kenapa README ini berguna
- Menyediakan gambaran cepat untuk pengguna yang ingin mencoba aplikasi
- Menyediakan panduan singkat menjalankan secara lokal
- Menunjukkan lisensi proyek

Fitur utama
- Pembuatan dan manajemen agen berbasis template
- Dukungan konfigurasi beberapa penyedia model (via UI provider-settings)
- Halaman panduan, fitur, dan privasi yang memudahkan onboarding pengguna

Mulai (menjalankan secara lokal)
1. Clone repositori:

   git clone https://github.com/azrielspace852-wq/axion-ai-agents-app.git
   cd axion-ai-agents-app

2. Buka `index.html` langsung di browser atau jalankan server statis untuk menghindari isu CORS:

   - Dengan Python 3:

     python3 -m http.server 8000
     # buka http://localhost:8000

   - Dengan npm `serve`:

     npx serve .

   - Dengan `live-server`:

     npx live-server .

Konfigurasi & keamanan
- Gunakan `provider-settings.html` untuk menambahkan kunci API penyedia model. Jangan memasukkan kunci API ke repositori publik.
- Untuk penggunaan produksi, pertimbangkan backend/proxy yang aman untuk menyimpan kredensial.

Panduan pengembangan singkat
- Stylesheet ada di `css/` dan skrip di `js/` — ikuti pola folder yang ada.
- Tambahkan halaman baru ke `index.html` bila perlu, perbarui `docs/` jika ada dokumentasi tambahan.
- Untuk integrasi server-side, buat layanan terpisah dan jangan commit kredensial.

Contributing
Kontribusi diterima! Alur singkat:
1. Fork repository
2. Buat branch fitur: `git checkout -b feat/nama-fitur`
3. Commit perubahan: `git commit -am "Deskripsikan perubahan"`
4. Push dan buat Pull Request

Jika memungkinkan, sertakan deskripsi, screenshot, dan langkah reproduksi untuk bug.

Support & Issues
- Laporkan bug atau minta fitur melalui halaman Issues pada repository GitHub.

License
Proyek ini dilisensikan di bawah Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0).
Lihat file `LICENSE` untuk teks lengkap lisensi.

Kontak
- Pemilik: azrielspace852-wq
- Untuk pertanyaan teknis atau lisensi, buka issue di repository.

---

Terima kasih telah melihat Axion AI Agents App — semoga membantu Anda membuat dan mengelola agen AI dengan cepat.