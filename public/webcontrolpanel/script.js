const API_BASE = 'http://localhost:3000/api';
let currentDB = '';
let authToken = ''; // 用來存密碼
async function doLogin() {
    const password = document.getElementById('login-pass').value;
    const msg = document.getElementById('login-msg');

    try {
        // 呼叫後端登入 API
        const res = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        const json = await res.json();

        if (json.success) {
            // 登入成功
            authToken = json.token; // 把鑰匙存起來
            document.getElementById('login-view').style.display = 'none'; // 隱藏登入框
            document.getElementById('main-app').style.display = 'flex'; // 顯示主畫面

            // 開始載入資料
            loadDatabases();
        } else {
            msg.textContent = '密碼錯誤';
        }
    } catch (err) {
        msg.textContent = '無法連線到伺服器';
    }
}
async function authFetch(url, options = {}) {
    // 自動加上 Authorization Header
    if (!options.headers) options.headers = {};
    options.headers['Authorization'] = authToken;
    options.headers['Content-Type'] = 'application/json'; // 預設都用 JSON

    const res = await fetch(url, options);

    // 如果遇到 401 (未授權)，代表密碼過期或伺服器重啟
    if (res.status === 401) {
        alert("連線逾時或未授權，請重新登入");
        location.reload(); // 重新整理回到登入頁
        throw new Error("Unauthorized");
    }
    return res;
}
// 1. 初始化：載入資料庫列表
async function loadDatabases() {
    const res = await authFetch(`${API_BASE}/databases`);
    const json = await res.json();

    const container = document.getElementById('db-list');
    container.innerHTML = '';

    json.databases.forEach(db => {
        const btn = document.createElement('button');
        btn.className = 'nav-btn';
        btn.textContent = db;
        btn.onclick = () => selectDatabase(db, btn);
        container.appendChild(btn);
    });
}

// 2. 選取資料庫 -> 載入 Tables
async function selectDatabase(dbName, btnElement) {
    currentDB = dbName;

    // UI 更新
    document.querySelectorAll('#sidebar-db .nav-btn').forEach(b => b.classList.remove('active'));
    btnElement.classList.add('active');
    document.getElementById('current-path').textContent = `DB: ${dbName}`;
    document.getElementById('table-list').innerHTML = '載入中...';
    document.getElementById('data-container').innerHTML = '';

    try {
        const res = await authFetch(`${API_BASE}/tables?db=${dbName}`);
        const json = await res.json();

        const container = document.getElementById('table-list');
        container.innerHTML = '';

        if (json.tables.length === 0) {
            container.innerHTML = '<div style="padding:10px">無資料表</div>';
            return;
        }

        json.tables.forEach(table => {
            const btn = document.createElement('button');
            btn.className = 'nav-btn';
            btn.textContent = table;
            btn.onclick = () => loadData(table, btn);
            container.appendChild(btn);
        });
    } catch (err) {
        console.error(err);
    }
}

// 3. 選取 Table -> 載入資料
async function loadData(tableName, btnElement) {
    // UI 更新
    document.querySelectorAll('#sidebar-table .nav-btn').forEach(b => b.classList.remove('table-active'));
    btnElement.classList.add('table-active');
    document.getElementById('current-path').textContent = `DB: ${currentDB} > Table: ${tableName}`;
    document.getElementById('data-container').innerHTML = '載入資料中...';

    try {
        const res = await authFetch(`${API_BASE}/data?db=${currentDB}&table=${tableName}`);
        const json = await res.json();

        const data = json.data;
        if (data.length === 0) {
            document.getElementById('data-container').innerHTML = '此表為空';
            return;
        }

        let html = '<table><thead><tr>';
        const headers = Object.keys(data[0]);
        headers.forEach(h => html += `<th>${h}</th>`);
        html += '</tr></thead><tbody>';
        data.forEach(row => {
            html += '<tr>';
            headers.forEach(h => html += `<td>${row[h]}</td>`);
            html += '</tr>';
        });
        html += '</tbody></table>';

        document.getElementById('data-container').innerHTML = html;
    } catch (err) {
        document.getElementById('data-container').innerHTML = `<p style="color:red">${err.message}</p>`;
    }
}

// 執行使用者輸入的 SQL
async function runSQL() {
    const sql = document.getElementById('sql-input').value;
    if (!sql) {
        alert("請輸入指令");
        return;
    }

    // 顯示載入中
    document.getElementById('data-container').innerHTML = '執行中...';

    try {
        const res = await authFetch(`${API_BASE}/sql`, {
            method: 'POST', // 使用 POST 方法
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sql: sql,
                db: currentDB // 把目前選中的資料庫也傳過去
            })
        });

        const json = await res.json();

        if (json.error) {
            // 如果 SQL 語法錯誤 (例如打錯字)
            document.getElementById('data-container').innerHTML = `<p style="color:red; font-weight:bold;">執行錯誤：${json.error}</p>`;
            return;
        }

        // 顯示結果
        renderResult(json.result);

    } catch (err) {
        console.error(err);
        document.getElementById('data-container').innerHTML = '系統錯誤';
    }
}

// 抽離出一個共用的渲染函式 (讓 loadData 和 runSQL 都可以用)
function renderResult(data) {
    const container = document.getElementById('data-container');

    // 狀況 1: 如果是空陣列 (查無資料)
    if (Array.isArray(data) && data.length === 0) {
        container.innerHTML = '查詢成功，但沒有資料。';
        return;
    }

    // 狀況 2: 如果是操作結果 (例如 INSERT/UPDATE 成功)
    // MySQL 的操作結果通常會有 affectedRows 屬性
    if (!Array.isArray(data) && data.affectedRows !== undefined) {
        container.innerHTML = `
                    <div style="color: green; padding: 10px; border: 1px solid green; background: #e8f5e9;">
                        <strong>執行成功！</strong><br>
                        影響筆數: ${data.affectedRows}<br>
                        訊息: ${data.info || '無'}
                    </div>`;
        return;
    }

    // 狀況 3: 一般 SELECT 查詢結果 (陣列)
    if (Array.isArray(data)) {
        let html = '<table><thead><tr>';
        const headers = Object.keys(data[0]);
        headers.forEach(h => html += `<th>${h}</th>`);
        html += '</tr></thead><tbody>';
        data.forEach(row => {
            html += '<tr>';
            headers.forEach(h => html += `<td>${row[h]}</td>`);
            html += '</tr>';
        });
        html += '</tbody></table>';
        container.innerHTML = html;
    }
}
