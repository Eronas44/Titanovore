# Titanovore - Tahap 2B (Penghancuran Gedung & Fisika Kerusakan)

Game browser 2D top-down (pandangan atas) menggunakan Phaser 3 + Vite. Tahap 2B mengimplementasikan sistem penghancuran dinamis saat Kaiju melangkah dan menyapu ekornya melintasi gedung-gedung kota, gelombang keruntuhan bangunan, hambatan inersia bobot (*slowdown*), partikel puing & debu, manusia panik melarikan diri, mobil penyok, serta HUD telemetri kehancuran pada 60 FPS stabil.

---

## Yang Baru di Tahap 2B

1. **Penghancuran oleh Tubuh & Ekor Kaiju**:
   - Sel gedung (4x4 px) di bawah telapak tubuh elips Kaiju menerima damage saat Kaiju melangkah/bergerak.
   - Damage dipengaruhi oleh ukuran Kaiju (`currentScale`) dan kecepatan gerak (`currentSpeed`).
   - Ekor yang menyapu di belakang Kaiju menghasilkan damage sekunder dengan radius melingkar di setiap segmen.
   - **Rasa Bobot & Hambatan (*Slowdown*)**: Saat melindas struktur padat (seperti pencakar langit), Kaiju mengalami perlambatan dinamis (maksimal 25%, dapat diatur di config) dan sedikit demi sedikit pulih saat keluar dari reruntuhan.

2. **Runtuh Gedung Spektakuler (Top-Down)**:
   - Setiap gedung memiliki penghitung integritas sel hidup. Jika lebih dari 45% selnya hancur (atau sel pusat gedung hancur), gedung mengalami **keruntuhan total**:
     - Sisa atap pecah serentak dalam **gelombang cincin dari episentrum ke luar** (animasi bertahap ~0.5 detik).
     - **Debu & Puing Proporsional**: Gedung yang lebih tinggi membubungkan awan debu lebih tebal dan menghamburkan puing lebih luas.
     - **Debris Splash**: Puing yang jatuh menimpa dan menghancurkan mobil serta manusia di sekitar gedung.
     - **Guncangan & Retakan Pencakar Langit**: Gedung tinggi (tingkat >= 8) menghasilkan *hitstop* sangat singkat (~65ms freeze frame), kilatan cahaya oranye, retakan retak pada aspal jalan di sekitarnya, dan gelombang kejut (*shockwave*) yang meretakkan gedung-gedung kecil di dekatnya.

3. **Partikel Efisien & Zero GC (Object Pools)**:
   - **Debris Shards Pool (Maks 600)**: Pecahan partikel pixel warna-warni yang mewarisi warna asli atap gedung (`baseColor`).
   - **Dust Clouds Pool (Maks 150)**: Awan debu abu-abu kecokelatan yang mengembang dan memudar secara halus.
   - **Blood & Sparks Pool (Maks 50)**: Percikan merah gelap saat manusia terinjak dan kilatan api saat mobil/menara hancur.
   - Sel yang hancur diganti menjadi tekstur **puing gelap bertekstur (*rubble*)** pada kanvas chunk yang tetap dapat dilewati secara bebas.
   - **Dirty Rect Chunk Refresh Budget**: Pembaruan tekstur chunk dibatasi beberapa chunk per frame agar tidak terjadi stuttering/lag saat meratakan satu blok penuh.

4. **Reaksi Manusia & Mobil**:
   - Manusia panik dan **berlari menjauh** (*panic flee*) dengan kecepatan lari 2.2x saat Kaiju mendekat (jarak < 110 px).
   - Manusia yang terinjak tubuh atau ekor Kaiju mati dengan percikan kecil dan menambah skor eliminasi & XP.
   - Mobil yang terinjak atau tertimpa runtuhan menjadi penyok/remuk, berhenti melaju, dan mengeluarkan percikan debu/api.

5. **HUD Telemetri Kehancuran**:
   - Menampilkan persentase kehancuran kota (`DESTRUCTION: XX.X%`).
   - Counter jumlah gedung hancur (`BUILDINGS: N`).
   - Counter manusia tereliminasi (`KILLS: N`).
   - Total XP terkumpul (`XP: N`).
   - Skala Kaiju saat ini (`SCALE: X.Xx`).
   - FPS & jumlah chunk aktif.

6. **Tombol Debug Sementara**:
   - **F**: Memperbesar skala Kaiju secara bertahap (+0.3x hingga 3.0x) untuk menguji penghancuran skala masif.
   - **R**: Mengatur ulang seluruh kota secara bersih (*clean reset*): tekstur chunk lama dihapus dari memori, pool partikel direset, dan kota digenerate ulang dari seed yang sama dalam kondisi utuh.

---

## Kontrol Permainan

| Tombol | Fungsi |
| :--- | :--- |
| **W, A, S, D** / **Panah** | Gerak Kaiju 8 arah (menghancurkan gedung saat melangkah) |
| **E** | Menyalakan / mematikan layer **"Kulit Listrik"** |
| **F** | *(Debug)* Memperbesar ukuran Kaiju secara bertahap (+0.3x hingga 3.0x) |
| **R** | *(Debug)* Mengatur ulang kota & Kaiju (*Clean Reset*) |
| **1, 2, 3, 4** | *(Debug)* Teleportasi cepat ke distrik (1: Downtown, 2: Residential, 3: Industrial, 4: Park/Canal) |
| **F3** | Menampilkan / menyembunyikan HUD telemetri |

---

## Parameter Konfigurasi yang Dapat Diubah

Semua angka tuning terpusat di `src/config/`:

### 1. `src/config/game.js`
- **Damage & Trampling**:
  - `destruction.bodyDamageBase` (default `3.5`): Besaran damage dasar per injakan ke sel 4x4 px di bawah telapak Kaiju.
  - `destruction.bodySpeedMultiplier` (default `0.03`): Pengali damage tambahan berdasarkan kecepatan gerak Kaiju.
  - `destruction.tailDamageMultiplier` (default `0.55`): Rasio damage sapuan ekor terhadap damage tubuh.
  - `destruction.trampleTickInterval` (default `45`): Interval pemeriksaan injakan (milidetik).
- **Hambatan & Perlambatan (*Slowdown*)**:
  - `destruction.maxSlowdownPercent` (default `0.25`): Persentase perlambatan kecepatan maksimal (25%) saat Kaiju menerobos gedung padat.
  - `destruction.slowdownRecoveryRate` (default `1.8`): Kecepatan Kaiju memulihkan kecepatannya kembali normal setelah keluar dari reruntuhan.
- **Screen Shake & Hitstop**:
  - `destruction.trampleShakeIntensity` (default `0.0016`): Getaran mikro saat menginjak gedung.
  - `destruction.collapseShakeIntensityBase` (default `0.006`): Kekuatan guncangan dasar saat gedung runtuh (dikalikan dengan ketinggian gedung).
  - `destruction.hitstopDurationMs` (default `65`): Durasi freeze frame saat gedung pencakar langit runtuh.
- **Batas Pool Partikel**:
  - `destruction.maxDebrisParticles` (default `600`): Batas maksimal pecahan puing aktif.
  - `destruction.maxDustParticles` (default `150`): Batas maksimal awan debu aktif.
  - `destruction.maxBloodSparks` (default `50`): Batas maksimal percikan manusia/mobil.
- **Kepanikan Manusia**:
  - `destruction.humanFleeDistance` (default `110`): Jarak deteksi di mana manusia mulai panik dan lari menjauh.
  - `destruction.humanFleeSpeedMultiplier` (default `2.2`): Pengali kecepatan sprint manusia saat panik.

### 2. `src/config/world.js`
- **Ketahanan Gedung (*Cell HP*)**:
  - `cellHpByType.residentialHouse` (default `1`): HP atap rumah kecil (langsung pecah dalam 1 injakan).
  - `cellHpByType.commercialRuko` (default `2`): HP sel ruko komersial.
  - `cellHpByType.officeBlock` (default `3`): HP sel gedung kantor.
  - `cellHpByType.downtownTower` (default `4`): HP sel pencakar langit beton/baja.
- **Ambang Runtuh (*Collapse Threshold*)**:
  - `collapseThreshold` (default `0.45`): Batas persentase kerusakan (45%) di mana sisa gedung akan runtuh total secara serentak.
- **Sebaran Puing Runtuhan**:
  - `debrisSpreadRadiusFactor` (default `1.3`): Jarak percikan puing runtuhan keluar gedung menimpa mobil dan pejalan kaki.
- **Anggaran Refresh Chunk**:
  - `maxDirtyChunkUpdatesPerFrame` (default `4`): Batas maksimal chunk kanvas yang di-refresh ke GPU per frame untuk menjaga kelancaran 60 FPS tanpa stutter.

---

## Cara Menghapus Tombol Debug & HUD Nanti

Buka file [src/scenes/GameScene.js](file:///d:/work/AI/EronasProject/Project/Active/Titanovore%20top%20down/src/scenes/GameScene.js):
1. **Menghapus Debug Keys (F, R, 1-4)**:
   Hapus atau komentari pemanggilan `this.setupDebugKeys();` di dalam method `create()`.
2. **Menghapus HUD**:
   Hapus pemanggilan `this.setupHUD();` di `create()` dan `this.updateHUD();` di `update()`.
