const Knobs = (() => {
    const ARC_DEGREES = 270;
    const MIN_ANGLE = -135;

    const knobs = {};

    function init() {
        initKnob('volume-knob', onVolumeChange);
        initKnob('speed-knob', onSpeedChange);
    }

    function initKnob(elementId, onChange) {
        const el = document.getElementById(elementId);
        if (!el) return;

        let min = parseFloat(el.dataset.min);
        let max = parseFloat(el.dataset.max);
        const defaultVal = parseFloat(el.dataset.default || el.dataset.value);
        let value = parseFloat(el.dataset.value);
        if (Number.isNaN(min)) min = 0;
        if (Number.isNaN(max)) max = 1;
        if (min >= max) max = min + 1;
        if (Number.isNaN(value) || value < min || value > max) value = min;
        const safeDefault = Number.isNaN(defaultVal) || defaultVal < min || defaultVal > max ? value : defaultVal;

        const notch = el.querySelector('.knob-notch');
        if (!notch) return;
        const state = { el, notch, min, max, value, defaultVal: safeDefault, onChange };
        knobs[elementId] = state;

        updateKnobVisual(state);

        let startY = 0;
        let startValue = 0;

        el.addEventListener('mousedown', e => {
            e.preventDefault();
            startY = e.clientY;
            startValue = state.value;

            const onMove = ev => {
                const dy = startY - ev.clientY;
                const range = state.max - state.min;
                const sensitivity = range / 150;
                let newVal = startValue + dy * sensitivity;
                newVal = Math.max(state.min, Math.min(state.max, newVal));

                state.value = Math.round(newVal * 20) / 20;
                el.dataset.value = state.value;
                updateKnobVisual(state);
                state.onChange(state.value);
            };

            const onUp = () => {
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
            };

            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
        });

        const step = (max - min) / 30;
        el.addEventListener('wheel', e => {
            e.preventDefault();
            const delta = e.deltaY < 0 ? step : -step;
            state.value = Math.max(state.min, Math.min(state.max,
                Math.round((state.value + delta) * 20) / 20));
            el.dataset.value = state.value;
            updateKnobVisual(state);
            state.onChange(state.value);
            if (typeof Sounds !== 'undefined') Sounds.tick();
        }, { passive: false });

        el.addEventListener('dblclick', () => {
            state.value = state.defaultVal;
            el.dataset.value = state.value;
            updateKnobVisual(state);
            state.onChange(state.value);
        });
    }

    function updateKnobVisual(state) {
        if (!state.notch) return;
        const range = state.max - state.min;
        const pct = range <= 0 ? 0 : (state.value - state.min) / range;
        const angle = MIN_ANGLE + pct * ARC_DEGREES;
        state.notch.style.transform = `rotate(${angle}deg)`;
    }

    // ── Callbacks ────────────────────────────────────────────────

    function onVolumeChange(value) {
        Visualizer.setVolume(value);
    }

    function onSpeedChange(value) {
        const audio = App.getAudio();
        if (audio) {
            audio.playbackRate = value;
        }
        const indicator = document.getElementById('speed-indicator');
        if (indicator) {
            indicator.textContent = value.toFixed(1) + 'x';
        }
    }

    function adjustVolume(delta) {
        const state = knobs['volume-knob'];
        if (!state) return;
        let newVal = state.value + delta;
        newVal = Math.max(state.min, Math.min(state.max, newVal));
        state.value = Math.round(newVal * 20) / 20;
        state.el.dataset.value = state.value;
        updateKnobVisual(state);
        state.onChange(state.value);
    }

    document.addEventListener('DOMContentLoaded', init);

    return { adjustVolume };
})();
