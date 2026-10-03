require('dotenv').config();

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');

const app = express();
const host = process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT) || 3000;
const imagesDir = path.join(__dirname, 'images');
const dbPath = path.join(__dirname, 'database.sqlite');
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'ruyam_cicek';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ruyam_cicek28';
const ADMIN_SESSION_COOKIE = 'ruyam_admin_session';

if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

app.disable('x-powered-by');
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use('/images', express.static(imagesDir));

function requireAdmin(req, res, next) {
  const session = req.cookies && req.cookies[ADMIN_SESSION_COOKIE];

  if (session === 'authenticated') {
    return next();
  }

  return res.status(401).json({ error: 'Bu işlem için yetki gerekli.' });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, imagesDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

const DEFAULT_PRODUCT_IDS = [
  'romantik',
  'tutkulu',
  'gunes-isigi',
  'masumiyet',
  'bahar-esintisi',
  'gunes',
  'zarafet',
  'nostalji',
  'elit'
];

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');

    db.run(`CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT,
        category TEXT,
        price INTEGER,
        stock INTEGER,
        image TEXT
    )`, (err) => {
      if (err) {
        console.error("Error creating table", err);
      } else {
        console.log("Table created or already exists.");

        const placeholders = DEFAULT_PRODUCT_IDS.map(() => '?').join(',');
        db.run(`DELETE FROM products WHERE id IN (${placeholders})`, DEFAULT_PRODUCT_IDS, (deleteErr) => {
          if (deleteErr) {
            console.error('Error removing demo products:', deleteErr.message);
          } else {
            console.log('Demo products removed. Only admin-added products will be shown.');
          }
        });
      }
    });
  }
});

// Arayüz dosyalarını sun (GET)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/style.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'style.css'));
});
app.get('/script.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'script.js'));
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'ruyam-cicek', time: new Date().toISOString() });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body || {};

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        res.cookie(ADMIN_SESSION_COOKIE, 'authenticated', {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 1000 * 60 * 60 * 12
        });

        return res.json({ message: 'success' });
    }

    return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı!' });
});

app.post('/api/logout', (req, res) => {
    res.clearCookie(ADMIN_SESSION_COOKIE, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    return res.json({ message: 'success' });
});

// Tüm ürünleri getir (GET)
app.get('/api/products', (req, res) => {
    db.all("SELECT * FROM products", [], (err, rows) => {
        if (err) {
            res.status(400).json({"error": err.message});
            return;
        }
        res.json({
            "message": "success",
            "data": rows
        });
    });
});

// Görsel yükleme endpointi (POST)
app.post('/api/upload', requireAdmin, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Dosya yüklenemedi' });
  }
  res.json({
    message: 'success',
    imageUrl: 'images/' + req.file.filename
  });
});

// Yeni ürün ekle (POST)
app.post('/api/products', requireAdmin, (req, res) => {
    const data = req.body;
    db.run(
        `INSERT INTO products (id, name, category, price, stock, image) VALUES (?, ?, ?, ?, ?, ?)`,
        [data.id, data.name, data.category, data.price, data.stock, data.image],
        function (err, result) {
            if (err) {
                res.status(400).json({"error": err.message});
                return;
            }
            res.json({
                "message": "success",
                "id": data.id
            });
        }
    );
});

// Ürünü güncelle (PUT)
app.put('/api/products/:id', requireAdmin, (req, res) => {
    const data = req.body;
    db.run(
        `UPDATE products SET name = COALESCE(?,name), category = COALESCE(?,category), price = COALESCE(?,price), stock = COALESCE(?,stock), image = COALESCE(?,image) WHERE id = ?`,
        [data.name, data.category, data.price, data.stock, data.image, req.params.id],
        function (err, result) {
            if (err) {
                res.status(400).json({"error": err.message});
                return;
            }
            res.json({
                "message": "success"
            });
        }
    );
});

// Ürünü sil (DELETE)
app.delete('/api/products/:id', requireAdmin, (req, res) => {
    db.run(
        'DELETE FROM products WHERE id = ?',
        req.params.id,
        function (err, result) {
            if (err){
                res.status(400).json({"error": err.message});
                return;
            }
            res.json({"message": "deleted"})
        }
    );
});

app.listen(port, host, () => {
    console.log(`Server running on http://${host}:${port}`);
});
