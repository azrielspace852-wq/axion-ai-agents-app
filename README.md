# Axion AI Agents App

Axion AI Agents App adalah aplikasi web frontend untuk membuat, mengelola, dan menjalankan "AI Agents" (agen pintar) yang terhubung ke penyedia model (provider) berbeda. Repositori ini berisi antarmuka HTML/CSS/JS, dokumentasi dasar, dan halaman pengaturan untuk mengonfigurasi provider, privasi, serta fitur-fitur aplikasi.

> Catatan: README ini disusun berdasarkan isi repositori (index.html, guide.html, features.html, provider-settings.html, settings.html, library.html, privacy.html, folder `css/` dan `js/`). Sesuaikan bagian-bagian konfigurasi atau lisensi jika diperlukan.

## Fitur utama

- Halaman beranda dan dashboard (index.html)
- Panduan penggunaan (guide.html)
- Deskripsi fitur (features.html)
- Perpustakaan agen / template (library.html)
- Pengaturan penyedia model / API keys (provider-settings.html)
- Pengaturan aplikasi (settings.html)
- Kebijakan privasi (privacy.html)
- Berkas statis: `css/` dan `js/`

## Struktur proyek

- index.html                — Halaman utama aplikasi
- guide.html                — Panduan penggunaan
- features.html             — Daftar dan penjelasan fitur
- library.html              — Kumpulan template agen / library
- provider-settings.html    — Halaman untuk mengatur provider dan API keys
- settings.html             — Pengaturan aplikasi
- privacy.html              — Halaman kebijakan privasi
- css/                      — Stylesheet
- js/                       — Skrip JavaScript
- docs/                     — Dokumentasi tambahan (jika ada)
- CHANGELOG.md              — Riwayat perubahan

## Cara menjalankan (pengguna)

Karena proyek ini berupa aplikasi web statis (HTML/CSS/JS), Anda dapat menjalankannya dengan cara sederhana:

1. Clone repositori:

   git clone https://github.com/azrielspace852-wq/axion-ai-agents-app.git
   cd axion-ai-agents-app

2. Buka langsung di browser: buka `index.html`.

   atau jalankan server lokal statis (direkomendasikan untuk menghindari pembatasan CORS saat memakai API secara lokal):

   - Dengan Python 3:

     python3 -m http.server 8000
     # lalu buka http://localhost:8000

   - Dengan npm `serve`:

     npx serve .

   - Dengan `live-server`:

     npx live-server .

## Konfigurasi dan Pengaturan

- Buka `provider-settings.html` untuk menambahkan atau mengubah kunci API penyedia model (mis. OpenAI, Anthropic, atau penyedia lain yang didukung oleh aplikasi ini). Ikuti panduan di halaman tersebut.
- Gunakan `settings.html` untuk preferensi aplikasi (tema, bahasa, dan opsi lain yang disediakan UI).
- Perhatikan `privacy.html` untuk informasi terkait pengumpulan data dan penggunaan API.

Catatan keamanan: Jangan menyimpan kunci API sensitif langsung di repositori publik. Gunakan mekanisme yang aman (environment variables, vault, atau server-proxy) jika menghubungkan ke backend.

## Pengembangan

Jika Anda ingin mengembangkan atau menambahkan fitur:

1. Pastikan struktur folder rapi: letakkan stylesheet di `css/` dan skrip di `js/`.
2. Jika menambahkan halaman baru, tautkan pada `index.html` dan update `docs/` jika perlu.
3. Untuk integrasi backend atau server-side, buat folder/layanan terpisah dan jangan commit kredensial.

## Testing

Repositori saat ini tidak menyertakan suite testing otomatis. Untuk pengujian manual, buka aplikasi di browser dan ikuti panduan pada `guide.html`.

## Contributing

Kontribusi sangat diterima! Silakan buka issue atau kirim pull request dengan deskripsi perubahan yang jelas.

Panduan singkat:
1. Fork repositori
2. Buat branch fitur: `git checkout -b feat/nama-fitur`
3. Commit perubahan: `git commit -am "Deskripsi perubahan"`
4. Push dan buat pull request

## Issues & Support

Gunakan halaman Issues di GitHub untuk melaporkan bug, meminta fitur, atau menanyakan penggunaan.

## Changelog

Lihat `CHANGELOG.md` untuk riwayat perubahan.

## Lisensi

Repositori ini belum menyertakan berkas `LICENSE` (periksa root repositori). Tambahkan lisensi yang sesuai (mis. MIT, Apache-2.0) jika Anda ingin membagikan kode secara resmi.

## Penulis dan Kontak

Repo ini dimiliki oleh: azrielspace852-wq

Jika ada pertanyaan tentang proyek ini, buka issue atau hubungi pemilik repositori.

---

Terima kasih sudah melihat Axion AI Agents App — semoga membantu memulai atau mengembangkan agen AI Anda sendiri.