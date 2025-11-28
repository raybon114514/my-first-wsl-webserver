const express = require('express');
const router = express.Router();
const pool = require('../db'); // 使用共用的 db.js，不要自己再 createPool
const bcrypt = require('bcryptjs');

// ----------------------------------------------------
// 1. 登入 API
// URL: POST /api/admin/login
// ----------------------------------------------------
router.post('/login', async (req, res) => {
    const { username, password } = req.body; // 前端現在要多傳 username

    if (!username || !password) {
        return res.status(400).json({ success: false, message: "請輸入帳號密碼" });
    }

    try {
        // A. 去資料庫找這個人
        const [users] = await pool.query('SELECT * FROM admins WHERE username = ?', [username]);
        
        if (users.length === 0) {
            return res.status(401).json({ success: false, message: "帳號或密碼錯誤" });
        }

        const adminUser = users[0];

        // B. 比對密碼 (用 bcrypt.compare)
        // 它會把使用者輸入的明文密碼，跟資料庫裡的亂碼 Hash 進行數學比對
        const isMatch = await bcrypt.compare(password, adminUser.password_hash);

        if (isMatch) {
            // C. 登入成功！
            // 實務上這裡會發 JWT，但目前我們簡單一點，回傳一個隨機 Token 或直接用 Hash 當 Token
            // 為了簡化，我們暫時回傳 password_hash 當作通關權杖 (因為它是不會變的)
            res.json({ success: true, token: adminUser.password_hash });
        } else {
            res.status(401).json({ success: false, message: "帳號或密碼錯誤" });
        }

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ----------------------------------------------------
// 2. 警衛 Middleware
// 放在這裡，代表「除了 Login 以外，下面所有的 API 都要驗證」
// ----------------------------------------------------
router.use(async (req, res, next) => {
    const clientToken = req.headers['authorization'];
    
    if (!clientToken) return res.status(401).json({ error: "未授權" });

    // 這裡做一個簡單的驗證：拿 Token 去資料庫看看有沒有這個 Hash 存在
    // (這不是最高效的做法，但在不引入 JWT 前這是最安全的)
    try {
        const [rows] = await pool.query('SELECT id FROM admins WHERE password_hash = ?', [clientToken]);
        if (rows.length > 0) {
            next(); // 資料庫有這個憑證，放行
        } else {
            res.status(401).json({ error: "無效的 Token" });
        }
    } catch (err) {
        res.status(500).json({ error: "驗證錯誤" });
    }
});

// ----------------------------------------------------
// 3. 功能 API
// 注意：這裡的路徑不用加 /api，因為 server.js 已經幫你加了 /api/admin
// ----------------------------------------------------

// URL: GET /api/admin/databases
router.get('/databases', async (req, res) => {
    try {
        const [rows] = await pool.query('SHOW DATABASES');
        const ignoredDBs = ['information_schema', 'mysql', 'performance_schema', 'sys'];
        const dbs = rows.map(r => r.Database).filter(d => !ignoredDBs.includes(d));
        res.json({ databases: dbs });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// URL: GET /api/admin/tables
router.get('/tables', async (req, res) => {
    const dbName = req.query.db;
    if (!dbName) return res.status(400).json({ error: "請指定資料庫" });
    try {
        const [rows] = await pool.query(`SHOW TABLES FROM ${pool.escapeId(dbName)}`);
        res.json({ tables: rows.map(r => Object.values(r)[0]) });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// URL: GET /api/admin/data
router.get('/data', async (req, res) => {
    const { db, table } = req.query;
    if (!db || !table) return res.status(400).json({ error: "缺參數" });
    try {
        const sql = `SELECT * FROM ${pool.escapeId(db)}.${pool.escapeId(table)} LIMIT 100`;
        const [rows] = await pool.query(sql);
        res.json({ data: rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// URL: POST /api/admin/sql
router.post('/sql', async (req, res) => {
    const { sql, db } = req.body;
    if (!sql) return res.status(400).json({ error: "請輸入 SQL 指令" });

    try {
        const connection = await pool.getConnection();
        try {
            if (db) await connection.changeUser({ database: db });
            const [result] = await connection.query(sql);
            res.json({ result: result });
        } finally {
            connection.release();
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});



module.exports = router;