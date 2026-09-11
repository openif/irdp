import { setupClipboard } from './clipboard.js';
import { setupInputHandlers, sendCtrlAltDel } from './input.js';
import { createFileTransfer } from './file-transfer.js';

export function createSessionManager({
    canvas, statusBadge, statusText, connectBtn, disconnectBtn, fileTransferPanel,
    uploadBtn, downloadBtn, fileInput, dropZone, fileListEl,
    hostInput, portInput, usernameInput, passwordInput, rememberPassCheckbox, resolutionSelect, customWidthInput, customHeightInput,
    loginScreen, floatingBar, isInputSuppressed,
    SessionBuilder, DesktopSize, Extension, DeviceEvent, InputTransaction, ClipboardData,
    init, setup, log, setStatus, formatError
}) {
    let session = null;
    let clipboardReady = false;
    let cleanupInputs = null;
    let uiInitialized = false;

    const pendingDownloads = new Map();
    const uploadedFiles = new Map();

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    function escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    const fileTransfer = createFileTransfer(
        () => session,
        { Extension, log, formatError, formatFileSize, escapeHtml },
        { fileListEl, downloadBtn, uploadedFiles, pendingDownloads }
    );

    function calculateResolution(mode, customW, customH) {
        let width = 1920;
        let height = 1080;

        if (mode === 'fit') {
            width = window.innerWidth || document.documentElement.clientWidth;
            height = window.innerHeight || document.documentElement.clientHeight;
            // Align to even numbers as required by standard RDP encoders
            width = Math.floor(width / 2) * 2;
            height = Math.floor(height / 2) * 2;
        } else if (mode === 'custom') {
            width = parseInt(customW, 10) || 1280;
            height = parseInt(customH, 10) || 720;
        } else {
            const parts = (mode || '').split('x');
            if (parts.length === 2) {
                width = parseInt(parts[0], 10);
                height = parseInt(parts[1], 10);
            }
        }

        return { width: Math.max(width, 640), height: Math.max(height, 480) };
    }

    function getTargetResolution() {
        return calculateResolution(resolutionSelect.value, customWidthInput.value, customHeightInput.value);
    }

    function applyResolution(mode, customW, customH) {
        const res = calculateResolution(mode, customW, customH);
        if (session && typeof session.resize === 'function') {
            try {
                session.resize(res.width, res.height);
                canvas.width = res.width;
                canvas.height = res.height;
                updateStatusUI(`${res.width}×${res.height}`, 'connected');
                log(`Applied resolution: ${res.width}x${res.height}`, 'success');
            } catch (e) {
                log(`Resolution resize failed: ${formatError(e)}`, 'warn');
            }
        }
        localStorage.setItem('ironrdp_resolution', mode);
        sessionStorage.setItem('ironrdp_session_res', mode);
        if (customW) {
            localStorage.setItem('ironrdp_custom_w', customW);
            sessionStorage.setItem('ironrdp_session_cw', customW);
        }
        if (customH) {
            localStorage.setItem('ironrdp_custom_h', customH);
            sessionStorage.setItem('ironrdp_session_ch', customH);
        }
        return res;
    }

    async function connect() {
        try {
            const hostVal = hostInput.value.trim();
            const portVal = (portInput.value || '').trim() || '3389';
            const username = usernameInput.value.trim();
            const password = passwordInput.value;

            if (!hostVal) {
                alert('Please enter RDP Server Host (e.g. 192.168.1.100 or ddns.net)');
                hostInput.focus();
                return;
            }

            // Handle user typing host:port in the host field gracefully
            let destination = hostVal;
            if (!destination.includes(':')) {
                destination = `${hostVal}:${portVal}`;
            }

            // Save preferences
            localStorage.setItem('ironrdp_host', hostVal);
            localStorage.setItem('ironrdp_port', portVal);
            localStorage.setItem('ironrdp_username', username);
            localStorage.setItem('ironrdp_resolution', resolutionSelect.value);
            if (customWidthInput.value) localStorage.setItem('ironrdp_custom_w', customWidthInput.value);
            if (customHeightInput.value) localStorage.setItem('ironrdp_custom_h', customHeightInput.value);

            // Save active session in sessionStorage for seamless refresh / auto-reconnect
            sessionStorage.setItem('ironrdp_active_session', '1');
            sessionStorage.setItem('ironrdp_session_host', hostVal);
            sessionStorage.setItem('ironrdp_session_port', portVal);
            sessionStorage.setItem('ironrdp_session_user', username);
            sessionStorage.setItem('ironrdp_session_pass', password);
            sessionStorage.setItem('ironrdp_session_res', resolutionSelect.value);
            if (customWidthInput.value) sessionStorage.setItem('ironrdp_session_cw', customWidthInput.value);
            if (customHeightInput.value) sessionStorage.setItem('ironrdp_session_ch', customHeightInput.value);

            if (rememberPassCheckbox && rememberPassCheckbox.checked) {
                localStorage.setItem('ironrdp_password', password);
                localStorage.setItem('ironrdp_remember_pass', '1');
            } else {
                localStorage.removeItem('ironrdp_password');
                localStorage.removeItem('ironrdp_remember_pass');
            }

            const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
            const proxyAddress = `${wsProtocol}//${location.host}`;

            await init();
            setup('info');
            log('WASM module initialized', 'success');

            updateStatusUI('Connecting...', 'connecting');
            connectBtn.disabled = true;

            const res = getTargetResolution();
            log(`Connecting to ${destination} via proxy ${proxyAddress}`);
            log(`Resolution: ${res.width}x${res.height}, User: ${username}`);

            const desktopSize = new DesktopSize(res.width, res.height);
            const enableCredsspExt = new Extension('enable_credssp', true);
            const enableDisplayControlExt = new Extension('display_control', true);

            const builder = new SessionBuilder();
            builder.username(username);
            builder.password(password);
            builder.destination(destination);
            builder.proxyAddress(proxyAddress);
            builder.authToken('none');
            builder.desktopSize(desktopSize);
            builder.renderCanvas(canvas);
            builder.extension(enableCredsspExt);
            builder.extension(enableDisplayControlExt);

            fileTransfer.setupCallbacks(builder);

            setupClipboard(builder, { ClipboardData, log, formatError }, {
                session: () => session,
                clipboardReady: () => clipboardReady,
                setClipboardReady: (v) => { clipboardReady = v; }
            });

            builder.setCursorStyleCallbackContext(canvas);
            builder.setCursorStyleCallback(function(style) {
                canvas.style.cursor = style || 'default';
            });

            log('Initiating RDP connection...');
            session = await builder.connect();

            const ds = session.desktopSize();
            log(`Connected! Desktop: ${ds.width}x${ds.height}`, 'success');
            canvas.width = ds.width;
            canvas.height = ds.height;

            // If the server connected at a different resolution (e.g. resuming an existing Windows session),
            // dynamically enforce the desired resolution via DisplayControl!
            if ((ds.width !== res.width || ds.height !== res.height) && typeof session.resize === 'function') {
                try {
                    log(`Enforcing target resolution ${res.width}x${res.height}...`);
                    session.resize(res.width, res.height);
                    canvas.width = res.width;
                    canvas.height = res.height;
                } catch (resizeErr) {
                    console.warn('Initial session.resize failed:', resizeErr);
                }
            }

            updateStatusUI(`${canvas.width}×${canvas.height}`, 'connected');
            disconnectBtn.disabled = false;
            canvas.focus();

            // Transition from login screen to desktop workspace
            document.documentElement.classList.remove('session-reconnecting');
            loginScreen.classList.add('hidden');
            floatingBar.classList.remove('hidden');

            uploadBtn.disabled = false;
            log('Session active', 'success');

            // Clean up previous event listeners if any, then bind cleanly
            if (cleanupInputs) cleanupInputs();
            cleanupInputs = setupInputHandlers(canvas, () => session, { DeviceEvent, InputTransaction }, isInputSuppressed);

            if (!uiInitialized) {
                fileTransfer.setupUI(uploadBtn, fileInput, dropZone);
                uiInitialized = true;
            }

            session.run().then((info) => {
                log(`Session ended: ${info.reason()}`, 'warn');
                cleanup(false);
            }).catch((e) => {
                log(`Session error: ${formatError(e)}`, 'error');
                cleanup(true);
            });

        } catch (e) {
            document.documentElement.classList.remove('session-reconnecting');
            log(`Connection failed: ${formatError(e)}`, 'error');
            cleanup(true);
            alert(`Connection error: ${formatError(e)}`);
            throw e;
        }
    }

    function triggerCAD() {
        if (!session) return;
        log('Sending Ctrl+Alt+Del to remote session...', 'info');
        sendCtrlAltDel(session, { DeviceEvent, InputTransaction });
    }

    function updateStatusUI(text, statusClass) {
        if (statusText) statusText.textContent = text;
        if (statusBadge) {
            statusBadge.className = 'capsule-badge ' + (statusClass || '');
        }
    }

    function disconnect() {
        if (session) {
            try {
                session.shutdown();
                log('Disconnected by user', 'warn');
            } catch (e) {
                log(`Disconnect error: ${formatError(e)}`, 'error');
            }
        }
        cleanup(true);
    }

    function cleanup(clearSavedSession = true) {
        document.documentElement.classList.remove('session-reconnecting');
        session = null;
        clipboardReady = false;
        uploadedFiles.clear();
        pendingDownloads.clear();

        if (clearSavedSession) {
            sessionStorage.removeItem('ironrdp_active_session');
            sessionStorage.removeItem('ironrdp_session_pass');
        }

        if (cleanupInputs) {
            cleanupInputs();
            cleanupInputs = null;
        }
        
        updateStatusUI('Disconnected', 'disconnected');
        connectBtn.disabled = false;
        disconnectBtn.disabled = true;
        
        // Show login center card again
        loginScreen.classList.remove('hidden');
        floatingBar.classList.add('hidden');

        fileTransferPanel.classList.remove('visible');
        uploadBtn.disabled = true;
        downloadBtn.disabled = true;
        fileListEl.innerHTML = '';
    }

    return {
        connect,
        disconnect,
        cleanup,
        triggerCAD,
        getTargetResolution,
        calculateResolution,
        applyResolution,
        getSession: () => session,
    };
}
