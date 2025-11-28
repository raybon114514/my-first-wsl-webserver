// server.js - 入口檔案 (Receptionist)
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// 全域設定
app.use(cors());
app.use(express.json());

// 【掛載路由】
// 這行的意思是：只要網址是 /api/admin 開頭的，全部交給 admin.js 處理
const adminRoutes = require('./routes/dbadmin');
app.use('/api/dbadmin', adminRoutes);

// 未來如果你開發了遊戲，就加這一行：
// const gameRoutes = require('./routes/game');
// app.use('/api/game', gameRoutes);

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});