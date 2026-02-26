const Sounds = (() => {
    let ctx = null;
    let muted = false;

    function getCtx() {
        if (!ctx) {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
    }

    function setMuted(v) { muted = !!v; }
    function isMuted() { return muted; }

    function click() {
        if (muted) return;
        const c = getCtx();
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(1500, c.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, c.currentTime + 0.03);
        gain.gain.setValueAtTime(0.08, c.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.04);
        osc.connect(gain).connect(c.destination);
        osc.start(c.currentTime);
        osc.stop(c.currentTime + 0.04);
    }

    function hover() {
        if (muted) return;
        const c = getCtx();
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(2200, c.currentTime);
        gain.gain.setValueAtTime(0.025, c.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.02);
        osc.connect(gain).connect(c.destination);
        osc.start(c.currentTime);
        osc.stop(c.currentTime + 0.02);
    }

    function tick() {
        if (muted) return;
        const c = getCtx();
        const bufLen = c.sampleRate * 0.012;
        const buf = c.createBuffer(1, bufLen, c.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufLen);
        }
        const src = c.createBufferSource();
        const gain = c.createGain();
        src.buffer = buf;
        gain.gain.setValueAtTime(0.04, c.currentTime);
        src.connect(gain).connect(c.destination);
        src.start(c.currentTime);
    }

    function bootSweep() {
        if (muted) return;
        const c = getCtx();
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, c.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, c.currentTime + 0.5);
        gain.gain.setValueAtTime(0.06, c.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.6);
        osc.connect(gain).connect(c.destination);
        osc.start(c.currentTime);
        osc.stop(c.currentTime + 0.6);
    }

    function bootConfirm() {
        if (muted) return;
        const c = getCtx();
        [0, 0.08].forEach(delay => {
            const osc = c.createOscillator();
            const gain = c.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1200, c.currentTime + delay);
            gain.gain.setValueAtTime(0.07, c.currentTime + delay);
            gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + 0.06);
            osc.connect(gain).connect(c.destination);
            osc.start(c.currentTime + delay);
            osc.stop(c.currentTime + delay + 0.06);
        });
    }

    function init() {
        document.querySelectorAll('.transport-btn, .skip-btn, .util-btn, .overlay-close').forEach(el => {
            el.addEventListener('mousedown', click);
            el.addEventListener('mouseenter', hover);
        });
    }

    document.addEventListener('DOMContentLoaded', init);

    return { click, hover, tick, bootSweep, bootConfirm, setMuted, isMuted };
})();
