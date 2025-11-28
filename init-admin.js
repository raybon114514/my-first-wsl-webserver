// init-admin.js - 用來建立第一個管理員帳號
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./db'); // 引用你的連線設定

const USERNAME = '';     // 你想設定的帳號
const PASSWORD = '' // 你想設定的密碼 (自己改)

async function createAdmin() {
    try {
        // 1. 加密密碼 (Salt Rounds = 10)
        console.log(`正在加密密碼: ${PASSWORD}...`);
        const hashedPassword = await bcrypt.hash(PASSWORD, 10);
        
        // 2. 寫入資料庫
        console.log('正在寫入資料庫...');
        const sql = `INSERT INTO ${process.env.DB_NAME}.admins (username, password_hash) VALUES (?, ?)`;
        await pool.query(sql, [USERNAME, hashedPassword]);
        
        console.log('✅ 成功建立管理員帳號！');
        console.log(`帳號: ${USERNAME}`);
        console.log(`密碼: ${PASSWORD}`);
        console.log(`加密後的 Hash: ${hashedPassword}`);

    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            console.error('❌ 錯誤：這個帳號已經存在了');
        } else {
            console.error('❌ 系統錯誤:', err);
        }
    } finally {
        process.exit();
    }
}

createAdmin();