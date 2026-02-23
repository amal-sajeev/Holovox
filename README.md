
<p align="center">

```
 ██╗  ██╗ ██████╗ ██╗      ██████╗ ██╗   ██╗ ██████╗ ██╗  ██╗
 ██║  ██║██╔═══██╗██║     ██╔═══██╗██║   ██║██╔═══██╗╚██╗██╔╝
 ███████║██║   ██║██║     ██║   ██║██║   ██║██║   ██║ ╚███╔╝
 ██╔══██║██║   ██║██║     ██║   ██║╚██╗ ██╔╝██║   ██║ ██╔██╗
 ██║  ██║╚██████╔╝███████╗╚██████╔╝ ╚████╔╝ ╚██████╔╝██╔╝ ██╗
 ╚═╝  ╚═╝ ╚═════╝ ╚══════╝ ╚═════╝   ╚═══╝   ╚═════╝╚═╝  ╚═╝
```

</p>

<p align="center">
  <strong>Imperial-class Audiobook Command Deck</strong><br>
  <em>Live visualization &bull; Speech-to-text transcription &bull; Language learning</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/python-3.9+-blue?style=flat-square&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/UI-pywebview-green?style=flat-square" />
  <img src="https://img.shields.io/badge/STT-faster--whisper-orange?style=flat-square" />
  <img src="https://img.shields.io/badge/theme-Imperial-critical?style=flat-square" />
</p>

---

```
  ┌──────────────────────────────────────────────────────────────┐
  │  ╔══════════════════════════════════════════════════════╗    │
  │  ║  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ║    │
  │  ║  ▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ║    │
  │  ║  ▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ║    │
  │  ║  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ║    │
  │  ╚══════════════════════════════════════════════════════╝    │
  │  ◄◄   ►   ►►   ■            ◎ VOL    ◎ SPD    [▰▰▰▱▱]     │
  │  ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈  │
  │  > Transmitting on all frequencies...                       │
  │  > The dark side of the Force is a pathway to many          │
  │  > abilities some consider to be... unnatural.              │
  └──────────────────────────────────────────────────────────────┘
```

## About

**HoloVox** is a desktop audiobook player wrapped in a Star Wars Imperial command interface. It pairs real-time audio visualization with automatic speech-to-text transcription, making it a powerful tool for language learning — or just listening to audiobooks in style.

Boot it up. Watch the Imperial startup sequence. Load an audiobook. Let the data streams flow.

## Features

| | Feature | Description |
|---|---|---|
| ◈ | **Imperial UI** | Brushed-metal panels, Aurebesh typography, scanline effects, LED status indicators |
| ◈ | **Live Visualizer** | Real-time frequency analysis rendered as a data-stream display |
| ◈ | **Auto Transcription** | Whisper-powered speech-to-text with word-level highlighting |
| ◈ | **Bookmarks** | Save and label positions across your audiobook collection |
| ◈ | **Library** | Folder-based scanning with recent files and search |
| ◈ | **Speed Control** | 0.5x – 2.0x playback with smooth knob controls |
| ◈ | **Smart Caching** | Transcription results cached locally for instant re-access |
| ◈ | **Boot Sequence** | Full animated Imperial-style startup on launch |

## Prerequisites

- **Python 3.9+**
- **FFmpeg** on PATH

### Installing FFmpeg (Windows)

```powershell
# Option A — winget
winget install Gyan.FFmpeg

# Option B — manual
# Download from https://www.gyan.dev/ffmpeg/builds/ ("essentials" build)
# Extract and add the bin\ folder to your system PATH
```

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Launch HoloVox
python app.py
```

On first launch, the Whisper speech-to-text model (~150 MB) will be downloaded automatically.

## Controls

```
  ╔════════════════════════════════════════════════╗
  ║  KEYBOARD           ACTION                    ║
  ╠════════════════════════════════════════════════╣
  ║  Space              Play / Pause              ║
  ║  ←                  Skip back 5s              ║
  ║  →                  Skip forward 5s           ║
  ║  ↑                  Volume up                 ║
  ║  ↓                  Volume down               ║
  ║  Esc                Close overlay panels      ║
  ╚════════════════════════════════════════════════╝
```

- Click the **title bar** to open the audiobook library
- Drag the **VOL** and **SPD** knobs to adjust volume and playback speed
- Transcription runs automatically when a file is loaded

## Supported Formats

```
  ┌─────┬─────┬─────┬──────┬─────┬─────┐
  │ MP3 │ M4A │ M4B │ FLAC │ WAV │ OGG │
  └─────┴─────┴─────┴──────┴─────┴─────┘
```

## Settings

Access settings through the UI to configure:

- **Whisper model** — `tiny` / `base` / `small` / `medium` (trade speed for accuracy)
- **Language** — Auto-detect or lock to a specific language
- **UI sounds** — Toggle interface sound effects

## Project Structure

```
HoloVox/
├── app.py                 # Entry point, HTTP server, pywebview shell
├── transcriber.py         # Whisper engine, caching, background threads
├── requirements.txt
├── README.md
└── ui/
    ├── index.html         # Main interface
    ├── css/styles.css     # Imperial styling
    ├── js/
    │   ├── app.js         # Core controller & audio bridge
    │   ├── boot.js        # Startup sequence
    │   ├── visualizer.js  # Frequency analysis & rendering
    │   ├── knob.js        # Draggable knob controls
    │   ├── transcription.js
    │   ├── library.js
    │   └── sounds.js
    └── fonts/
        ├── aurebesh.woff
        └── aurebesh.woff2
```

---

<p align="center">
  <code>━━━ IMPERIAL COMMUNICATIONS ━ AUTHORIZED PERSONNEL ONLY ━━━</code>
</p>
