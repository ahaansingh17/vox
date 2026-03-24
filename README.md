# Vox

An open-source AI assistant that runs entirely on your Mac — no cloud, no account, no data leaving your device.

Talk to it, control your screen, manage your files, write documents, send emails, reply to iMessages, and run background tasks. The installer sets up everything including the local AI model — nothing to configure manually.

> **macOS only.**

---

## What it does

- **Voice activation** — wake word or `⌘⌥V` to start
- **Screen control** — click, type, scroll, and navigate any app via Accessibility
- **File management** — read, write, search, and organize files
- **Email** — send, read, and manage Apple Mail
- **iMessage** — read conversations and send replies; passphrase mode lets it reply to iMessages autonomously
- **Documents** — create Word, PDF, and PowerPoint files
- **Web** — fetch and summarize web pages
- **Knowledge base** — index folders for semantic search across your files
- **MCP tools** — connect any [MCP server](https://modelcontextprotocol.io) to extend capabilities

---

## Getting started

**Download and install Vox** from the [latest release](https://github.com/info-arnav/vox/releases/latest).

The installer sets up Ollama and pulls the default model automatically. Open Vox when it's done.

Press `⌘⌥V` or say the wake word to start.

---

## Building from source

```sh
git clone https://github.com/info-arnav/vox.git
cd vox/local-app
npm install
npm run dev
```

---

## Permissions

Vox requests these macOS permissions on first use:

| Permission        | Used for                                           |
| ----------------- | -------------------------------------------------- |
| Microphone        | Wake word detection and voice input                |
| Accessibility     | Screen control (clicks, typing, reading UI)        |
| Screen Recording  | Screenshots                                        |
| Full Disk Access  | File indexing, reading Mail and iMessage databases |
| Automation → Mail | Sending emails via Apple Mail                      |

Nothing is sent off-device.

---

## Package structure

The monorepo publishes 6 packages used by both this app and the Vox cloud edition:

| Package                                                 | Version | Description                                |
| ------------------------------------------------------- | ------- | ------------------------------------------ |
| [`@info-arnav/vox-mcp`](packages/mcp)                   | 1.0.0   | MCP client (stdio, SSE, HTTP)              |
| [`@info-arnav/vox-tools`](packages/tools)               | 1.0.0   | Registry, builtins, docs, tool definitions |
| [`@info-arnav/vox-integrations`](packages/integrations) | 1.0.0   | Mail, Screen, iMessage integrations        |
| [`@info-arnav/vox-voice`](packages/voice)               | 1.0.0   | Wake word detection and voice window       |
| [`@info-arnav/vox-indexing`](packages/indexing)         | 1.0.0   | File indexing and full-text search         |
| [`@info-arnav/vox-ui`](packages/ui)                     | 1.0.0   | React UI components and design tokens      |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide.

```sh
npm install      # install all workspace deps
npm run dev      # run the app
npm run lint     # lint all packages + app
npm run format   # format with prettier
```

Good first areas: tool implementations in [`packages/integrations/`](packages/integrations), UI components in [`packages/ui/`](packages/ui), or indexing improvements in [`packages/indexing/`](packages/indexing).

Open an issue before starting large changes.

---

## License

MIT — see [LICENSE](LICENSE)
