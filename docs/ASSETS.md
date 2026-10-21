# Panduan & Manifest Aset Visual Titanovore (Tahap 6A)

Dokumen ini menjelaskan arsitektur jalur aset (**Asset Pipeline**), daftar key tekstur, slot penempatan mutasi, arah hadap bawaan, serta petunjuk penggantian gambar untuk game **Titanovore**.

---

## 1. Arsitektur Jalur Aset (Asset Pipeline)

1. **Pendaftaran Tunggal**:
   Seluruh aset visual didaftarkan secara terpusat di [`src/assets/AssetManifest.js`](../src/assets/AssetManifest.js).
2. **Lokasi File Gambar**:
   Semua file gambar eksternal diletakkan di dalam folder `public/assets/` dengan struktur:
   - `public/assets/sprites/kaiju/`: Torso, kaki, segmen ekor, bayangan, dan jejak tapak.
   - `public/assets/sprites/mutations/`: Layer visual senjata & mutasi (Tier 1, 3, 5).
   - `public/assets/sprites/enemies/`: Tank, helikopter, drone, artileri, polisi, komando.
   - `public/assets/sprites/boss/`: Mech-Titan.
   - `public/assets/sprites/fx/`: Partikel, kilau laser, dan ledakan.
3. **Mekanisme Fallback Prosedural Otomatis**:
   - `BootScene` memuat aset dari manifest dengan layar muat berprogres sci-fi.
   - Jika suatu file gambar tidak ada di disk (404) atau gagal dimuat, sistem mencatat peringatan ke console (`console.warn`) dan **secara otomatis beralih ke generator prosedural** di [`src/utils/textureGenerator.js`](../src/utils/textureGenerator.js).
   - Game tidak akan crash dan tidak akan menampilkan kotak error hitam/ungu.
4. **Filter Pixel Art**:
   - Seluruh tekstur dipaksa menggunakan filter `NEAREST` (`imageSmoothingEnabled = false`).
   - Sprite dirender sangat tajam tanpa blur pada resolusi asli maupun saat diperbesar.

---

## 2. Cara Mengganti Sprite dengan Gambar Sungguhan

1. Siapkan file gambar berformat **PNG** transparan dengan resolusi yang disarankan.
2. Namai file persis sesuai nama key (misalnya `kaiju_body.png`).
3. Taruh file ke subfolder yang sesuai di `public/assets/sprites/...`.
4. Refresh browser (atau Vite hot reload). Tekstur baru akan langsung dimuat menggantikan placeholder prosedural tanpa perlu mengubah satu baris pun kode JavaScript!

### Orientasi Arah Hadap (Facing Direction)
- **Bawaan Engine (Phaser)**: Menghadap ke **KANAN** (sudut $0^\circ$ / 0 radian).
- **Jika gambar digambar menghadap ATAS**:
  Atur `facing: 'up'` dan `rotationOffset: Math.PI / 2` pada entri terkait di [`AssetManifest.js`](../src/assets/AssetManifest.js). Engine akan memutar sprite secara otomatis sehingga hadap visual selalu selaras dengan arah gerak 8-arah Kaiju.

---

## 3. Titik Tempel & Konfigurasi Slot Tubuh Kaiju

Setiap senjata/mutasi visual menempel pada slot anatomi Kaiju:

| Slot Nama | Titik Tempel (Anchor X, Y) | Kedalaman (Depth) | Rotasi / Aim Mandiri | Senjata yang Terhubung |
| :--- | :--- | :--- | :--- | :--- |
| `body` | `(0, 0)` | 15 (di atas bayangan & kaki) | Mengikuti tubuh | Cakar (Claw), Injakan (Quake Stomp), Perisai |
| `skin_overlay` | `(0, 0)` | 16 | Mengikuti tubuh | Kulit Listrik (Electric Skin), Duri Tubuh (Body Spikes) |
| `head_slot` | `(+22, 0)` | 17 | Mengikuti tubuh | Napas Api (Fire Breath), Mata Laser (Laser Eyes) |
| `back_slot` | `(-6, 0)` | 18 (di atas torso) | **Bisa berputar sendiri** ($\pm 37^\circ$) membidik musuh terdekat | Meriam Punggung (Back Cannon), Roket Punggung (Back Rockets) |
| `tail_slot` | `(-22, 0)` | 14 | Mengikuti kinematics ekor | Ekor Berduri (Spiked Tail, Gada Morningstar) |

> **Fitur Uji Coba Cepat**: Tekan tombol **[U]** di keyboard selama permainan untuk membuka **Inspektor Slot & Titik Tempel [U]**. Anda dapat melihat Kaiju diperbesar di tengah layar dengan garis titik tempel, mencoba semua variasi senjata tier 1-5, dan menyetel offset secara live!

---

## 4. Status Integrasi Aset (Tahap 6A)

- **Sudah Terhubung ke Jalur Aset (Dapat Diganti Gambar Nyata)**:
  - Seluruh sprite Kaiju (`kaiju_body`, `kaiju_walk`, `kaiju_foot`, `kaiju_shadow`, `kaiju_footprint`, `kaiju_tail_0..4`)
  - Seluruh 9 senjata mutasi pada tier 1, 3, dan 5 (total 27 variasi)
  - Seluruh 6 musuh militer dan Boss Mech-Titan
  - Efek partikel FX
- **Yang Sedang Aktif di Versi Ini**:
  - File PNG aktif di disk: `kaiju_shadow.png`, `kaiju_footprint.png` (841 bytes total).
  - Aset lainnya berjalan dengan **fallback prosedural 96x96 px berdefinisi tinggi** (desain Godzilla dengan rahang bersudut, leher tebal, 3 baris duri punggung neon, sisik bertekstur, mata menyala, dan animasi langkah 4-frame).
  - Pengembang atau seniman dapat menaruh file PNG kapan saja untuk menggantikan fallback tersebut.

---

## 5. Tabel Lengkap Manifest Aset & Ukuran yang Disarankan

| Key Tekstur | Kategori | Path File | Ukuran Sumber (px) | Frames | Pivot (X,Y) | Skala Display | Keterangan |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `kaiju_body` | kaiju | `assets/sprites/kaiju/kaiju_body.png` | 96 x 96 | 1 | (0.5, 0.5) | 0.625 (~60px) | Torso, leher, kepala, dan duri punggung Godzilla |
| `kaiju_walk` | kaiju | `assets/sprites/kaiju/kaiju_walk.png` | 96 x 96 | 4 | (0.5, 0.5) | 0.625 (~60px) | Siklus jalan 4 frame ayunan lengan & cakar |
| `kaiju_foot` | kaiju | `assets/sprites/kaiju/kaiju_foot.png` | 24 x 18 | 1 | (0.5, 0.5) | 1.000 | Kaki bercakar reptil untuk langkah bergantian |
| `kaiju_shadow` | kaiju | `assets/sprites/kaiju/kaiju_shadow.png` | 64 x 40 | 1 | (0.5, 0.5) | 1.000 | Bayangan elips tanah di bawah kaiju |
| `kaiju_footprint` | kaiju | `assets/sprites/kaiju/kaiju_footprint.png` | 18 x 14 | 1 | (0.5, 0.5) | 1.000 | Jejak tapak cakar di tanah/puing |
| `kaiju_tail_0` | kaiju | `assets/sprites/kaiju/kaiju_tail_0.png` | 32 x 32 | 1 | (0.5, 0.5) | 1.000 | Segmen ekor 0 (pangkal leher ekor) |
| `kaiju_tail_1` | kaiju | `assets/sprites/kaiju/kaiju_tail_1.png` | 28 x 28 | 1 | (0.5, 0.5) | 1.000 | Segmen ekor 1 |
| `kaiju_tail_2` | kaiju | `assets/sprites/kaiju/kaiju_tail_2.png` | 24 x 24 | 1 | (0.5, 0.5) | 1.000 | Segmen ekor 2 |
| `kaiju_tail_3` | kaiju | `assets/sprites/kaiju/kaiju_tail_3.png` | 20 x 20 | 1 | (0.5, 0.5) | 1.000 | Segmen ekor 3 |
| `kaiju_tail_4` | kaiju | `assets/sprites/kaiju/kaiju_tail_4.png` | 16 x 16 | 1 | (0.5, 0.5) | 1.000 | Segmen ekor 4 (ujung ekor cambuk) |
| `mutation_claw_1` | mutations | `assets/sprites/mutations/mutation_claw_1.png` | 96 x 96 | 1 | (0.5, 0.5) | 0.625 | Cakar Raptor Lv 1 |
| `mutation_claw_3` | mutations | `assets/sprites/mutations/mutation_claw_3.png` | 96 x 96 | 1 | (0.5, 0.5) | 0.625 | Cakar Zamrud Lv 3 |
| `mutation_claw_5` | mutations | `assets/sprites/mutations/mutation_claw_5.png` | 96 x 96 | 1 | (0.5, 0.5) | 0.625 | Cakar Sabit Giok Purba Lv 5 |
| `mutation_back_cannon_1` | mutations | `assets/sprites/mutations/mutation_back_cannon_1.png` | 64 x 64 | 1 | (0.5, 0.5) | 0.800 | Meriam Ganda Baja Lv 1 |
| `mutation_back_cannon_3` | mutations | `assets/sprites/mutations/mutation_back_cannon_3.png` | 64 x 64 | 1 | (0.5, 0.5) | 0.800 | Meriam Artileri Rifled Lv 3 |
| `mutation_back_cannon_5` | mutations | `assets/sprites/mutations/mutation_back_cannon_5.png` | 64 x 64 | 1 | (0.5, 0.5) | 0.800 | Baterai Railgun Plasma Lv 5 |
| `mutation_back_rockets_1` | mutations | `assets/sprites/mutations/mutation_back_rockets_1.png` | 64 x 64 | 1 | (0.5, 0.5) | 0.800 | Pod Roket Bahu Lv 1 |
| `mutation_back_rockets_3` | mutations | `assets/sprites/mutations/mutation_back_rockets_3.png` | 64 x 64 | 1 | (0.5, 0.5) | 0.800 | Quad Missile Laser-guided Lv 3 |
| `mutation_back_rockets_5` | mutations | `assets/sprites/mutations/mutation_back_rockets_5.png` | 64 x 64 | 1 | (0.5, 0.5) | 0.800 | Pod Roket Heksagonal Reaktif Lv 5 |
| `mutation_body_spikes_1` | mutations | `assets/sprites/mutations/mutation_body_spikes_1.png` | 96 x 96 | 1 | (0.5, 0.5) | 0.625 | Duri Rusuk Bertulang Lv 1 |
| `mutation_body_spikes_3` | mutations | `assets/sprites/mutations/mutation_body_spikes_3.png` | 96 x 96 | 1 | (0.5, 0.5) | 0.625 | Duri Karapas Kirmizi Lv 3 |
| `mutation_body_spikes_5` | mutations | `assets/sprites/mutations/mutation_body_spikes_5.png` | 96 x 96 | 1 | (0.5, 0.5) | 0.625 | Karapas Magma Behemoth Lv 5 |
| `mutation_fire_breath_1` | mutations | `assets/sprites/mutations/mutation_fire_breath_1.png` | 64 x 64 | 1 | (0.5, 0.5) | 0.800 | Tenggorokan Magma Lv 1 |
| `mutation_fire_breath_3` | mutations | `assets/sprites/mutations/mutation_fire_breath_3.png` | 64 x 64 | 1 | (0.5, 0.5) | 0.800 | Rahang Membara & Tanduk Lv 3 |
| `mutation_fire_breath_5` | mutations | `assets/sprites/mutations/mutation_fire_breath_5.png` | 64 x 64 | 1 | (0.5, 0.5) | 0.800 | Tanduk Naga Api Neraka Lv 5 |
| `mutation_laser_eyes_1` | mutations | `assets/sprites/mutations/mutation_laser_eyes_1.png` | 64 x 64 | 1 | (0.5, 0.5) | 0.800 | Implan Okular Merah Lv 1 |
| `mutation_laser_eyes_3` | mutations | `assets/sprites/mutations/mutation_laser_eyes_3.png` | 64 x 64 | 1 | (0.5, 0.5) | 0.800 | Lensa Delima Berpijar Lv 3 |
| `mutation_laser_eyes_5` | mutations | `assets/sprites/mutations/mutation_laser_eyes_5.png` | 64 x 64 | 1 | (0.5, 0.5) | 0.800 | Sinar Kematian Fototermal Lv 5 |
| `mutation_quake_stomp_1` | mutations | `assets/sprites/mutations/mutation_quake_stomp_1.png` | 96 x 96 | 1 | (0.5, 0.5) | 0.625 | Plat Dada Tektonik Lv 1 |
| `mutation_quake_stomp_3` | mutations | `assets/sprites/mutations/mutation_quake_stomp_3.png` | 96 x 96 | 1 | (0.5, 0.5) | 0.625 | Fisura Vulkanik Perut Lv 3 |
| `mutation_quake_stomp_5` | mutations | `assets/sprites/mutations/mutation_quake_stomp_5.png` | 96 x 96 | 1 | (0.5, 0.5) | 0.625 | Inti Seismik Vulkanik Pijar Lv 5 |
| `mutation_spiked_tail_1` | mutations | `assets/sprites/mutations/mutation_spiked_tail_1.png` | 24 x 24 | 1 | (0.5, 0.5) | 1.000 | Duri Ujung Ekor Tulang Lv 1 |
| `mutation_spiked_tail_3` | mutations | `assets/sprites/mutations/mutation_spiked_tail_3.png` | 32 x 32 | 1 | (0.5, 0.5) | 1.000 | Bilah Ekor Samping Baja Lv 3 |
| `mutation_spiked_tail_5` | mutations | `assets/sprites/mutations/mutation_spiked_tail_5.png` | 32 x 32 | 1 | (0.5, 0.5) | 1.000 | Gada Morningstar Berduri Obsidian Lv 5 |
| `kaiju_electric_skin_0` | mutations | `assets/sprites/mutations/kaiju_electric_skin_0.png` | 96 x 96 | 1 | (0.5, 0.5) | 0.625 | Busur Listrik Frame 0 |
| `kaiju_electric_skin_1` | mutations | `assets/sprites/mutations/kaiju_electric_skin_1.png` | 96 x 96 | 1 | (0.5, 0.5) | 0.625 | Busur Listrik Frame 1 |
| `kaiju_electric_skin_2` | mutations | `assets/sprites/mutations/kaiju_electric_skin_2.png` | 96 x 96 | 1 | (0.5, 0.5) | 0.625 | Busur Listrik Frame 2 |
| `energy_shield_bubble` | mutations | `assets/sprites/mutations/energy_shield_bubble.png` | 80 x 80 | 1 | (0.5, 0.5) | 1.000 | Kubah Pelindung Energi Berputar |
| `enemy_tank` | enemies | `assets/sprites/enemies/enemy_tank.png` | 28 x 18 | 1 | (0.5, 0.5) | 1.000 | Tank Tempur Militer |
| `enemy_helicopter` | enemies | `assets/sprites/enemies/enemy_helicopter.png` | 32 x 32 | 1 | (0.5, 0.5) | 1.000 | Helikopter Serang Apache |
| `enemy_drone` | enemies | `assets/sprites/enemies/enemy_drone.png` | 16 x 16 | 1 | (0.5, 0.5) | 1.000 | Drone Kamikaze Cepat |
| `enemy_artillery` | enemies | `assets/sprites/enemies/enemy_artillery.png` | 32 x 20 | 1 | (0.5, 0.5) | 1.000 | Howitzer Artileri Bergerak |
| `enemy_police` | enemies | `assets/sprites/enemies/enemy_police.png` | 18 x 10 | 1 | (0.5, 0.5) | 1.000 | Mobil Polisi Patroli |
| `enemy_commando` | enemies | `assets/sprites/enemies/enemy_commando.png` | 12 x 12 | 1 | (0.5, 0.5) | 1.000 | Prajurit Komando Elit |
| `boss_mech_titan` | boss | `assets/sprites/boss/boss_mech_titan.png` | 72 x 72 | 1 | (0.5, 0.5) | 1.000 | Robot Pertahanan Mech-Titan |
| `fx_laser_glow` | fx | `assets/sprites/fx/fx_laser_glow.png` | 32 x 32 | 1 | (0.5, 0.5) | 1.000 | Pijar Laser Okular |
| `fx_glow_light_64` | fx | `assets/sprites/fx/fx_glow_light_64.png` | 64 x 64 | 1 | (0.5, 0.5) | 1.000 | Radial Additive Ground Light (64px) |
| `fx_glow_light_32` | fx | `assets/sprites/fx/fx_glow_light_32.png` | 32 x 32 | 1 | (0.5, 0.5) | 1.000 | Radial Additive Ground Light (32px) |
| `fx_muzzle_flash` | fx | `assets/sprites/fx/fx_muzzle_flash.png` | 24 x 16 | 1 | (0.5, 0.5) | 1.000 | Kilatan Moncong Turret/Roket |
| `fx_shockwave_ring` | fx | `assets/sprites/fx/fx_shockwave_ring.png` | 64 x 64 | 1 | (0.5, 0.5) | 1.000 | Cincin Kejut Ledakan & Injakan |
| `fx_smoke_puff` | fx | `assets/sprites/fx/fx_smoke_puff.png` | 16 x 16 | 1 | (0.5, 0.5) | 1.000 | Kepulan Asap Roket & Kerusakan HP Rendah |

---

## 6. Efek Senjata Bercahaya & Sistem Kualitas (Tahap 6B)

1. **Additive Blend Light Pools**:
   - Seluruh kolam cahaya senjata (ledakan roket, semburan napas api, laser okular, injakan getar, dan petir) menggunakan `Phaser.BlendModes.ADD` pada satu kedalaman tetap (depth 11.5) dengan pre-allocated pool (`LightPoolManager`), sehingga **tanpa fullscreen shader / bloom filter yang membebani GPU**.
   - Kolam cahaya memudar halus dan langsung didaur ulang ke pool (zero GC).
2. **Keterbacaan Medan Pertempuran (Readability)**:
   - Glow dibatasi kecerahan dan radiusnya agar tidak menutupi musuh maupun peluru musuh. Proyektil dan retikel peringatan musuh tetap kontras dengan garis tepi gelap.
3. **Reaksi Kerusakan & Animasi Tubuh Kaiju**:
   - **Kerusakan HP Rendah (< 30%)**: Muncul celah magma merah menyala berdenyut di torso kaiju dan kepulan asap tipis berkala.
   - **Hit Reaction**: Kedip merah (`0xff3333`) saat terkena serangan musuh.
   - **Turret Recoil & Muzzle Flash**: Laras turret meriam punggung mundur 5px saat menembak dan memunculkan kilatan moncong bercahaya biru, lalu kembali ke posisi awal.
   - **Bobbing Langkah**: Layer tubuh bergerak halus sinkron dengan langkah kaki saat berjalan.
   - **Efek Fusi Evolusi**: Saat senjata berevolusi, semburan percikan partikel ungu/biru, kolam cahaya fusi, dan getaran layar mikro terpicu.
4. **Tingkatan Kualitas Efek**:
   - `tinggi` (default desktop): 100% partikel, 40 active light pools, efek smoke trail penuh.
   - `sedang`: 70% partikel, 24 active light pools, glow alpha sedikit dikurangi.
   - `rendah`: 40% partikel, 12 active light pools, mematikan smoke trail ringan (optimal untuk perangkat mobile/low-end).
5. **Tombol Debug Tambahan**:
   - **[B]**: Memberi semua senjata pada Lv 5 sekaligus (berputar antara 3 set: Frontline Heavy Artillery, Bio-Electric Spiked Fortress, dan Synergy Evolution Showcase).
   - **[V]**: Menukar kualitas efek antara `tinggi` -> `sedang` -> `rendah` -> `tinggi` dengan notifikasi banner di layar.
   - *Cara menghapus tombol debug nanti*: Cukup hapus listener `keydown-B` dan `keydown-V` di method `setupDebugKeys()` pada [`src/scenes/GameScene.js`](../src/scenes/GameScene.js).

---

## 7. Laporan Ukuran & Performa
- **Ukuran Total Aset Gambar Saat Ini di Disk**: ~841 bytes (Target < 5.0 MB terpenuhi dengan sangat baik).
- **Alokasi Memori Tekstur (VRAM)**: Terkelola bersih dalam Phaser Texture Manager. Pengecekan `textures.exists` mencegah duplikasi atau kebocoran memori saat pergantian scene maupun saat bangkit kembali berulang kali.
- **FPS Target**: Tetap stabil di kisaran **58-60 FPS** pada pertempuran penuh Siaga 5 dengan 6 senjata aktif Level 5 dan 2 senjata evolusi.
