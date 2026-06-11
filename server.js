import express from 'express';
import mysql from 'mysql2';
import cors from 'cors';

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Koneksi Database MariaDB / MySQL
const db = mysql.createConnection({
    host: '127.0.0.1', // IPv4 langsung untuk menghindari ECONNREFUSED
    user: 'root',
    password: '',
    database: 'eduadapt'
});

db.connect((err) => {
    if (err) {
        console.error('Gagal menghubungkan ke database:', err);
        return;
    }
    console.log('Berhasil terhubung ke database MariaDB (eduadapt).');
});

// ====================================================================
// 🔑 ENDPOINT UTAMA: LOGIN AMAN TANPA BCRYPT (PLAIN TEXT MATCHING)
// ====================================================================
app.post('/api/auth/login', (req, res) => {
    const { username, password, role } = req.body;

    if (!username || !password || !role) {
        return res.status(400).json({ success: false, message: 'Username, password, dan role wajib diisi!' });
    }

    // Query mencari user berdasarkan username dan role (Case-Insensitive)
    const query = `SELECT * FROM user WHERE LOWER(username) = LOWER(?) AND LOWER(role) = LOWER(?)`;

    db.query(query, [username, role], (err, results) => {
        if (err) {
            console.error("Error database:", err);
            return res.status(500).json({ success: false, message: 'Terjadi kesalahan internal pada server database.' });
        }

        // Jika user tidak ditemukan di database
        if (results.length === 0) {
            return res.status(401).json({ success: false, message: 'Gagal masuk. Akun tidak ditemukan untuk role ini.' });
        }

        const user = results[0];

        // Pencocokan langsung teks murni (Plain Text) untuk demo cepat
        if (password !== user.password) {
            return res.status(401).json({ success: false, message: 'Gagal masuk. Password yang Anda masukkan salah.' });
        }

        // Ambil data spesifik aktor tambahan dari database jika login sukses
        let additionalQuery = '';
        if (role === 'siswa') {
            additionalQuery = 'SELECT s.id as siswa_id, s.nisn, s.level_adaptif, s.kelas_id FROM siswa s WHERE s.user_id = ?';
        } else if (role === 'guru') {
            additionalQuery = 'SELECT g.id as guru_id, g.nip FROM guru g WHERE g.user_id = ?';
        } else if (role === 'orang_tua') {
            additionalQuery = 'SELECT o.id as ortu_id, o.nama_wali, o.siswa_id FROM orang_tua o WHERE o.user_id = ?';
        } else if (role === 'kepala_sekolah') {
            additionalQuery = 'SELECT k.id as kepsek_id, k.nip FROM kepala_sekolah k WHERE k.user_id = ?';
        }

        if (additionalQuery) {
            db.query(additionalQuery, [user.id], (actorErr, actorResults) => {
                const actorData = actorResults && actorResults.length > 0 ? actorResults[0] : {};
                
                return res.status(200).json({
                    success: true,
                    message: 'Login Berhasil!',
                    user: {
                        id: user.id,
                        username: user.username,
                        nama_lengkap: user.nama_lengkap,
                        role: user.role.toLowerCase(),
                        ...actorData
                    }
                });
            });
        } else {
            return res.status(200).json({
                success: true,
                message: 'Login Berhasil!',
                user: {
                    id: user.id,
                    username: user.username,
                    nama_lengkap: user.nama_lengkap,
                    role: user.role.toLowerCase()
                }
            });
        }
    });
});

// ====================================================================
// Jalankan Server Node.js
// ====================================================================
app.listen(PORT, () => {
    console.log(`Server EduAdapt-API berjalan murni di port ${PORT}`);
});