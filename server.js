import express from 'express';
import mysql from 'mysql2';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'eduadapt'
});

db.connect((err) => {
    if (err) {
        console.error('Gagal terkoneksi ke database MariaDB:', err);
        return;
    }
    console.log('Berhasil terhubung ke database MariaDB (eduadapt).');
});

// =======================================================
// ROUTE LOGIN (DISESUAIKAN DENGAN FRONTEND ANDA)
// =======================================================
// =======================================================
// ROUTE LOGIN (DENGAN BACKUP OTOMATIS JIKA ROLE KOSONG)
// =======================================================
app.post('/api/auth/login', (req, res) => {
    let { username, password, role } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: true, message: 'Username dan password wajib diisi!' });
    }

    // BACKUP OTOMATIS: Jika role dari frontend kosong/tidak terbaca
    if (!role) {
        if (username.toLowerCase().includes('guru')) {
            role = 'guru';
        } else {
            role = 'siswa';
        }
    }

    // Query mencocokkan kredensial di tabel user
    const queryLogin = `SELECT id, username, nama_lengkap, role FROM user WHERE username = ? AND password = ? AND role = ?`;

    db.query(queryLogin, [username, password, role], (err, results) => {
        if (err) {
            console.error("Error pada query login:", err);
            return res.status(500).json({ error: true, message: 'Terjadi kesalahan pada server database.' });
        }

        if (results.length === 0) {
            return res.status(401).json({ error: true, message: 'Gagal masuk. Periksa kembali username dan password Anda.' });
        }

        return res.status(200).json({
            success: true,
            message: 'Login Berhasil!',
            user: results[0]
        });
    });
});

// =======================================================
// ROUTE REGISTRATION (TAMBAHAN AKUN BARU)
// =======================================================
app.post('/api/register', (req, res) => {
    const { username, password, nama_lengkap, role, kelas_id, nisn } = req.body;

    if (!username || !password || !nama_lengkap || !role) {
        return res.status(400).json({ error: true, message: 'Data pendaftaran belum lengkap!' });
    }

    const queryUser = `INSERT INTO user (username, password, nama_lengkap, role, created_at) VALUES (?, ?, ?, ?, NOW())`;

    db.query(queryUser, [username, password, nama_lengkap, role], (err, resultUser) => {
        if (err) {
            console.error("Gagal insert ke tabel user:", err);
            return res.status(500).json({ error: true, message: 'Username sudah terpakai atau error database.' });
        }

        if (role === 'siswa') {
            const querySiswa = `INSERT INTO siswa (user_id, kelas_id, nisn, level_adaptif) VALUES (?, ?, ?, 'mudah')`;
            const targetKelas = kelas_id || 1;
            const targetNisn = nisn || '12345678';

            db.query(querySiswa, [resultUser.insertId, targetKelas, targetNisn], (errSiswa) => {
                if (errSiswa) {
                    console.error("Gagal insert ke tabel siswa:", errSiswa);
                    return res.status(500).json({ error: true, message: 'Akun user dibuat, tapi gagal memicu data siswa.' });
                }
                return res.status(201).json({ success: true, message: 'Registrasi Akun Siswa Berhasil!' });
            });
        } else {
            return res.status(201).json({ success: true, message: 'Registrasi Akun Guru Berhasil!' });
        }
    });
});

// =======================================================
// ROUTE SISWA: UPDATE LEVEL ADAPTIF
// =======================================================
app.put('/api/siswa/update-level', async (req, res) => {
    res.status(200).json({ message: "Level berhasil diperbarui di database." });
});

// =======================================================
// ROUTE GURU: MENGAMBIL DATA MONITORING MURNI DARI DATABASE
// =======================================================
app.get('/api/guru/monitoring', (req, res) => {
    const queryMurni = `
        SELECT 
        u.id, 
        u.username, 
        u.nama_lengkap, 
        u.role,
        IFNULL(s.level_adaptif, 'mudah') AS level,
        0 AS skor_terakhir, 
        'Selesai' AS status
        FROM user u
        LEFT JOIN siswa s ON u.id = s.user_id
        WHERE u.role = 'siswa'
    `;

    db.query(queryMurni, (err, results) => {
        if (err) {
            console.error("Gagal mengambil data murni database:", err);
            return res.status(500).json({ 
                error: true, 
                message: "Terjadi kesalahan pada query database SQL Anda." 
            });
        }
        res.json(results);
    });
});

// =======================================================
// JALANKAN SERVER
// =======================================================
const PORT = process.env.PORT || 5000;

// =======================================================
// ROUTE GURU: CRUD MATERI PEMBELAJARAN
// =======================================================
// Tambahkan blok ini ke file server utama (index.js / server.js)
// setelah route '/api/guru/monitoring'

// Struktur tabel `materi` (sudah ada di database):
// id (INT, AUTO_INCREMENT, PK)
// mapel_id (INT)
// judul_materi (VARCHAR 150)
// konten_teks (TEXT, nullable)
// url_media (VARCHAR 255, nullable)
// tingkat_kesulitan (ENUM 'mudah','sedang','sulit')

// ---------- GET semua materi (bisa difilter berdasarkan mapel_id) ----------
app.get('/api/materi', (req, res) => {
    const { mapel_id } = req.query;

    let query = `
        SELECT m.id, m.mapel_id, m.judul_materi, m.konten_teks, m.url_media, m.tingkat_kesulitan,
               mp.nama_mapel
        FROM materi m
        LEFT JOIN mata_pelajaran mp ON m.mapel_id = mp.id
    `;
    const params = [];

    if (mapel_id) {
        query += ' WHERE m.mapel_id = ?';
        params.push(mapel_id);
    }

    query += ' ORDER BY m.id DESC';

    db.query(query, params, (err, results) => {
        if (err) {
            console.error("Gagal mengambil data materi:", err);
            return res.status(500).json({ error: true, message: 'Terjadi kesalahan pada query database materi.' });
        }
        res.json(results);
    });
});

// ---------- GET daftar mata pelajaran (untuk dropdown form) ----------
app.get('/api/mata-pelajaran', (req, res) => {
    db.query('SELECT id, nama_mapel FROM mata_pelajaran ORDER BY nama_mapel ASC', (err, results) => {
        if (err) {
            console.error("Gagal mengambil data mata pelajaran:", err);
            return res.status(500).json({ error: true, message: 'Terjadi kesalahan pada query mata pelajaran.' });
        }
        res.json(results);
    });
});

// ---------- GET satu materi berdasarkan id ----------
app.get('/api/materi/:id', (req, res) => {
    const { id } = req.params;

    db.query('SELECT * FROM materi WHERE id = ?', [id], (err, results) => {
        if (err) {
            console.error("Gagal mengambil materi:", err);
            return res.status(500).json({ error: true, message: 'Terjadi kesalahan pada server database.' });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: true, message: 'Materi tidak ditemukan.' });
        }
        res.json(results[0]);
    });
});

// ---------- POST tambah materi baru ----------
app.post('/api/materi', (req, res) => {
    const { mapel_id, judul_materi, konten_teks, url_media, tingkat_kesulitan } = req.body;

    if (!mapel_id || !judul_materi || !tingkat_kesulitan) {
        return res.status(400).json({ error: true, message: 'Mata pelajaran, judul materi, dan tingkat kesulitan wajib diisi!' });
    }

    const query = `
        INSERT INTO materi (mapel_id, judul_materi, konten_teks, url_media, tingkat_kesulitan)
        VALUES (?, ?, ?, ?, ?)
    `;

    db.query(query, [mapel_id, judul_materi, konten_teks || null, url_media || null, tingkat_kesulitan], (err, result) => {
        if (err) {
            console.error("Gagal menambah materi:", err);
            return res.status(500).json({ error: true, message: 'Terjadi kesalahan saat menyimpan materi.' });
        }
        res.status(201).json({ success: true, message: 'Materi berhasil ditambahkan!', id: result.insertId });
    });
});

// ---------- PUT update materi ----------
app.put('/api/materi/:id', (req, res) => {
    const { id } = req.params;
    const { mapel_id, judul_materi, konten_teks, url_media, tingkat_kesulitan } = req.body;

    if (!mapel_id || !judul_materi || !tingkat_kesulitan) {
        return res.status(400).json({ error: true, message: 'Mata pelajaran, judul materi, dan tingkat kesulitan wajib diisi!' });
    }

    const query = `
        UPDATE materi 
        SET mapel_id = ?, judul_materi = ?, konten_teks = ?, url_media = ?, tingkat_kesulitan = ?
        WHERE id = ?
    `;

    db.query(query, [mapel_id, judul_materi, konten_teks || null, url_media || null, tingkat_kesulitan, id], (err, result) => {
        if (err) {
            console.error("Gagal mengupdate materi:", err);
            return res.status(500).json({ error: true, message: 'Terjadi kesalahan saat mengupdate materi.' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: true, message: 'Materi tidak ditemukan.' });
        }
        res.json({ success: true, message: 'Materi berhasil diperbarui!' });
    });
});

// ---------- DELETE materi ----------
app.delete('/api/materi/:id', (req, res) => {
    const { id } = req.params;

    db.query('DELETE FROM materi WHERE id = ?', [id], (err, result) => {
        if (err) {
            console.error("Gagal menghapus materi:", err);
            return res.status(500).json({ error: true, message: 'Terjadi kesalahan saat menghapus materi.' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: true, message: 'Materi tidak ditemukan.' });
        }
        res.json({ success: true, message: 'Materi berhasil dihapus!' });
    });
});
app.listen(PORT, () => {
    console.log(`Server EduAdapt-API berjalan murni di port ${PORT}`);
});