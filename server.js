require('dotenv').config();
const express = require('express'); // 改用強大的 Express 框架
const mysql = require('mysql2/promise');
const cors = require('cors'); // 解決前端連線權限問題

const app = express();
const PORT = process.env.PORT || 3000;

// 【中介軟體區】
app.use(cors()); // 允許跨網域連線 (重要！)
app.use(express.json()); // 讓我們能讀懂前端傳來的 JSON 資料

// 【改動 1】連線池設定：拿掉 'database' 欄位
// 這樣連線時就是「自由狀態」，不會被鎖在某個房間裡
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    // database: process.env.DB_NAME, // <---這行註解掉或刪掉
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// 【新增 API】列出所有資料庫
app.get('/api/databases', async (req, res) => {
    try {
        const [rows] = await pool.query('SHOW DATABASES');
        // 過濾掉系統內建的資料庫 (讓畫面乾淨點)
        const ignoredDBs = ['information_schema', 'mysql', 'performance_schema', 'sys'];
        const dbs = rows
            .map(row => row.Database)
            .filter(db => !ignoredDBs.includes(db));
            
        res.json({ databases: dbs });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 【修改 API】列出指定資料庫的 Tables
// 呼叫方式: /api/tables?db=mytestdb
app.get('/api/tables', async (req, res) => {
    const dbName = req.query.db;
    if (!dbName) return res.status(400).json({ error: "請指定資料庫 (db parameter)" });

    try {
        // 使用 FROM 語法來查特定資料庫
        const [rows] = await pool.query(`SHOW TABLES FROM ${pool.escapeId(dbName)}`);
        const tableNames = rows.map(row => Object.values(row)[0]);
        res.json({ tables: tableNames });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. (核心功能) 撈取指定資料表的資料
// 【修改 API】讀取資料
// 呼叫方式: /api/data?db=mytestdb&table=users
app.get('/api/data', async (req, res) => {
    const dbName = req.query.db;
    const tableName = req.query.table;

    if (!dbName || !tableName) {
        return res.status(400).json({ error: "缺參數" });
    }

    try {
        // SQL 語法變成：SELECT * FROM `dbName`.`tableName`
        const sql = `SELECT * FROM ${pool.escapeId(dbName)}.${pool.escapeId(tableName)} LIMIT 100`;
        const [rows] = await pool.query(sql);
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