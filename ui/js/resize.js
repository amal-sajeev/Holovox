(function () {
    const EDGE = 6;
    const MIN_W = 950;
    const MIN_H = 600;

    let active = false;
    let edges = '';
    let sx, sy, geom;
    let pending = null;
    let inFlight = false;
    let api = null;

    function getApi() {
        if (window.pywebview && window.pywebview.api) return window.pywebview.api;
        return api;
    }

    function initResizeApi() {
        if (window.pywebview && window.pywebview.api) {
            api = window.pywebview.api;
            return;
        }
        window.addEventListener('pywebviewready', () => {
            api = window.pywebview && window.pywebview.api ? window.pywebview.api : null;
        }, { once: true });
    }
    initResizeApi();

    function detect(cx, cy) {
        let e = '';
        if (cy < EDGE) e += 'n';
        if (cy > window.innerHeight - EDGE) e += 's';
        if (cx < EDGE) e += 'w';
        if (cx > window.innerWidth - EDGE) e += 'e';
        return e;
    }

    const CURSORS = {
        n: 'n-resize', s: 's-resize', e: 'e-resize', w: 'w-resize',
        ne: 'ne-resize', nw: 'nw-resize', se: 'se-resize', sw: 'sw-resize',
    };

    function flush() {
        if (!pending || inFlight || !getApi()) return;
        inFlight = true;
        const { x, y, w, h } = pending;
        pending = null;
        getApi().set_window_rect(x, y, w, h)
            .catch(() => {})
            .finally(() => {
                inFlight = false;
                if (pending) requestAnimationFrame(flush);
            });
    }

    document.addEventListener('mousedown', async (e) => {
        if (!getApi()) return;
        const target = e.target;
        const handle = target && target.closest && target.closest('.resize-edge');
        const ed = handle && handle.dataset && handle.dataset.edge ? handle.dataset.edge : detect(e.clientX, e.clientY);
        if (!ed) return;

        e.preventDefault();
        e.stopPropagation();
        active = true;
        edges = ed;
        sx = e.screenX;
        sy = e.screenY;
        document.documentElement.style.cursor = CURSORS[ed] || '';

        try {
            geom = await getApi().get_window_geometry();
        } catch (_) {
            active = false;
            edges = '';
            document.documentElement.style.cursor = '';
        }
    }, true);

    document.addEventListener('mousemove', (e) => {
        if (active) {
            if (!geom) return;
            const dx = e.screenX - sx;
            const dy = e.screenY - sy;

            let { x, y, w, h } = geom;

            if (edges.includes('e')) w += dx;
            if (edges.includes('w')) { w -= dx; x += dx; }
            if (edges.includes('s')) h += dy;
            if (edges.includes('n')) { h -= dy; y += dy; }

            if (w < MIN_W) {
                if (edges.includes('w')) x = geom.x + geom.w - MIN_W;
                w = MIN_W;
            }
            if (h < MIN_H) {
                if (edges.includes('n')) y = geom.y + geom.h - MIN_H;
                h = MIN_H;
            }

            pending = { x, y, w, h };
            if (!inFlight) requestAnimationFrame(flush);
            e.preventDefault();
            return;
        }

        const ed = detect(e.clientX, e.clientY);
        document.documentElement.style.cursor = CURSORS[ed] || '';
    });

    document.addEventListener('mouseup', () => {
        if (!active) return;
        active = false;
        edges = '';
        document.documentElement.style.cursor = '';
        if (pending && getApi()) {
            getApi().set_window_rect(pending.x, pending.y, pending.w, pending.h).catch(() => {});
            pending = null;
        }
    });

    document.addEventListener('mouseleave', () => {
        if (!active) document.documentElement.style.cursor = '';
    });
})();
