# Vox Local

**Your AI assistant that runs entirely on your machine. No servers. No accounts. No cloud. Just you and your computer.**

Vox Local is a standalone desktop app that brings a full AI assistant experience — chat, voice, tool use, and knowledge search — completely on-device. Every model runs locally, every conversation stays private, and it works with your WiFi turned off.

---

## Vision

The AI assistants people use today are cloud-dependent. Your conversations live on someone else's server. Your data passes through someone else's infrastructure. You pay per token, per minute, per request. And if the internet goes down, you have nothing.

Vox Local exists to change that.

We believe:

- **Your conversations are yours.** No data leaves your machine. There is no server to breach, no API logging your prompts, no third party reading your messages. Everything — every model weight, every chat log, every indexed document — lives in a folder on your computer that you control.

- **AI should work offline.** A flight, a cabin, a country with bad internet — none of that should stop you from using your AI assistant. Vox Local runs entirely on-device. Once you download your models, you never need a connection again.

- **You shouldn't need an account to think.** No sign-up. No login. No email verification. No subscription. Install the app, download models, and start using it. That's it.

-  **Local models are good enough now.** Open-weight models like Qwen3 at 4B–8B parameters run at 30–70 tokens per second on a MacBook. Whisper transcribes speech in real-time. Piper synthesizes natural voice on CPU alone. The hardware in your laptop is more than capable.

- **Your desktop is the most powerful tool platform.** Vox Local can control your screen, read and write files, draft documents, send emails, manage your calendar, set reminders, search your indexed files — all through local tool execution. No server relay. No permission proxy. Direct access to your machine, orchestrated by a local AI.

- **AI should be for daily use, not just developers.** Most local AI tools today are CLIs, terminal commands, or require spinning up servers. That's fine for tinkering — it's not how normal people work. Vox Local is a real app. You open it like Spotify or Slack. You talk to it. You type to it. It does things for you. No terminal. No config files. No Docker. Your mom could use it.

---

## What It Does

### Chat
Talk to a local LLM running on your hardware. Streamed responses, markdown rendering, conversation history — all persisted in a local SQLite database. Switch between model sizes depending on the task: a fast nano model for quick questions, a larger model for deep reasoning.

### Voice
A fully local voice pipeline. Say a wake word, speak naturally, and hear the AI respond — all without touching the internet.

- **Wake word detection** — ONNX model listens for "Computer" on-device
- **Speech-to-text** — Whisper models transcribe your voice locally
- **Text-to-speech** — Piper synthesizes the AI's response into spoken audio
- **Voice activity detection** — Silero VAD segments speech intelligently

### Tools
The AI can take action on your computer:

| Category | Capabilities |
|---|---|
| **Screen** | Capture screenshots, click, type, scroll, inspect UI elements |
| **Files** | Read/write files, list directories, run shell commands |
| **Documents** | Generate Word docs, PDFs, PowerPoint presentations |
| **Email** | Send, read, search, reply, forward, flag, delete, draft emails (macOS Mail) |
| **Calendar** | Create, read, update, delete calendar events (macOS Calendar) |
| **Reminders** | Manage reminders (macOS Reminders) |
| **Knowledge** | Search your indexed local documents for context |
| **Web** | Fetch web pages, search the web |
| **MCP** | Connect any Model Context Protocol server for custom tool integration |

### Knowledge Base
Index folders of documents on your machine. Vox Local parses PDFs, Word docs, and PowerPoint files, chunks the text, and builds a local search index (full-text + vector embeddings). When you ask a question, the AI retrieves relevant context from your documents automatically.

### Tasks
Multi-step agentic workflows that run in the background. The AI plans, executes tools, observes results, and continues — all locally. Track progress in a live activity feed.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Electron App                       │
│                                                      │
│  main process                                        │
│  ├── ai/          Local LLM engine (node-llama-cpp) │
│  ├── voice/       Wake word + STT + TTS + VAD       │
│  ├── chat/        Message handling + history         │
│  ├── tools/       Desktop tool executors             │
│  ├── knowledge/   Document indexing + RAG            │
│  ├── tasks/       Background agent workflows         │
│  ├── models/      Download + manage model files      │
│  ├── storage/     SQLite KV store                    │
│  └── overlay/     Quick-access floating window       │
│                                                      │
│  renderer (React + Vite)                             │
│  ├── Chat UI      Streaming messages                 │
│  ├── Models UI    Download + switch models            │
│  ├── Tools UI     Manage custom tools + MCP          │
│  ├── Knowledge UI Index + search local docs          │
│  ├── Activity UI  Task progress feed                 │
│  └── Settings     Preferences + model config         │
│                                                      │
│  Data: ~/.vox-local/                                 │
│  ├── models/      Downloaded model files             │
│  └── data/        SQLite databases                   │
└─────────────────────────────────────────────────────┘
```

No server component. No Docker. No PostgreSQL. No Redis. Just an Electron app and SQLite.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **App framework** | Electron + electron-vite |
| **Frontend** | React 19 + Zustand + Vite |
| **LLM inference** | node-llama-cpp (llama.cpp bindings, Metal/CUDA/Vulkan) |
| **Voice models** | onnxruntime-node (Whisper, Piper, Silero VAD, wake word) |
| **Embeddings** | @xenova/transformers (all-MiniLM-L6-v2) |
| **Database** | better-sqlite3 (chat, knowledge, tasks, tools, settings) |
| **Model format** | GGUF (LLMs), ONNX (voice + embeddings) |
| **Tool protocol** | Model Context Protocol (MCP) |

---

## Models

On first launch, Vox Local detects your hardware and recommends models:

| RAM | LLM | Voice | Total Download |
|---|---|---|---|
| **8 GB** | Qwen3-4B (2.5 GB) | Whisper tiny (75 MB) + Piper (63 MB) | ~2.7 GB |
| **16 GB** | Qwen3-8B (5 GB) | Whisper base (142 MB) + Piper (63 MB) | ~5.2 GB |
| **32 GB+** | Qwen3-32B (15 GB) | Whisper small (466 MB) + Piper (100 MB) | ~15.6 GB |

Models are stored at `~/.vox-local/models/` — outside the app bundle, surviving updates. Download once, use forever.

---

## Development

### Prerequisites

- Node.js 20+
- npm 10+

### Setup

```bash
git clone https://github.com/info-arnav/vox-local.git
cd vox-local
npm install
```

### Run

```bash
npm run dev
```

### Build

```bash
npm run build:mac    # macOS
npm run build:win    # Windows
npm run build:linux  # Linux
```

### Lint

```bash
npm run lint
```

---

## Project Structure

```
src/
├── main/                    Electron main process
│   ├── ai/                  Local LLM engine
│   ├── models/              Model download + management
│   ├── voice/               Wake word, STT, TTS, VAD
│   ├── chat/                Chat service + message cache
│   ├── tools/               Tool registry + executors
│   │   ├── defs/            Tool JSON schemas
│   │   ├── executors/       Screen, FS, docs, mail, calendar, etc.
│   │   └── mcp/             MCP client
│   ├── knowledge/           Document indexing + vector search
│   │   └── parser/          PDF, DOCX, PPTX parsing
│   ├── tasks/               Background task runner
│   ├── custom-tools/        User-defined tool CRUD
│   ├── storage/             SQLite KV store
│   ├── overlay/             Quick-access overlay window
│   ├── power/               Keep-awake management
│   ├── updater/             Auto-update via GitHub releases
│   ├── app/                 Window + tray management
│   ├── config/              Paths + defaults
│   └── ipc/                 IPC handler registry
├── preload/                 Renderer bridge (contextBridge)
└── renderer/                React frontend
    └── src/
        ├── features/        Chat, Models, Tools, Knowledge, Activity, Voice, Settings
        └── stores/          Zustand state (chat, models, settings)
```

---

## Contributing

Contributions are welcome. Keep changes focused and run lint before opening a PR.

## License

MIT
