/**
 * Main application controller for the Foobskin audiobook player.
 * Bridges the pywebview Python API with the HTML frontend.
 */

const App = (() => {
    let audio = null;
    let pyApi = null;
    let currentFile = null;
    let isPlaying = false;
    let updateTimer = null;

    function init() {
        audio = document.getElementById('audio-element');

        audio.addEventListener('play', onPlay);
        audio.addEventListener('pause', onPause);
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('timeupdate', onTimeUpdate);
        audio.addEventListener('loadedmetadata', onMetadataLoaded);
        audio.addEventListener('error', onAudioError);

        setupTransportButtons();
        setupSkipButtons();
        setupProgressBar();
        setupWindowControls();
        setupKeyboard();
        setupTitleClick();
        startDataStream();
        initTechReadout();

        waitForPywebview();
    }

    function waitForPywebview() {
        if (window.pywebview && window.pywebview.api) {
            pyApi = window.pywebview.api;
            onApiReady();
        } else {
            window.addEventListener('pywebviewready', () => {
                pyApi = window.pywebview.api;
                onApiReady();
            });
        }
    }

    function onApiReady() {
        Library.init(pyApi);

        pyApi.get_settings().then(settings => {
            if (settings.whisper_model) {
                const sel = document.getElementById('setting-model');
                if (sel) sel.value = settings.whisper_model;
            }
            if (settings.language) {
                const sel = document.getElementById('setting-language');
                if (sel) sel.value = settings.language;
            }
            if (settings.mute_sounds) {
                const cb = document.getElementById('setting-mute');
                if (cb) cb.checked = true;
                Sounds.setMuted(true);
            }
        });

        setupSettingsHandlers();
    }

    // ── Audio loading ────────────────────────────────────────────

    function loadAudio(fileInfo) {
        if (!fileInfo || !fileInfo.url) return;

        currentFile = fileInfo;
        audio.src = fileInfo.url;
        audio.load();
        stopDataStream();

        document.getElementById('title-text').textContent =
            fileInfo.filename || 'AudioBook Player';

        Transcription.reset();

        if (pyApi) {
            pyApi.start_transcription(fileInfo.filepath).then(() => {
                Transcription.startPolling(pyApi);
            }).catch(() => {
                Transcription.startPolling(pyApi);
            });
        }
    }

    // ── Transport controls ───────────────────────────────────────

    function setupTransportButtons() {
        document.getElementById('btn-play').addEventListener('click', play);
        document.getElementById('btn-pause').addEventListener('click', pause);
        document.getElementById('btn-stop').addEventListener('click', stop);
        document.getElementById('btn-rewind').addEventListener('click', rewind);
        document.getElementById('btn-ff').addEventListener('click', fastForward);
    }

    function play() {
        if (!audio.src) {
            if (pyApi) {
                pyApi.open_file().then(result => {
                    if (result) {
                        loadAudio(result);
                        audio.play();
                    }
                });
            }
            return;
        }
        audio.play();
    }

    function pause() {
        audio.pause();
    }

    function stop() {
        audio.pause();
        audio.currentTime = 0;
        updateTransportState(false);
    }

    function rewind() {
        audio.currentTime = Math.max(0, audio.currentTime - 10);
        flashButton('btn-rewind');
    }

    function fastForward() {
        audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 10);
        flashButton('btn-ff');
    }

    function flashButton(id) {
        const btn = document.getElementById(id);
        btn.classList.add('active');
        setTimeout(() => {
            if (id !== 'btn-play' && id !== 'btn-pause') {
                btn.classList.remove('active');
            }
        }, 200);
    }

    // ── Skip buttons ─────────────────────────────────────────────

    function setupSkipButtons() {
        document.querySelectorAll('.skip-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const skip = parseFloat(btn.dataset.skip);
                audio.currentTime = Math.max(0,
                    Math.min(audio.duration || 0, audio.currentTime + skip));
            });
        });
    }

    // ── Progress bar ─────────────────────────────────────────────

    function setupProgressBar() {
        const bar = document.getElementById('progress-bar');
        let dragging = false;

        function seek(e) {
            const rect = bar.getBoundingClientRect();
            const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            if (audio.duration) {
                audio.currentTime = pct * audio.duration;
            }
        }

        bar.addEventListener('mousedown', e => {
            dragging = true;
            seek(e);
        });

        window.addEventListener('mousemove', e => {
            if (dragging) seek(e);
        });

        window.addEventListener('mouseup', () => {
            dragging = false;
        });
    }

    // ── Window controls ──────────────────────────────────────────

    function setupWindowControls() {
        document.getElementById('btn-minimize').addEventListener('click', () => {
            if (pyApi) pyApi.minimize_window();
        });
        document.getElementById('btn-close').addEventListener('click', () => {
            if (pyApi) pyApi.close_window();
        });
    }

    // ── Title click → library ────────────────────────────────────

    function setupTitleClick() {
        document.getElementById('title-text').addEventListener('click', () => {
            Library.toggle();
        });
    }

    // ── Keyboard shortcuts ───────────────────────────────────────

    function setupKeyboard() {
        document.addEventListener('keydown', e => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    isPlaying ? pause() : play();
                    break;
                case 'ArrowLeft':
                    audio.currentTime = Math.max(0, audio.currentTime - 5);
                    break;
                case 'ArrowRight':
                    audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    Knobs.adjustVolume(0.05);
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    Knobs.adjustVolume(-0.05);
                    break;
                case 'Escape':
                    closeAllOverlays();
                    break;
            }
        });
    }

    // ── Audio event handlers ─────────────────────────────────────

    function onPlay() {
        isPlaying = true;
        updateTransportState(true);
        Visualizer.start();
    }

    function onPause() {
        isPlaying = false;
        updateTransportState(false);
    }

    function onEnded() {
        isPlaying = false;
        updateTransportState(false);
    }

    function onTimeUpdate() {
        updateTimeDisplay();
        updateProgressBar();
        Transcription.sync(audio.currentTime);
    }

    function onMetadataLoaded() {
        updateTimeDisplay();
        Visualizer.connectAudio(audio);
    }

    function onAudioError() {
        console.error('Audio error:', audio.error);
    }

    // ── UI updates ───────────────────────────────────────────────

    function updateTransportState(playing) {
        const btnPlay = document.getElementById('btn-play');
        const btnPause = document.getElementById('btn-pause');

        if (playing) {
            btnPlay.classList.remove('active');
            btnPause.classList.add('active');
        } else {
            btnPlay.classList.add('active');
            btnPause.classList.remove('active');
        }
    }

    function updateTimeDisplay() {
        const current = audio.currentTime || 0;
        const total = audio.duration || 0;
        const remaining = total - current;

        document.getElementById('time-current').textContent = formatTime(current);
        document.getElementById('time-total').textContent = formatTime(total);
        document.getElementById('time-remaining').textContent = '-' + formatTime(remaining);
    }

    function updateProgressBar() {
        const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
        document.getElementById('progress-fill').style.width = pct + '%';
    }

    function formatTime(seconds) {
        if (!isFinite(seconds) || seconds < 0) seconds = 0;
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) {
            return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    // ── Settings handlers ────────────────────────────────────────

    function setupSettingsHandlers() {
        document.getElementById('btn-settings').addEventListener('click', () => {
            toggleOverlay('settings-overlay');
        });
        document.getElementById('settings-close').addEventListener('click', () => {
            hideOverlay('settings-overlay');
        });

        document.getElementById('btn-bookmarks').addEventListener('click', () => {
            if (currentFile && pyApi) {
                Bookmarks.load(pyApi, currentFile.filepath);
            }
            toggleOverlay('bookmarks-overlay');
        });
        document.getElementById('bookmarks-close').addEventListener('click', () => {
            hideOverlay('bookmarks-overlay');
        });
        document.getElementById('btn-add-bookmark').addEventListener('click', () => {
            if (currentFile && pyApi) {
                const time = audio.currentTime;
                const label = formatTime(time) + ' bookmark';
                pyApi.save_bookmark(currentFile.filepath, time, label).then(() => {
                    Bookmarks.load(pyApi, currentFile.filepath);
                });
            }
        });

        const modelSel = document.getElementById('setting-model');
        modelSel.addEventListener('change', () => {
            if (pyApi) pyApi.update_settings('whisper_model', modelSel.value);
        });

        const langSel = document.getElementById('setting-language');
        langSel.addEventListener('change', () => {
            if (pyApi) pyApi.update_settings('language', langSel.value);
        });

        const muteCb = document.getElementById('setting-mute');
        if (muteCb) {
            muteCb.addEventListener('change', () => {
                Sounds.setMuted(muteCb.checked);
                if (pyApi) pyApi.update_settings('mute_sounds', muteCb.checked);
            });
        }

        document.querySelectorAll('.overlay').forEach(overlay => {
            overlay.addEventListener('click', e => {
                if (e.target === overlay) {
                    overlay.classList.add('hidden');
                }
            });
        });
    }

    // ── Overlay management ───────────────────────────────────────

    function toggleOverlay(id) {
        const el = document.getElementById(id);
        el.classList.toggle('hidden');
    }

    function hideOverlay(id) {
        document.getElementById(id).classList.add('hidden');
    }

    function closeAllOverlays() {
        document.querySelectorAll('.overlay').forEach(o => o.classList.add('hidden'));
    }

    // ── Tech readout scrolling text ──────────────────────────────

    function initTechReadout() {
        const el = document.getElementById('tech-readout-text');
        if (!el) return;
        const codes = [
            'ISB-7734', 'FREQ:2187.4MHz', 'LAT:+41.09', 'LON:-73.55',
            'PWR:98.2%', 'SIG:NOMINAL', 'COMP:ONLINE', 'SEC-LVL:AUREK',
            'NODE:TK-421', 'BAND:ALPHA-7', 'PROC:4.7GHz', 'MEM:16.0TB',
            'LINK:ACTIVE', 'SCAN:0xF7A2', 'AUTH:GRANTED', 'SYNC:LOCKED',
        ];
        const text = codes.join('  //  ') + '  //  ';
        el.textContent = text + text;
    }

    // ── Idle Aurebesh data stream ────────────────────────────────

    let dataStreamInterval = null;

    function startDataStream() {
        const canvas = document.getElementById('data-stream-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const aurebeshChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const columns = [];

        function resize() {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
            const colCount = Math.floor(canvas.width / 14);
            columns.length = 0;
            for (let i = 0; i < colCount; i++) {
                columns.push(Math.random() * canvas.height);
            }
        }

        resize();
        window.addEventListener('resize', resize);

        dataStreamInterval = setInterval(() => {
            ctx.fillStyle = 'rgba(6, 8, 9, 0.15)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.font = '12px Aurebesh, monospace';
            ctx.fillStyle = 'rgba(0, 221, 68, 0.35)';

            for (let i = 0; i < columns.length; i++) {
                const char = aurebeshChars[Math.floor(Math.random() * aurebeshChars.length)];
                ctx.fillText(char, i * 14, columns[i]);
                if (columns[i] > canvas.height && Math.random() > 0.97) {
                    columns[i] = 0;
                }
                columns[i] += 14;
            }
        }, 80);
    }

    function stopDataStream() {
        if (dataStreamInterval) {
            clearInterval(dataStreamInterval);
            dataStreamInterval = null;
        }
    }

    // ── Public API ───────────────────────────────────────────────

    return {
        init,
        loadAudio,
        getAudio: () => audio,
        getApi: () => pyApi,
        getCurrentFile: () => currentFile,
        formatTime,
        isPlaying: () => isPlaying,
        closeAllOverlays,
        stopDataStream,
    };
})();


const Bookmarks = (() => {
    function load(pyApi, filepath) {
        pyApi.get_bookmarks(filepath).then(bookmarks => {
            render(bookmarks, pyApi, filepath);
        });
    }

    function render(bookmarks, pyApi, filepath) {
        const container = document.getElementById('bookmark-items');
        if (!bookmarks || bookmarks.length === 0) {
            container.innerHTML = '<div style="padding:10px;color:#335;font-style:italic;">No bookmarks yet</div>';
            return;
        }

        container.innerHTML = bookmarks.map(bm => `
            <div class="bookmark-item" data-position="${bm.position}" data-id="${bm.id}">
                <span class="bm-time">${App.formatTime(bm.position)}</span>
                <span class="bm-label">${bm.label}</span>
                <span class="bm-delete" title="Delete">&times;</span>
            </div>
        `).join('');

        container.querySelectorAll('.bookmark-item').forEach(item => {
            item.addEventListener('click', e => {
                if (e.target.classList.contains('bm-delete')) {
                    pyApi.delete_bookmark(item.dataset.id).then(() => {
                        load(pyApi, filepath);
                    });
                } else {
                    const audio = App.getAudio();
                    audio.currentTime = parseFloat(item.dataset.position);
                    audio.play();
                    App.closeAllOverlays();
                }
            });
        });
    }

    return { load };
})();


document.addEventListener('DOMContentLoaded', App.init);
