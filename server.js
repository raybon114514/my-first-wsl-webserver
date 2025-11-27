require('dotenv').config(); // 1. 引入這行，它會去讀取 .env
const http = require('http');
const mysql = require('mysql2/promise');

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
};

const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute('SELECT "Database Connected!" as msg');
        await connection.end();
        res.end(`Hello from Node.js! \nDB Status: ${rows[0].msg}`);
    } catch (err) {
        res.end('Error: ' + err.message);
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running at port ${PORT}`);
});