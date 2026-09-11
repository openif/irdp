# IRDP (Web Remote Desktop)

> Access and control any Windows computer directly from your web browser — no client apps or plugins needed.  
> Based on [IronRDP-web](https://github.com/Devolutions/IronRDP).

[![License: Apache 2.0 / MIT](https://img.shields.io/badge/License-Apache%202.0%20%2F%20MIT-blue.svg)](#license)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg?logo=docker&logoColor=white)](#-how-to-run)
[![WebAssembly](https://img.shields.io/badge/WebAssembly-WASM-654FF0.svg?logo=webassembly&logoColor=white)](#-why-irdp)

---

## 💡 Why IRDP?

Need to connect to your work PC or home Windows machine from a Mac, Linux laptop, iPad, or a friend's computer without installing Remote Desktop software?

**IRDP** runs a full-featured Windows desktop inside your favorite web browser (Chrome, Edge, Safari, Firefox). Powered by WebAssembly, it connects directly from your browser to your Windows PC with fast rendering, smooth typing, and full mouse control.

---

## ✨ What You Can Do

- 🌐 **Connect from Any Device**: Mac, Linux, Chromebook, iPad, or another PC — if it has a web browser, you can access your Windows desktop.
- 🖥️ **Smart Auto-Fit Screen**: Resize your browser window and the remote desktop automatically adjusts to match. You can also switch between 1080P, 2K, 4K, or custom sizes at any time without disconnecting.
- 📋 **Copy & Paste Across Devices**: Copy text on your local machine and paste it directly into the remote Windows desktop, and vice versa.
- 📁 **Transfer Files Easily**: Upload files to your remote desktop or download files back to your local device using the slide-out transfer drawer.
- 🔄 **Refresh Without Disconnecting**: Accidentally closed or refreshed your browser tab? IRDP automatically reconnects you right where you left off.
- 🔒 **100% Private & Self-Hosted**: Everything runs on your own hardware or server. Your credentials and screen data never pass through third-party cloud services.

---

## 🚀 How to Run

### Method 1: Docker (Recommended)

Run IRDP on your server or local computer with a single command:

```bash
git clone https://github.com/openif/irdp.git
cd irdp

docker compose up -d
```

Open your browser and navigate to: **`http://localhost:8080`**

---

### Method 2: Node.js

If you have Node.js (v18+) installed:

```bash
cd web
npm install
npm start
```

Visit `http://localhost:8080` in your browser.

---

## 🖥️ How to Connect to Your Windows PC

1. Open `http://localhost:8080` in your browser.
2. Enter your Windows machine's **IP Address** (and port, default is `3389`).
3. Enter your Windows **Username** and **Password**.
4. Click **Connect**.

> **Tip: Make sure Remote Desktop is enabled on your Windows PC:**
> 1. Open **Settings** > **System** > **Remote Desktop**.
> 2. Toggle **Enable Remote Desktop** to **On**.
> 3. Ensure your Windows user account has a password configured.

---

## 🔒 Optional: Add HTTPS & Domain (Nginx)

If you want to access IRDP over the internet with your own domain name and SSL certificate, configure Nginx like this:

```nginx
server {
    listen 443 ssl http2;
    server_name rdp.yourdomain.com;

    ssl_certificate     /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

---

## 🇨🇳 中文说明 (Quick Summary)

**IRDP** 是一个基于 [IronRDP-web](https://github.com/Devolutions/IronRDP) 的纯网页版 Windows 远程桌面客户端：

- **免安装客户端**：在 Mac、Linux、平板、手机等任意设备的浏览器中打开网页，即可远程控制 Windows 电脑。
- **自适应与动态分辨率**：拉伸浏览器窗口远程桌面自动自适应，会话中可随时切换 1080P、2K、4K 清晰度。
- **双向剪贴板**：本地与远程电脑文字无缝复制粘贴。
- **文件轻松互传**：支持本地与远程电脑之间的文件上传与下载。
- **刷新不掉线**：刷新页面自动恢复会话，无需反复输入账号密码。
- **私有可控**：数据仅在您的浏览器、自有服务与目标电脑间流转，无任何第三方云端中转。

---

## 📄 License

This project is licensed under Apache 2.0 / MIT.
Based on the open-source [IronRDP-web](https://github.com/Devolutions/IronRDP) project by Devolutions.
