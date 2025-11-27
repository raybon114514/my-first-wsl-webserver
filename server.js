require('dotenv').config();
const express = require('express'); // 改用強大的 Express 框架
const mysql = require('mysql2/promise');
const cors = require('cors'); // 解決前端連線權限問題

const app = express();
const PORT = process.env.PORT || 3000;

// 【中介軟體區】
app.use(cors()); // 允許跨網域連線 (重要！)
app.use(express.json()); // 讓我們能讀懂前端傳來的 JSON 資料

// 【資料庫連線池設定】(取代原本的 createConnection)
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10, // 最多同時 10 條連線
    queueLimit: 0
});

// 【路由區 - Route】

// 1. 測試連線狀態
app.get('/api/status', async (req, res) => {
    try {
        const connection = await pool.getConnection(); // 從池子借一條連線
        await connection.ping(); // Ping 一下確認活著
        connection.release(); // 用完趕快還回去
        res.json({ status: "OK", message: "Database Connected Successfully!" });
    } catch (err) {
        res.status(500).json({ status: "Error", message: err.message });
    }
});

// 2. (核心功能) 取得所有資料表名稱
app.get('/api/tables', async (req, res) => {
    try {
        const [rows] = await pool.query('SHOW TABLES');
        // 把資料整理一下，回傳乾淨的 JSON
        // SHOW TABLES 回傳的 key 會是 'Tables_in_dbname'，我們把它轉成簡單的 array
        const tableNames = rows.map(row => Object.values(row)[0]);
        res.json({ tables: tableNames });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. (核心功能) 撈取指定資料表的資料
// 用法: /api/data?table=users
app.get('/api/data', async (req, res) => {
    const tableName = req.query.table;
    
    // 安全性檢查：雖然是自己用的，但養成好習慣，避免 SQL Injection
    if (!tableName) {
        return res.status(400).json({ error: "Missing table name" });
    }

    try {
        // 注意：表名不能直接用 ? 參數化 (SQL限制)，所以這裡做簡單字串串接
        // (進階做這塊通常會有更嚴格的白名單檢查)
        const [rows] = await pool.query(`SELECT * FROM ${pool.escapeId(tableName)} LIMIT 100`);
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 【啟動伺服器】
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`API available at http://localhost:${PORT}/api/status`);
});