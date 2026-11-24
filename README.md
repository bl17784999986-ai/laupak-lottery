# 体彩·福彩全彩种推盘预测模拟器 — 本地仓库与腾讯云 SCF 部署指南

## 目录结构
- `index.html`：单文件全彩种推盘预测模拟器（覆盖双色球、3D、七乐彩、大乐透、七星彩、排列三、排列五）。
- `scf-lottery-sync/`：腾讯云云函数（SCF）实时抓取代码（Node.js 18+，零依赖）。
- `scripts/sync_lottery_data.py`：本地/GitHub Actions 定时同步脚本（Python 3 零依赖）。
- `.github/workflows/sync_lottery.yml`：GitHub Actions 每日 21:40 & 22:15 自动更新工作流。
- `data/lottery_data.json`：本地仓库静态开奖库（前端自动回退数据源）。

## 方式一：部署腾讯云云函数 (SCF) 实现点击即实时更新
1. 登录 [腾讯云云函数控制台](https://console.cloud.tencent.com/scf)，选择 **广州/上海** 地域，点击 **新建** → **从头开始** → **事件函数**（或 Web 函数）。
2. 运行环境选择 **Node.js 18.15**，将 `scf-lottery-sync/index.js` 内容粘贴至在线编辑器，执行方法保持 `index.main_handler`，超时时间设为 `15秒`。
3. 在云函数 **触发管理 / 函数 URL** 中开启公网访问（选择无需鉴权），复制生成的 `https://...scf.tencentcs.com/...` 地址。
4. 打开 `index.html`，点击右上角 **导入/云函数配置**，填入该 URL 并点击 **保存配置并立即同步**，此后每次点击 **同步实时开奖** 都会直接实时抓取 7 大彩种最新官方开奖号、自动核对复盘单并推进至下一期。

## 方式二：GitHub Pages 本地仓库自动托管与定时更新
1. 在 GitHub（如 `bl17784999986-ai`）新建仓库（如 `laupak-lottery`），将本目录全部文件推送至 `main` 分支。
2. 在仓库 **Settings → Pages** 开启 `main` 分支根目录托管。
3. 在 **Actions** 页面启用 `Sync Lottery Draw Data (TC & FC)` 工作流，每天开奖后将自动抓取并更新 `data/lottery_data.json`，前端打开即可自动读取最新期次数据。
