'use strict';

const path = require('path');
const express = require('express');
const expressWs = require('express-ws');
const { handleConnection } = require('./lib/rdp-proxy');

const PORT = parseInt(process.env.PORT || '8080', 10);
const ROOT = __dirname;

const app = express();
expressWs(app);

// ── Security Helpers ──
// Configure ALLOWED_HOSTS via environment variable: e.g. "example.com,.example.com"
// If not configured, allows all incoming hosts (default for open-source / local deployments)
const ALLOWED_HOSTS = (process.env.ALLOWED_HOSTS || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);

function isAllowedHost(hostHeader) {
    if (ALLOWED_HOSTS.length === 0) return true;
    if (!hostHeader) return false;
    const hostname = hostHeader.split(':')[0].trim().toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
    return ALLOWED_HOSTS.some(domain => {
        if (domain.startsWith('.')) return hostname.endsWith(domain) || hostname === domain.slice(1);
        return hostname === domain || hostname.endsWith('.' + domain);
    });
}

function isAllowedOrigin(origin) {
    if (ALLOWED_HOSTS.length === 0) return true;
    if (!origin) return true;
    try {
        const parsed = new URL(origin);
        const hostname = parsed.hostname.toLowerCase();
        if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
        return ALLOWED_HOSTS.some(domain => {
            if (domain.startsWith('.')) return hostname.endsWith(domain) || hostname === domain.slice(1);
            return hostname === domain || hostname.endsWith('.' + domain);
        });
    } catch {
        return false;
    }
}

// Enforce allowed Host (silent drop/404 on invalid hosts)
app.use((req, res, next) => {
    if (!isAllowedHost(req.headers.host)) {
        return res.status(404).end();
    }
    next();
});

// ── Static file serving ──

app.use(express.static(ROOT));

app.use('/pkg', express.static(path.join(ROOT, '..', 'pkg'), {
    setHeaders(res, filePath) {
        if (filePath.endsWith('.wasm')) res.setHeader('Content-Type', 'application/wasm');
    },
}));

// ── WebSocket RDCleanPath proxy ──
// The WASM client connects to ws://<host>:<port>/
// express-ws handles the upgrade; we delegate to lib/rdp-proxy.

app.ws('/', (ws, req) => {
    const origin = req.headers.origin;
    if (!isAllowedOrigin(origin)) {
        console.warn(`[Security] Rejected WebSocket connection from unauthorized origin: ${origin}`);
        try {
            ws.close(1008, 'Origin not allowed');
        } catch (_) {}
        return;
    }
    handleConnection(ws);
});

// ── Start ──

app.listen(PORT, () => {
    console.log(`\n  🚀 RDCleanPath proxy + HTTP server on http://localhost:${PORT}/`);
    console.log(`  📂 Serving files from ${ROOT}`);
    console.log(`  🔌 WebSocket proxy on ws://localhost:${PORT}/\n`);
});
