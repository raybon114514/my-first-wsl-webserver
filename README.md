# my-first-wsl-webserver
這是一個運行於 WSL 2 (Ubuntu 24.04) 環境下的全端 Web 伺服器專案。

專案整合了 Nginx 反向代理、Node.js (Express) 後端應用與 MariaDB 資料庫。主要功能包含透過 ngrok 進行外部訪問演示，以及一個 僅限 Localhost 訪問 的高安全性資料庫管理後台。

🏗️ 系統架構 (System Architecture)

本專案採用經典的現代化 Web 架構，強調安全性與職責分離：

請求處理流程

1.外部訪問 (Public)

    使用者透過 ngrok (https://xxx.ngrok.app) 進入。

    流量進入 Nginx (Port 80)。

    Nginx 負責提供靜態檔案 (/public) 或轉發 API 請求給 Node.js。

2.內部管理 (Private)

    管理者透過 localhost (http://localhost) 進入。

    安全性機制：Nginx 配置了 IP 過濾規則，/api/dbadmin 路徑 僅允許本地 IP 存取，外部 ngrok 請求會被攔截 (403 Forbidden)。

3.後端處理

    Node.js Server 監聽 Port 3000。

    server.js 作為總機，分發路由。

    dbadmin.js 處理資料庫管理邏輯，並包含 Token 驗證 Middleware。

🛠️ 技術棧 (Tech Stack)

    OS: WSL 2 (Ubuntu 24.04)

    Web Server: Nginx (Reverse Proxy & Static File Serving)

    Backend: Node.js, Express.js

    Database: MariaDB

    Security: bcryptjs (Password Hashing), CORS config, IP Restriction (Nginx level)

    Tunneling: ngrok

📂 專案結構 (Project Structure)
```
    my-first-wsl-webserver/
    ├── public/              # 前端靜態檔案 (HTML/JS/CSS)
    ├── routes/
    │   └── dbadmin.js       # 資料庫管理 API 路由 (登入/查詢/執行SQL)
    ├── .env                 # 環境變數設定 (不應上傳至 Git)
    ├── db.js                # MariaDB 連線池設定 (Connection Pool)
    ├── server.js            # 應用程式入口 (Entry Point)
    └── package.json
```

⚙️ 安裝與設定 (Setup)

1. 環境變數 (.env)

請在專案根目錄建立 .env 檔案，填入資料庫連線資訊：

PORT=3000
DB_HOST=localhost
DB_USER=rikki           # 資料庫使用者
DB_PASSWORD=your_password
DB_NAME=your_db_name
# 注意：db.js 採用 Connection Pool，database 參數可保持彈性


2. 資料庫準備

    確保 MariaDB 服務已啟動，並建立對應的 admins 表格供登入驗證使用。

    -- 範例：建立管理者表格
    CREATE TABLE admins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL,
        password_hash VARCHAR(255) NOT NULL -- 存放 bcrypt 加密後的密碼
    );


3. Nginx 設定 (關鍵)

    為了實現「後台僅限 Localhost」的安全性，Nginx 配置 (/etc/nginx/sites-available/default) 需包含：
    ```
        location /api/dbadmin {
            allow 127.0.0.1;    # 允許本機
            deny all;           # 拒絕其他所有 IP (包含 ngrok 轉發的來源)
            
            proxy_pass http://localhost:3000;
            # ... 其他 proxy 設定
        }
    ```


🚀 啟動服務 (Usage)

啟動資料庫：
```
    sudo service mariadb start
```

啟動 Nginx：
```
    sudo service nginx start
```

啟動 Node.js 後端：
```
    node server.js
```

伺服器將運行於 http://localhost:3000。

啟動 ngrok (若需外部存取)：
```
    ngrok http 80
```

🔌 API 說明 (Backend API)

所有管理 API 位於 /api/dbadmin 下，且需通過 Header 驗證。

Method

Endpoint

描述

備註

POST

/api/dbadmin/login

管理員登入

回傳 Token (password_hash)

GET

/api/dbadmin/databases

顯示所有資料庫

排除系統資料庫

GET

/api/dbadmin/tables

顯示指定資料庫的表格

需帶參數 ?db=name

GET

/api/dbadmin/data

獲取表格資料 (Limit 100)

需帶參數 ?db=name&table=name

POST

/api/dbadmin/sql

執行任意 SQL 指令

JSON Body: { "sql": "...", "db": "..." }

🛡️ 安全性細節 (Security)

Middleware 警衛：所有 /api/dbadmin 請求需攜帶 Authorization Header，伺服器會比對資料庫中的 Hash 進行驗證。

SQL Injection 防護：使用 mysql2 套件的 pool.query 搭配 參數化查詢 (?) 或 pool.escapeId() 來防止注入攻擊。

密碼安全：使用 bcryptjs 進行密碼雜湊比對，不儲存明碼。
