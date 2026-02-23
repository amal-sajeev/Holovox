/**
 * Audio graph manager.
 * Handles AudioContext, GainNode for volume control.
 * (Canvas visualizer replaced by main text display.)
 */

const Visualizer = (() => {
    let audioCtx = null;
    let gainNode = null;
    let sourceNode = null;
    let connected = false;

    function connectAudio(audioElement) {
        if (connected) return;

        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            sourceNode = audioCtx.createMediaElementSource(audioElement);

            gainNode = audioCtx.createGain();
            gainNode.gain.value = 1.0;

            sourceNode.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            connected = true;

            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }

            const resumeOnInteraction = () => {
                if (audioCtx && audioCtx.state === 'suspended') {
                    audioCtx.resume();
                }
            };
            document.addEventListener('click', resumeOnInteraction);
            document.addEventListener('keydown', resumeOnInteraction);
        } catch (e) {
            console.error('Audio connection failed:', e);
        }
    }

    function start() {
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    function stop() {}

    function setVolume(value) {
        if (gainNode && audioCtx) {
            gainNode.gain.setTargetAtTime(value, audioCtx.currentTime, 0.02);
        }
    }

    function getVolume() {
        return gainNode ? gainNode.gain.value : 1.0;
    }

    return { connectAudio, start, stop, setVolume, getVolume };
})();
