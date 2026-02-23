/**
 * Imperial boot-up sequence with game-launcher model management.
 * 1. Typewriter boot lines (skippable)
 * 2. Wait for pywebview API
 * 3. Check available models
 * 4. If configured model is cached → show "ONLINE" → fade out
 * 5. If not → show model selector → download with progress → fade out
 */

const Boot = (() => {
    const LINES = [
        'IMPERIAL AUDIO SYSTEMS v2.7.1',
        'INITIALIZING COMM ARRAY...',
        'LOADING SIGNAL PROCESSORS...',
        'CALIBRATING AUDIO MODULATORS...',
    ];

    const CHAR_DELAY = 35;
    const LINE_PAUSE = 200;

    function run() {
        const screen = document.getElementById('boot-screen');
        if (!screen) return;

        const linesEl = document.getElementById('boot-lines');
        const progressFill = document.getElementById('boot-progress-fill');
        let skipped = false;

        function skip() {
            if (skipped) return;
            skipped = true;
            finishTypewriter();
        }

        screen.addEventListener('click', skip);
        document.addEventListener('keydown', skip, { once: true });

        Sounds.bootSweep();

        let totalChars = LINES.reduce((s, l) => s + l.length, 0);
        let charsDone = 0;

        (async () => {
            for (let i = 0; i < LINES.length; i++) {
                if (skipped) return;

                const lineEl = document.createElement('div');
                lineEl.className = 'boot-line visible';
                linesEl.appendChild(lineEl);

                const line = LINES[i];
                for (let j = 0; j < line.length; j++) {
                    if (skipped) return;
                    lineEl.textContent = line.substring(0, j + 1);
                    charsDone++;
                    progressFill.style.width = (charsDone / totalChars * 100) + '%';
                    await delay(CHAR_DELAY);
                }

                if (i < LINES.length - 1) {
                    await delay(LINE_PAUSE);
                }
            }

            finishTypewriter();
        })();

        function finishTypewriter() {
            progressFill.style.width = '100%';
            screen.removeEventListener('click', skip);
            checkModels();
        }
    }

    async function checkModels() {
        const api = await waitForApi();
        const linesEl = document.getElementById('boot-lines');

        const checkLine = document.createElement('div');
        checkLine.className = 'boot-line visible';
        checkLine.innerHTML = 'SCANNING LOCAL MODEL CACHE<span class="loading-dots"></span>';
        linesEl.appendChild(checkLine);

        let models;
        try {
            models = await api.get_available_models();
        } catch (e) {
            checkLine.textContent = 'MODEL CHECK FAILED — PROCEEDING';
            await delay(500);
            fadeOut();
            return;
        }

        const configured = models.find(m => m.configured);
        const anyCached = models.some(m => m.cached);

        if (configured && configured.cached) {
            addBootLine(linesEl, 'WHISPER MODEL: ' + configured.name.toUpperCase() + ' // ONLINE');
            Sounds.bootConfirm();
            await delay(600);
            fadeOut();
        } else if (anyCached) {
            const firstCached = models.find(m => m.cached);
            addBootLine(linesEl, 'WHISPER MODEL: ' + firstCached.name.toUpperCase() + ' // ONLINE');
            Sounds.bootConfirm();
            await delay(600);
            fadeOut();
        } else {
            addBootLine(linesEl, 'NO WHISPER MODEL FOUND');
            await delay(400);
            showModelSelector(models);
        }
    }

    function showModelSelector(models) {
        const linesEl = document.getElementById('boot-lines');
        const progressBar = document.getElementById('boot-progress-bar');
        const selector = document.getElementById('boot-model-select');
        const grid = document.getElementById('boot-model-grid');

        linesEl.classList.add('boot-hidden');
        progressBar.classList.add('boot-hidden');
        selector.classList.remove('boot-hidden');

        grid.innerHTML = models.map(m => {
            const cachedClass = m.cached ? ' cached' : '';
            const badge = m.cached ? '<span class="model-cached-badge">READY</span>' : '';
            return '<div class="boot-model-card' + cachedClass + '" data-model="' + m.name + '">' +
                '<div class="model-name"><span>' + m.name.toUpperCase() + '</span>' + badge + '</div>' +
                '<div class="model-desc">' + (m.desc || '') + '</div>' +
                '<div class="model-size">' + (m.size || '') + '</div>' +
            '</div>';
        }).join('');

        grid.querySelectorAll('.boot-model-card').forEach(card => {
            card.addEventListener('click', () => {
                const name = card.dataset.model;
                Sounds.click();
                if (card.classList.contains('cached')) {
                    selectCachedModel(name);
                } else {
                    startDownload(name);
                }
            });
        });
    }

    async function selectCachedModel(name) {
        const api = await waitForApi();
        await api.download_model(name);
        Sounds.bootConfirm();
        await delay(400);
        fadeOut();
    }

    async function startDownload(name) {
        const api = await waitForApi();
        const selector = document.getElementById('boot-model-select');
        const downloadStatus = document.getElementById('boot-download-status');
        const downloadLabel = document.getElementById('boot-download-label');
        const downloadFill = document.getElementById('boot-download-fill');
        const downloadDetail = document.getElementById('boot-download-detail');

        selector.classList.add('boot-hidden');
        downloadStatus.classList.remove('boot-hidden');
        downloadLabel.textContent = 'DOWNLOADING: ' + name.toUpperCase() + ' — 0%';
        downloadFill.style.width = '0%';

        await api.download_model(name);

        const pollInterval = setInterval(async () => {
            try {
                const progress = await api.get_download_progress();

                if (progress.status === 'downloading') {
                    const pct = Math.round(progress.percent || 0);
                    downloadLabel.textContent = 'DOWNLOADING: ' + name.toUpperCase() + ' — ' + pct + '%';
                    downloadFill.style.width = pct + '%';
                } else if (progress.status === 'complete') {
                    clearInterval(pollInterval);
                    downloadLabel.textContent = 'DOWNLOAD COMPLETE';
                    downloadFill.style.width = '100%';
                    downloadDetail.textContent = 'Model cached — ready for use';
                    Sounds.bootConfirm();
                    await delay(800);
                    fadeOut();
                } else if (progress.status === 'error') {
                    clearInterval(pollInterval);
                    downloadLabel.textContent = 'DOWNLOAD FAILED';
                    downloadDetail.textContent = progress.error || 'Unknown error';
                    downloadFill.style.width = '0%';
                    await delay(2000);
                    downloadStatus.classList.add('boot-hidden');
                    const models = await api.get_available_models();
                    showModelSelector(models);
                }
            } catch (e) {
                clearInterval(pollInterval);
            }
        }, 500);
    }

    function addBootLine(container, text) {
        const lineEl = document.createElement('div');
        lineEl.className = 'boot-line visible';
        lineEl.textContent = text;
        container.appendChild(lineEl);
    }

    function fadeOut() {
        const screen = document.getElementById('boot-screen');
        if (!screen) return;
        screen.classList.add('fade-out');
        setTimeout(() => {
            screen.remove();
        }, 700);
    }

    function waitForApi() {
        return new Promise(resolve => {
            if (window.pywebview && window.pywebview.api) {
                resolve(window.pywebview.api);
            } else {
                window.addEventListener('pywebviewready', () => {
                    resolve(window.pywebview.api);
                });
            }
        });
    }

    function delay(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    document.addEventListener('DOMContentLoaded', run);

    return { run };
})();
