# Buku Kas

Dashboard keuangan pribadi: utang kartu kredit, dana darurat, tiga skenario tempat tinggal, dan kalkulator makan. Semua angka bisa diedit langsung di browser dan tersimpan otomatis (localStorage), tidak dikirim ke server manapun.

## Cara deploy ke GitHub Pages

1. Buat repo baru di GitHub, misalnya `buku-kas`.
2. Upload tiga file ini ke root repo: `index.html`, `style.css`, `script.js` (dan `README.md` ini kalau mau).
   - Lewat web: buka repo → Add file → Upload files → drag ketiga file → Commit.
   - Lewat command line:
     ```
     git init
     git add .
     git commit -m "Initial commit"
     git branch -M main
     git remote add origin https://github.com/USERNAME/buku-kas.git
     git push -u origin main
     ```
3. Di repo, buka Settings → Pages.
4. Di bagian "Build and deployment", pilih Source: **Deploy from a branch**.
5. Pilih Branch: **main**, folder **/ (root)**, lalu Save.
6. Tunggu 1-2 menit, situsnya akan live di:
   `https://USERNAME.github.io/buku-kas/`

## Struktur file

- `index.html` — struktur halaman dan semua form input
- `style.css` — desain (tema ledger/buku kas, font Fraunces + Inter + IBM Plex Mono)
- `script.js` — semua logika hitungan, grafik (Chart.js), dan penyimpanan otomatis

## Catatan

- Bunga Mandiri dihitung pakai rumus amortisasi standar (saldo menurun), karena itu tidak dikonversi ke cicilan resmi bank.
- Bunga OVO/BRI dihitung flat (bunga dikali pokok dan tenor), sesuai skema cicilan resmi kartu kredit di Indonesia.
- Semua data tersimpan di localStorage browser kamu sendiri. Buka di browser/device lain = mulai dari default lagi.
