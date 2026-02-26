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

        pyApi.scan_library().then(data => {
            if (!data || (Array.isArray(data) && data.length === 0)) {
                container.innerHTML = '<div style="padding:10px;color:#335;font-style:italic;">No audiobooks found. Set a library folder to get started.</div>';
                return;
            }
            const loose = (data && data.loose) ? data.loose : [];
            const books = (data && data.books) ? data.books : [];
            if (loose.length === 0 && books.length === 0) {
                container.innerHTML = '<div style="padding:10px;color:#335;font-style:italic;">No audiobooks found. Set a library folder to get started.</div>';
                return;
            }
            renderLibrary(container, loose, books);
        }).catch(() => {
            container.innerHTML = '<div style="padding:10px;color:#c44;">Could not scan library.</div>';
        });
    }

    function renderLibrary(container, loose, books) {
        const parts = [];

        loose.forEach(f => {
            const badge = f.has_transcript ? '<span class="item-badge">[T]</span>' : '';
            parts.push(`<div class="library-item" data-path="${escapeAttr(f.path)}" data-type="file">
                <span class="item-name">${escapeHtml(f.name)}</span>
                ${badge}
            </div>`);
        });

        books.forEach(book => {
            const firstPath = book.files && book.files[0] ? book.files[0].path : '';
            const count = book.files ? book.files.length : 0;
            const trackLabel = count > 0 ? `<span class="item-folder">${count} track${count !== 1 ? 's' : ''}</span>` : '';
            const bookPaths = book.files ? encodeURIComponent(JSON.stringify(book.files.map(f => f.path))) : '';
            parts.push(`<div class="library-item library-item-book" data-type="book" data-path="${escapeAttr(book.path)}" data-first-path="${escapeAttr(firstPath)}" data-book-paths="${escapeAttr(bookPaths)}">
                <span class="item-name">${escapeHtml(book.name)}</span>
                ${trackLabel}
            </div>`);
        });

        container.innerHTML = parts.join('');

        container.querySelectorAll('.library-item').forEach(item => {
            item.addEventListener('click', () => {
                const type = item.dataset.type || 'file';
                const pathToLoad = type === 'book' ? item.dataset.firstPath : item.dataset.path;
                if (!pathToLoad) return;
                const bookFilepaths = type === 'book' && item.dataset.bookPaths ?
                    JSON.parse(decodeURIComponent(item.dataset.bookPaths)) : null;
                pyApi.load_file(pathToLoad, bookFilepaths).then(result => {
                    if (result) {
                        App.loadAudio(result);
                        hide();
                        App.playWhenReady();
                    } else {
                        container.innerHTML = '<div style="padding:10px;color:#c44;">File not found. It may have been moved or deleted.</div>';
                    }
                }).catch(() => {
                    container.innerHTML = '<div style="padding:10px;color:#c44;">Could not open file.</div>';
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
                            App.playWhenReady();
                        } else {
                            container.innerHTML = '<div style="padding:8px;color:#c44;">File not found.</div>';
                        }
                    }).catch(() => {
                        container.innerHTML = '<div style="padding:8px;color:#c44;">Could not open file.</div>';
                    });
                });
            });
        }).catch(() => {
            const container = document.getElementById('recent-items');
            container.innerHTML = '<div style="padding:8px;color:#c44;">Could not load recent files.</div>';
        });
    }

    // ── Folder path display ──────────────────────────────────────

    function loadFolderPath() {
        if (!pyApi) return;
        pyApi.get_library_folder().then(path => {
            const el = document.getElementById('library-folder-path');
            el.textContent = path || '(no folder set)';
        }).catch(() => {});
    }

    // ── Actions ──────────────────────────────────────────────────

    function openFile() {
        if (!pyApi) return;
        pyApi.open_file().then(result => {
            if (result) {
                App.loadAudio(result);
                hide();
                App.playWhenReady();
            }
        }).catch(() => {});
    }

    function setFolder() {
        if (!pyApi) return;
        const pathEl = document.getElementById('library-folder-path');
        pyApi.set_library_folder().then(path => {
            if (path) {
                loadFolderPath();
                loadLibrary();
            } else {
                if (pathEl) pathEl.textContent = '(cancelled)';
            }
        }).catch(() => {
            if (pathEl) pathEl.textContent = '(error)';
            const container = document.getElementById('library-items');
            if (container) container.innerHTML = '<div style="padding:10px;color:#c44;">Could not set folder.</div>';
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
