動作,指令,說明
啟動,sudo systemctl start mariadb,現在立刻把資料庫打開（不管下次開機）。
停止,sudo systemctl stop mariadb,現在立刻把資料庫關掉。
重啟,sudo systemctl restart mariadb,修改設定檔後通常需要執行這行。
查看狀態,sudo systemctl status mariadb,檢查它現在有沒有在跑，有無錯誤訊息。
設定開機自啟,sudo systemctl enable mariadb,設定未來每次開機都自動執行。
取消開機自啟,sudo systemctl disable mariadb,以後開機不自動跑，要用時再手動 start。