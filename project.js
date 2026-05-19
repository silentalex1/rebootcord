* { margin: 0; padding: 0; box-sizing: border-box; }

body {
    font-family: 'Segoe UI', sans-serif;
    background: #0a0a0a;
    color: #fff;
    min-height: 100vh;
}

.topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 32px;
    height: 60px;
    background: #0d0d0d;
    border-bottom: 1px solid #1a1a1a;
    position: sticky;
    top: 0;
    z-index: 10;
}

.brand {
    font-size: 1.2rem;
    font-weight: 800;
    display: flex;
    align-items: center;
    gap: 8px;
}

.brand span:not(.brand-dot) { color: #e74c3c; }

.brand-dot {
    width: 8px;
    height: 8px;
    background: #e74c3c;
    border-radius: 50%;
    box-shadow: 0 0 8px #e74c3c;
    display: inline-block;
}

.user-area {
    display: flex;
    align-items: center;
    gap: 16px;
}

.user-area span { color: #666; font-size: 0.9rem; }

.back-link {
    color: #666;
    font-size: 0.85rem;
    text-decoration: none;
    transition: color 0.2s;
}

.back-link:hover { color: #fff; }

.user-area button {
    background: #1a1a1a;
    color: #999;
    border: 1px solid #222;
    border-radius: 8px;
    padding: 7px 14px;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s;
}

.user-area button:hover { color: #fff; border-color: #333; }

.main {
    max-width: 1100px;
    margin: 0 auto;
    padding: 40px 24px;
}

.loading-state {
    color: #444;
    font-size: 0.95rem;
    padding: 60px 0;
    text-align: center;
}

.project-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 40px;
    gap: 16px;
    flex-wrap: wrap;
}

.project-title-row {
    display: flex;
    align-items: center;
    gap: 16px;
}

.project-icon {
    width: 52px;
    height: 52px;
    background: #1a1a1a;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.4rem;
    border: 1px solid #222;
}

.project-header h2 {
    font-size: 1.6rem;
    font-weight: 800;
    margin-bottom: 8px;
}

.project-meta {
    display: flex;
    align-items: center;
    gap: 10px;
}

.badge {
    display: inline-block;
    background: #1e1e1e;
    color: #666;
    font-size: 0.72rem;
    font-weight: 700;
    padding: 3px 10px;
    border-radius: 20px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border: 1px solid #2a2a2a;
}

.status-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #111;
    border: 1px solid #2a2a2a;
    border-radius: 20px;
    padding: 4px 10px;
    font-size: 0.78rem;
    font-weight: 600;
    color: #555;
}

.status-pill.online { border-color: #1a3a1a; color: #2ecc71; }

.status-dot-sm {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #444;
    flex-shrink: 0;
}

.status-pill.online .status-dot-sm {
    background: #2ecc71;
    box-shadow: 0 0 5px #2ecc71;
}

.header-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

.btn-start {
    background: #2ecc71;
    color: #000;
    border: none;
    border-radius: 10px;
    padding: 12px 22px;
    font-size: 0.88rem;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.2s;
}

.btn-start:hover { opacity: 0.85; }

.btn-stop {
    background: #e74c3c;
    color: #fff;
    border: none;
    border-radius: 10px;
    padding: 12px 22px;
    font-size: 0.88rem;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.2s;
}

.btn-stop:hover { opacity: 0.85; }

.btn-delete {
    background: transparent;
    color: #555;
    border: 1px solid #222;
    border-radius: 10px;
    padding: 12px 22px;
    font-size: 0.88rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-delete:hover { color: #e74c3c; border-color: #e74c3c; }

.panels {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
}

.panel {
    background: #111;
    border: 1px solid #1e1e1e;
    border-radius: 14px;
    overflow: hidden;
}

.panel-full {
    grid-column: 1 / -1;
}

.panel-title {
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #555;
    padding: 16px 20px;
    border-bottom: 1px solid #1a1a1a;
}

.panel-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid #1a1a1a;
}

.panel-title-row .panel-title {
    padding: 0;
    border: none;
}

.btn-clear {
    background: transparent;
    color: #444;
    border: 1px solid #222;
    border-radius: 7px;
    padding: 5px 12px;
    font-size: 0.78rem;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-clear:hover { color: #999; border-color: #333; }

.panel-body {
    padding: 20px;
}

.panel-desc {
    color: #555;
    font-size: 0.85rem;
    margin-bottom: 16px;
    line-height: 1.5;
}

.panel-desc code {
    font-family: monospace;
    background: #1a1a1a;
    color: #e74c3c;
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 0.82rem;
}

.token-row {
    display: flex;
    gap: 10px;
}

.token-row input {
    flex: 1;
    background: #0d0d0d;
    border: 1px solid #222;
    border-radius: 10px;
    padding: 12px 16px;
    color: #fff;
    font-size: 0.9rem;
    outline: none;
    transition: border-color 0.2s;
    font-family: monospace;
}

.token-row input:focus { border-color: #e74c3c; }
.token-row input::placeholder { color: #333; }

.token-row button {
    background: #e74c3c;
    color: #fff;
    border: none;
    border-radius: 10px;
    padding: 12px 20px;
    font-size: 0.88rem;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    transition: opacity 0.2s;
}

.token-row button:hover { opacity: 0.85; }

.field-msg {
    font-size: 0.8rem;
    margin-top: 10px;
    min-height: 14px;
    color: #2ecc71;
}

.field-msg.error { color: #e74c3c; }

.upload-area {
    border: 2px dashed #222;
    border-radius: 12px;
    padding: 32px 20px;
    text-align: center;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
}

.upload-area:hover { border-color: #e74c3c; background: #0f0808; }
.upload-area.dragging { border-color: #e74c3c; background: #130a0a; }

.upload-icon { font-size: 1.6rem; margin-bottom: 10px; }

.upload-label {
    font-size: 0.9rem;
    color: #666;
}

.upload-link {
    color: #e74c3c;
    cursor: pointer;
    text-decoration: underline;
}

.upload-hint {
    font-size: 0.78rem;
    color: #444;
    margin-top: 6px;
}

.log-box {
    background: #080808;
    border-radius: 0 0 14px 14px;
    padding: 16px 20px;
    min-height: 260px;
    max-height: 400px;
    overflow-y: auto;
    font-family: 'Courier New', monospace;
    font-size: 0.8rem;
    line-height: 1.6;
}

.log-entry {
    padding: 2px 0;
    word-break: break-all;
}

.log-entry.out { color: #ccc; }
.log-entry.err { color: #e74c3c; }
.log-entry.sys { color: #555; }

.log-time {
    color: #333;
    margin-right: 8px;
    user-select: none;
}

.log-empty {
    color: #333;
    font-size: 0.82rem;
    padding: 40px 0;
    text-align: center;
    font-family: 'Segoe UI', sans-serif;
}

.hidden { display: none; }

.not-found {
    text-align: center;
    padding: 80px 0;
    color: #444;
}

.not-found a {
    color: #e74c3c;
    text-decoration: none;
    font-size: 0.9rem;
    margin-top: 12px;
    display: inline-block;
}

@media (max-width: 700px) {
    .panels { grid-template-columns: 1fr; }
    .panel-full { grid-column: 1; }
    .project-header { flex-direction: column; }
    .topbar { padding: 0 16px; }
    .main { padding: 24px 16px; }
}
