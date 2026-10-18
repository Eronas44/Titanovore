# Titanovore - Tahap 1 (Fondasi)

Game browser 2D top-down (pandangan atas) menggunakan Phaser 3 + Vite. Menampilkan monster raksasa (Kaiju) dengan arsitektur layer modular, pergerakan dengan inersia berat, ekor bersambung dengan kinematika lentur, kota prosedural berbasis chunk canvas texture, dan simulasi pejalan kaki & kendaraan hiasan pada 60 FPS.

---

## Cara Menjalankan

1. Pastikan Node.js sudah terpasang.
2. Buka terminal di folder proyek:
   ```bash
   npm install
   ```
3. Jalankan development server:
   ```bash
   npm run dev
   ```
4. Buka browser pada URL yang muncul di terminal (biasanya `http://localhost:5173/` atau `http://127.0.0.1:5173/`).

---

## Kontrol Permainan

- **W / A / S / D** atau **Tombol Panah**: Menggerakkan Kaiju ke 8 arah (dengan akselerasi berat, inersia gesekan, dan rotasi terinterpolasi halus).
- **E**: Menyalakan / mematikan layer contoh **"Kulit Listrik"** (`skin_overlay`) untuk menguji sistem slot layer modular.
- **F3**: Menampilkan / menyembunyikan HUD minimal (FPS, jumlah chunk aktif).

---

## Struktur Proyek

```
Titanovore top down/
├── index.html
├── package.json
├── src/
│   ├── main.js                  # Entry point game Phaser 3
│   ├── config/
│   │   ├── palette.js           # Definisi palet warna pixel art gelap & dramatis
│   │   ├── game.js              # Tuning Kaiju, kamera, dan kontrol
│   │   └── world.js             # Ukuran dunia, grid cell 4x4, chunk, densitas, seed, crowd
│   ├── entities/
│   │   ├── Kaiju.js             # Entitas Kaiju (layer modular, ekor multi-segmen, inersia)
│   │   └── Crowd.js             # 400 pejalan kaki + 40 mobil (frustum culled, tanpa physics body)
│   ├── world/
│   │   ├── CityGrid.js          # TypedArray 4x4 px grid & fast spatial queries (getCellAt, getBuildingsInRect)
│   │   ├── CityGenerator.js     # Generator kota prosedural deterministik (jalan, gedung, taman, parkir)
│   │   └── ChunkRenderer.js     # Renderer chunk 256x256 px progresif ke CanvasTexture & culling
│   ├── scenes/
│   │   ├── BootScene.js         # Generator tekstur prosedural in-memory & scene loader
│   │   └── GameScene.js         # Orkestrasi gameplay utama, kamera, dan HUD
│   └── utils/
│       ├── prng.js              # Seeded PRNG Mulberry32 untuk kota reproducible
│       └── textureGenerator.js  # Generator tekstur pixel art via kode (tanpa asset gambar luar)
```

---

## Konfigurasi yang Dapat Diubah

Semua angka dan parameter tuning terpusat di folder `src/config/`:

### 1. `src/config/game.js`
- **Kecepatan & Inersia Kaiju**:
  - `kaiju.maxSpeed` (default `105`): Kecepatan gerak maksimum Kaiju dalam px/detik.
  - `kaiju.acceleration` (default `300`): Tingkat akselerasi saat tombol arah ditekan.
  - `kaiju.drag` (default `260`): Gesekan/dekselerasi ketika tombol dilepas.
  - `kaiju.turnSpeed` (default `0.14`): Kecepatan interpolasi rotasi Kaiju menghadap arah gerak.
  - `kaiju.stepShakeIntensity` (default `0.0018`): Kekuatan screen shake tiap langkah kaki.
- **Ekor Kaiju**:
  - `kaiju.tail.segmentCount` (default `5`): Jumlah segmen ekor yang mengikuti gerakan.
  - `kaiju.tail.followSpeed` (default `0.22`): Kecepatan delay ekor mengikuti segmen depannya.
  - `kaiju.tail.swayAmplitude` (default `0.12`): Amplitudo goyangan ekor saat diam/berjalan.
- **Kamera & Zoom**:
  - `camera.initialZoom` (default `1.6`): Faktor zoom awal (membuat kaiju terlihat besar dan kota terasa padat).
  - `camera.followLerpX` & `followLerpY` (default `0.08`): Kehalusan kamera mengikuti Kaiju.

### 2. `src/config/world.js`
- **Seed Kota**:
  - `seed` (default `948271`): Ubah angka ini untuk mengubah tata letak seluruh kota secara deterministik.
- **Ukuran Dunia**:
  - `worldWidth` (default `4000`) & `worldHeight` (default `4000`): Dimensi pixel dunia.
- **Kepadatan Kota (Zonasi)**:
  - `downtownRadius` (default `900`): Radius pusat kota padat dengan gedung tinggi dan helipad.
  - `midtownRadius` (default `1550`): Radius zona menengah dengan gedung sedang dan taman.
  - `suburbRadius` (default `2000`): Wilayah pinggiran dengan rumah kecil dan halaman luas.
- **Jumlah Pejalan Kaki & Kendaraan**:
  - `pedestrianCount` (default `400`): Jumlah manusia yang berkeliaran di jalan dan taman.
  - `carCount` (default `40`): Jumlah mobil yang bergerak di jalan raya.
- **Performa Chunking**:
  - `chunkSize` (default `256`): Ukuran tiap chunk tekstur dalam pixel (256x256 px).
  - `chunksPerFrame` (default `2`): Jumlah chunk yang di-render per frame saat memuat area baru secara progresif agar frame rate tidak drop.

---

## Cara Menghapus HUD (Untuk Produksi / Fase Lanjutan)

Buka file [GameScene.js](file:///d:/work/AI/EronasProject/Project/Active/Titanovore%20top%20down/src/scenes/GameScene.js):
1. Hapus atau beri komentar baris:
   ```javascript
   this.setupHUD();
   ```
   pada method `create()`.
2. Hapus atau beri komentar baris:
   ```javascript
   this.updateHUD();
   ```
   pada method `update()`.
3. (Opsional) Hapus baris pengaturan `hud` di [src/config/game.js](file:///d:/work/AI/EronasProject/Project/Active/Titanovore%20top%20down/src/config/game.js).
