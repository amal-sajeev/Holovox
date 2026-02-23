/**
 * Audiobook library overlay panel.
 * Slides over the player to show library files and recent files.
 * Supports a configured library folder and one-off file opening.
 */

const Library = (() => {
    let pyApi = null;
    let isOpen = false;

    function init(api) {
        pyApi = api;

        document.getElementById('library-close').addEventListener('click', hide);
        document.getElementById('btn-open-file').addEventListener('click', openFile);
        document.getElementById('btn-set-folder').addEventListener('click', setFolder);

        loadFolderPath();
    }

    function toggle() {
        isOpen ? hide() : show();
    }

    function show() {
        const overlay = document.getElementById('library-overlay');
        overlay.classList.remove('hidden');
        isOpen = true;
        refresh();
    }

    function hide() {
        document.getElementById('library-overlay').classList.add('hidden');
        isOpen = false;
    }

    function refresh() {
        loadLibrary();
        loadRecent();
        loadFolderPath();
    }

    // ── Library folder scanning ──────────────────────────────────

    function loadLibrary() {
        if (!pyApi) return;

        const container = document.getElementById('library-items');
        container.innerHTML = '<div style="padding:10px;color:#335;font-style:italic;">Scanning...</div>';

        pyApi.scan_library().then(files => {
            if (!files || files.length === 0) {
                container.innerHTML = '<div style="padding:10px;color:#335;font-style:italic;">No audiobooks found. Set a library folder to get started.</div>';
                return;
            }
            renderFileList(container, files);
        });
    }

    function renderFileList(container, files) {
        container.innerHTML = files.map(f => {
            const badge = f.has_transcript ? '<span class="item-badge">[T]</span>' : '';
            const folder = f.folder !== '.' ? `<span class="item-folder">${f.folder}</span>` : '';
            return `<div class="library-item" data-path="${escapeAttr(f.path)}">
                <span class="item-name">${escapeHtml(f.name)}</span>
                ${folder}
                ${badge}
            </div>`;
        }).join('');

        container.querySelectorAll('.library-item').forEach(item => {
            item.addEventListener('click', () => {
                const path = item.dataset.path;
                pyApi.load_file(path).then(result => {
                    if (result) {
                        App.loadAudio(result);
                        hide();
                        App.getAudio().play();
                    }
                });
            });
        });
    }

    // ── Recent files ─────────────────────────────────────────────

    function loadRecent() {
        if (!pyApi) return;

        pyApi.get_recent_files().then(files => {
            const container = document.getElementById('recent-items');
            if (!files || files.length === 0) {
                container.innerHTML = '<div style="padding:8px;color:#335;font-style:italic;">No recent files</div>';
                return;
            }

            container.innerHTML = files.map(path => {
                const name = path.split(/[/\\]/).pop();
                return `<div class="recent-item" data-path="${escapeAttr(path)}">
                    <span class="item-name">${escapeHtml(name)}</span>
                </div>`;
            }).join('');

            container.querySelectorAll('.recent-item').forEach(item => {
                item.addEventListener('click', () => {
                    const path = item.dataset.path;
                    pyApi.load_file(path).then(result => {
                        if (result) {
                            App.loadAudio(result);
                            hide();
                            App.getAudio().play();
                        }
                    });
                });
            });
        });
    }

    // ── Folder path display ──────────────────────────────────────

    function loadFolderPath() {
        if (!pyApi) return;
        pyApi.get_library_folder().then(path => {
            const el = document.getElementById('library-folder-path');
            el.textContent = path || '(no folder set)';
        });
    }

    // ── Actions ──────────────────────────────────────────────────

    function openFile() {
        if (!pyApi) return;
        pyApi.open_file().then(result => {
            if (result) {
                App.loadAudio(result);
                hide();
                App.getAudio().play();
            }
        });
    }

    function setFolder() {
        if (!pyApi) return;
        pyApi.set_library_folder().then(path => {
            if (path) {
                loadFolderPath();
                loadLibrary();
            }
        });
    }

    // ── Helpers ──────────────────────────────────────────────────

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function escapeAttr(text) {
        return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    return { init, toggle, show, hide };
})();
