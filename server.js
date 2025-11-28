require('dotenv').config();
const express = require('express'); // 改用強大的 Express 框架
const mysql = require('mysql2/promise');
const cors = require('cors'); // 解決前端連線權限問題

const app = express();
const PORT = process.env.PORT || 3000;

// 【中介軟體區】
app.use(cors()); // 允許跨網域連線 (重要！)
app.use(express.json()); // 讓我們能讀懂前端傳來的 JSON 資料

app.post('/api/login', (req, res) => {
    const { password } = req.body;
    // 比對 .env 裡的密碼
    if (password === process.env.APP_PASSWORD) {
        res.json({ success: true, token: process.env.APP_PASSWORD }); // 簡單實作：直接用密碼當 Token
    } else {
        res.status(401).json({ success: false, message: "密碼錯誤" });
    }
});
// 【新增】驗證警衛 (Middleware)
// 所有 /api/ 開頭的請求 (除了上面的 login) 都會經過這裡
app.use('/api', (req, res, next) => {
    // 檢查前端有沒有帶 Authorization 標頭
    const clientToken = req.headers['authorization'];
    
    if (clientToken === process.env.APP_PASSWORD) {
        next(); // 密碼正確，放行！繼續執行後面的路由
    } else {
        res.status(401).json({ error: "未授權：請先登入" }); // 擋下
    }
});

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

// 【新增功能】執行任意 SQL 指令 (這是 phpMyAdmin 的核心靈魂)
// 呼叫方式: POST /api/sql (Body: { sql: "SELECT * FROM users", db: "mytestdb" })
app.post('/api/sql', async (req, res) => {
    const { sql, db } = req.body;

    if (!sql) return res.status(400).json({ error: "請輸入 SQL 指令" });

    try {
        // 如果有指定資料庫，先切換過去
        // 注意：這是在連線池的一條連線中執行，結束後會釋放，所以不會影響別人
        const connection = await pool.getConnection();
        
        try {
            if (db) {
                await connection.changeUser({ database: db });
            }
            
            // 執行 SQL
            const [result] = await connection.query(sql);
            
            // 判斷是查詢(回傳陣列)還是操作(回傳物件)
            // 如果是 SELECT，result 會是陣列
            // 如果是 INSERT/UPDATE，result 會是 Header 物件
            res.json({ result: result });
            
        } finally {
            connection.release(); // 務必釋放連線
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 【啟動伺服器】
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`API available at http://localhost:${PORT}/api/status`);
});