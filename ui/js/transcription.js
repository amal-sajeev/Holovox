/**
 * Live transcription display with word-level karaoke highlighting.
 * Updates both the main display (current segment, large text) and
 * the sidebar transcript (full scrolling list).
 */

const Transcription = (() => {
    let segments = [];
    let pollTimer = null;
    let lastSegmentCount = 0;
    let isComplete = false;
    let lastActiveIndex = -1;

    function reset() {
        segments = [];
        lastSegmentCount = 0;
        isComplete = false;
        lastActiveIndex = -1;
        stopPolling();

        const container = document.getElementById('transcript-content');
        container.innerHTML = '<p class="placeholder-text">Transcribing audio<span class="loading-dots"></span></p>';

        const mainDisplay = document.getElementById('main-display-text');
        mainDisplay.innerHTML = '<span class="display-placeholder">TRANSCRIBING...</span>';
    }

    function startPolling(pyApi) {
        stopPolling();
        pollTimer = setInterval(() => poll(pyApi), 1500);
        poll(pyApi);
    }

    function stopPolling() {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    }

    function poll(pyApi) {
        pyApi.get_transcription_progress().then(progress => {
            if (!progress) return;

            if (progress.status === 'error') {
                showError(progress.error || 'Transcription failed');
                stopPolling();
                return;
            }

            if (progress.segments && progress.segments.length > lastSegmentCount) {
                segments = progress.segments;
                lastSegmentCount = segments.length;
                renderSidebarSegments();
            }

            if (progress.status === 'complete') {
                isComplete = true;
                stopPolling();
                updateStatusIndicator('complete');
                updateProgressDisplay(null);
            } else if (progress.status === 'downloading') {
                updateStatusIndicator('loading');
                updateProgressDisplay('downloading', progress.download_percent, progress.model_name);
                updateSidebarStatus('Downloading model: ' + (progress.model_name || '').toUpperCase() + ' — ' + Math.round(progress.download_percent || 0) + '%');
            } else if (progress.status === 'loading') {
                updateStatusIndicator('loading');
                updateProgressDisplay('loading', 0);
                updateSidebarStatus('Loading speech model...');
            } else if (progress.status === 'transcribing') {
                updateStatusIndicator('transcribing', progress.percent);
                updateProgressDisplay('transcribing', progress.percent, null, progress.duration);
                if (segments.length === 0) {
                    if (progress.percent === 0 && progress.duration) {
                        var mins = Math.floor(progress.duration / 60);
                        var durLabel = mins > 0 ? mins + ' min' : Math.round(progress.duration) + 's';
                        updateSidebarStatus('Processing ' + durLabel + ' of audio — please wait');
                    } else {
                        updateSidebarStatus('Transcribing — ' + Math.round(progress.percent) + '%');
                    }
                }
            }
        });
    }

    // ── Sidebar transcript (small, scrolling) ────────────────────

    function renderSidebarSegments() {
        const container = document.getElementById('transcript-content');

        if (segments.length === 0) {
            container.innerHTML = '<p class="placeholder-text">No speech detected yet...</p>';
            return;
        }

        container.innerHTML = segments.map((seg, i) => {
            const wordsHtml = seg.words && seg.words.length > 0
                ? seg.words.map(w =>
                    `<span class="transcript-word" data-start="${w.start}" data-end="${w.end}">${escapeHtml(w.word)}</span>`
                ).join('')
                : escapeHtml(seg.text);

            return `<div class="transcript-segment" data-index="${i}" data-start="${seg.start}" data-end="${seg.end}">${wordsHtml}</div>`;
        }).join('');

        container.querySelectorAll('.transcript-segment').forEach(el => {
            el.addEventListener('click', () => {
                const time = parseFloat(el.dataset.start);
                const audio = App.getAudio();
                if (audio && isFinite(time)) {
                    audio.currentTime = time;
                    if (!App.isPlaying()) audio.play();
                }
            });
        });
    }

    // ── Main display (large, current segment only) ───────────────

    function updateMainDisplay(segIndex, currentTime) {
        const mainDisplay = document.getElementById('main-display-text');
        if (!mainDisplay) return;

        if (segIndex < 0 || segIndex >= segments.length) {
            if (lastActiveIndex !== -1) {
                mainDisplay.innerHTML = '<span class="display-placeholder">[ AWAITING SIGNAL ]</span>';
                lastActiveIndex = -1;
            }
            return;
        }

        const seg = segments[segIndex];

        if (segIndex !== lastActiveIndex) {
            lastActiveIndex = segIndex;

            if (seg.words && seg.words.length > 0) {
                mainDisplay.innerHTML = seg.words.map(w =>
                    `<span class="display-word" data-start="${w.start}" data-end="${w.end}">${escapeHtml(w.word)}</span>`
                ).join('');
            } else {
                mainDisplay.innerHTML = escapeHtml(seg.text);
            }
        }

        mainDisplay.querySelectorAll('.display-word').forEach(wordEl => {
            const wStart = parseFloat(wordEl.dataset.start);
            const wEnd = parseFloat(wordEl.dataset.end);
            wordEl.classList.toggle('spoken', currentTime >= wStart && currentTime < wEnd + 0.2);
        });
    }

    // ── Sync both displays with playback position ────────────────

    function sync(currentTime) {
        if (segments.length === 0) return;

        const container = document.getElementById('transcript-content');
        const segEls = container.querySelectorAll('.transcript-segment');

        let activeIndex = -1;

        segEls.forEach((el, i) => {
            const start = parseFloat(el.dataset.start);
            const end = parseFloat(el.dataset.end);
            const isActive = currentTime >= start && currentTime < end + 0.3;

            el.classList.toggle('active', isActive);
            if (isActive) activeIndex = i;

            el.querySelectorAll('.transcript-word').forEach(wordEl => {
                const wStart = parseFloat(wordEl.dataset.start);
                const wEnd = parseFloat(wordEl.dataset.end);
                wordEl.classList.toggle('spoken', currentTime >= wStart && currentTime < wEnd + 0.2);
            });
        });

        if (activeIndex >= 0) {
            const activeEl = segEls[activeIndex];
            const containerRect = container.getBoundingClientRect();
            const elRect = activeEl.getBoundingClientRect();

            if (elRect.bottom > containerRect.bottom - 20 || elRect.top < containerRect.top + 20) {
                activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }

        updateMainDisplay(activeIndex, currentTime);
    }

    function updateSidebarStatus(text) {
        const container = document.getElementById('transcript-content');
        const placeholder = container.querySelector('.placeholder-text');
        if (placeholder) {
            placeholder.innerHTML = text + '<span class="loading-dots"></span>';
        }
    }

    function updateProgressDisplay(status, percent, modelName, duration) {
        const mainDisplay = document.getElementById('main-display-text');
        if (!mainDisplay) return;

        if (!status) {
            if (segments.length === 0) {
                mainDisplay.innerHTML = '<span class="display-placeholder aurebesh" data-en="[ AWAITING SIGNAL ]">[ AWAITING SIGNAL ]</span>';
            }
            return;
        }

        const pct = Math.round(percent || 0);

        if (status === 'downloading') {
            const name = (modelName || 'whisper').toUpperCase();
            mainDisplay.innerHTML =
                '<div class="transcription-progress">' +
                    '<div class="progress-status">DOWNLOADING MODEL: ' + name + ' — ' + pct + '%</div>' +
                    '<div class="progress-bar-inline">' +
                        '<div class="progress-bar-track">' +
                            '<div class="progress-bar-fill" style="width:' + pct + '%"></div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="progress-detail">First-time setup — model will be cached locally</div>' +
                '</div>';
        } else if (status === 'loading') {
            mainDisplay.innerHTML =
                '<div class="transcription-progress">' +
                    '<div class="progress-status">LOADING WHISPER MODEL<span class="loading-dots"></span></div>' +
                    '<div class="progress-detail">Initializing speech recognition</div>' +
                '</div>';
        } else if (pct === 0 && segments.length === 0) {
            var detail = 'Analyzing speech patterns — this may take a moment';
            if (duration) {
                var mins = Math.floor(duration / 60);
                detail = mins > 0
                    ? 'Processing ' + mins + ' min of audio — this may take a moment'
                    : 'Processing ' + Math.round(duration) + 's of audio';
            }
            mainDisplay.innerHTML =
                '<div class="transcription-progress">' +
                    '<div class="progress-status">TRANSCRIBING AUDIO<span class="loading-dots"></span></div>' +
                    '<div class="progress-detail">' + detail + '</div>' +
                '</div>';
        } else {
            mainDisplay.innerHTML =
                '<div class="transcription-progress">' +
                    '<div class="progress-status">TRANSCRIBING AUDIO — ' + pct + '%</div>' +
                    '<div class="progress-bar-inline">' +
                        '<div class="progress-bar-track">' +
                            '<div class="progress-bar-fill" style="width:' + pct + '%"></div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="progress-detail">' + segments.length + ' segments decoded</div>' +
                '</div>';
        }
    }

    function updateStatusIndicator(status) {
        const leds = document.querySelectorAll('#status-leds .led');
        if (leds.length < 3) return;

        switch (status) {
            case 'loading':
                leds[0].className = 'led led-on';
                leds[1].className = 'led led-dim';
                leds[2].className = 'led led-dim';
                break;
            case 'transcribing':
                leds[0].className = 'led led-on';
                leds[1].className = 'led led-on';
                leds[2].className = 'led led-dim';
                break;
            case 'complete':
                leds[0].className = 'led led-on';
                leds[1].className = 'led led-on';
                leds[2].className = 'led led-on';
                break;
        }
    }

    function showError(message) {
        const container = document.getElementById('transcript-content');
        container.innerHTML = `<p style="color:#ff4444;padding:10px;">Error: ${escapeHtml(message)}</p>`;
        const mainDisplay = document.getElementById('main-display-text');
        mainDisplay.innerHTML = `<span style="color:#ff4444;font-size:14px;">Transcription Error</span>`;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    return { reset, startPolling, stopPolling, sync };
})();
