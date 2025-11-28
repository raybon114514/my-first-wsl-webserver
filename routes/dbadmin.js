const express = require('express');
const router = express.Router();
const pool = require('../db'); // 使用共用的 db.js，不要自己再 createPool

// ----------------------------------------------------
// 1. 登入 API
// URL: POST /api/admin/login
// ----------------------------------------------------
router.post('/login', (req, res) => {
    const { password } = req.body;
    // 記得檢查你的 .env 檔，變數名稱是不是 router_PASSWORD
    if (password === process.env.router_PASSWORD) {
        res.json({ success: true, token: process.env.router_PASSWORD });
    } else {
        res.status(401).json({ success: false, message: "密碼錯誤" });
    }                    
});

// ----------------------------------------------------
// 2. 警衛 Middleware
// 放在這裡，代表「除了 Login 以外，下面所有的 API 都要驗證」
// ----------------------------------------------------
router.use((req, res, next) => {
    const clientToken = req.headers['authorization'];
    if (clientToken === process.env.router_PASSWORD) {
        next(); // 通行
    } else {
        res.status(401).json({ error: "未授權：請先登入" });
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