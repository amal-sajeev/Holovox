/**
 * Imperial boot-up sequence.
 * Shows initialization messages with typewriter effect, then fades out.
 */

const Boot = (() => {
    const LINES = [
        'IMPERIAL AUDIO SYSTEMS v2.7.1',
        'INITIALIZING COMM ARRAY...',
        'LOADING SIGNAL PROCESSORS...',
        'CALIBRATING AUDIO MODULATORS...',
        'SYSTEM READY // AWAITING ORDERS',
    ];

    const CHAR_DELAY = 35;
    const LINE_PAUSE = 200;
    const FADE_DELAY = 400;

    function run() {
        const screen = document.getElementById('boot-screen');
        if (!screen) return;

        const linesEl = document.getElementById('boot-lines');
        const progressFill = document.getElementById('boot-progress-fill');
        let skipped = false;

        function skip() {
            if (skipped) return;
            skipped = true;
            finish();
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

            Sounds.bootConfirm();
            await delay(FADE_DELAY);
            finish();
        })();

        function finish() {
            progressFill.style.width = '100%';
            screen.classList.add('fade-out');
            setTimeout(() => {
                screen.remove();
            }, 700);
        }
    }

    function delay(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    document.addEventListener('DOMContentLoaded', run);

    return { run };
})();
