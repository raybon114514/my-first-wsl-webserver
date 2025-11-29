const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');

// ----------------------------------------------------
// 1. 登入 API
// ----------------------------------------------------
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ success: false, message: "請輸入帳號密碼" });
    }

    try {
        // ✅ 修正：使用反引號 `
        const [users] = await pool.query(`SELECT * FROM ${process.env.DB_NAME}.admins WHERE username = ?`, [username]);
        
        console.log('DB Search Result:', users);
        if (users.length === 0) {
            return res.status(401).json({ success: false, message: "帳號或密碼錯誤" });
        }

        const adminUser = users[0];
        const isMatch = await bcrypt.compare(password, adminUser.password_hash);

        if (isMatch) {
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
// ----------------------------------------------------
router.use(async (req, res, next) => {
    const clientToken = req.headers['authorization'];
    if (!clientToken) return res.status(401).json({ error: "未授權" });

    try {
        // ✅ 修正：使用反引號 ` 並且加上逗號 ,
        const [rows] = await pool.query(`SELECT id FROM ${process.env.DB_NAME}.admins WHERE password_hash = ?`, [clientToken]);
        
        if (rows.length > 0) {
            next();
        } else {
            res.status(401).json({ error: "無效的 Token" });
        }
    } catch (err) {
        res.status(500).json({ error: "驗證錯誤" });
    }
});

// ----------------------------------------------------
// 3. 功能 API
// ----------------------------------------------------

router.get('/databases', async (req, res) => {
    try {
        const [rows] = await pool.query('SHOW DATABASES');
        const ignoredDBs = ['information_schema', 'mysql', 'performance_schema', 'sys'];
        const dbs = rows.map(r => r.Database).filter(d => !ignoredDBs.includes(d));
        res.json({ databases: dbs });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/tables', async (req, res) => {
    const dbName = req.query.db;
    if (!dbName) return res.status(400).json({ error: "請指定資料庫" });
    try {
        const [rows] = await pool.query(`SHOW TABLES FROM ${pool.escapeId(dbName)}`);
        res.json({ tables: rows.map(r => Object.values(r)[0]) });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/data', async (req, res) => {
    const { db, table } = req.query;
    if (!db || !table) return res.status(400).json({ error: "缺參數" });
    try {
        const sql = `SELECT * FROM ${pool.escapeId(db)}.${pool.escapeId(table)} LIMIT 100`;
        const [rows] = await pool.query(sql);
        res.json({ data: rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

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