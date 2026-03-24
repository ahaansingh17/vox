# Contributing to Vox

## Prerequisites

- macOS (the app and all integrations are macOS-only)
- Node.js 20+
- npm 10+
- Ollama or LMStudio running locally

## Monorepo setup

This is an npm workspaces monorepo. The root `package.json` manages the Electron app. Shared packages live in `packages/`.

```
vox/
├── src/                  Electron app source (main + renderer)
├── packages/
│   ├── mcp/              @info-arnav/vox-mcp
│   ├── tools/            @info-arnav/vox-tools
│   ├── integrations/     @info-arnav/vox-integrations
│   ├── voice/            @info-arnav/vox-voice
│   ├── indexing/         @info-arnav/vox-indexing
│   └── ui/               @info-arnav/vox-ui
└── package.json
```

```sh
git clone https://github.com/info-arnav/vox.git
cd vox/local-app
npm install       # installs all workspace packages and app deps
npm run dev       # starts the app with hot reload
```

## How packages fit together

```
vox-mcp
  └── vox-tools (registry uses vox-mcp for MCP reconnection)
        └── vox-integrations (mail/screen/imessage use tools/exec utilities)

vox-voice     (standalone — wake word + voice window)
vox-indexing  (standalone — file indexing runtime)
vox-ui        (standalone — React components)
```

When changing a package that others depend on, bump its version and update the dependent's `package.json` too.

## Running a single package in isolation

Each package has its own `src/` and is consumed directly from source in dev (no build step needed except `vox-ui`).

```sh
# lint just one package
cd packages/tools
npm run lint
```

## Making changes

1. Fork the repo and create a branch: `git checkout -b feat/my-change`
2. Make your changes
3. Run `npm run lint` from the root — all packages must pass
4. Run `npm run format` to auto-fix style
5. Open a PR against `main`

For changes to a published package, add a changeset:

```sh
npx changeset
```

This creates a file in `.changeset/` describing the bump. The release workflow picks it up automatically.

## PR conventions

- Title must follow [Conventional Commits](https://www.conventionalcommits.org): `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`
- One logical change per PR
- Include a test plan in the PR description (manual steps to verify the change works)
- Link the issue your PR closes: `Closes #123`

## Commit messages

```
feat(integrations): add calendar tool
fix(voice): handle microphone permission denial gracefully
chore(deps): bump better-sqlite3 to 12.6
docs(indexing): update README with build config example
```

## Adding a new integration

1. Create `packages/integrations/src/<name>/` with `index.js` as the barrel
2. Add tool definitions to `packages/integrations/src/defs/<name>.js`
3. Export both from `packages/integrations/src/defs/index.js` and `src/index.js`
4. Add the export path to `packages/integrations/package.json` exports
5. Document in `packages/integrations/README.md`

## Adding a new builtin tool

1. Implement in `packages/tools/src/builtins/<name>.js`
2. Add the JSON Schema definition to `packages/tools/src/defs/<name>.js`
3. Re-export from `packages/tools/src/builtins/index.js` and `src/defs/index.js`

## Questions

Open a [GitHub Discussion](https://github.com/info-arnav/vox/discussions) for questions. Use issues for confirmed bugs and feature requests.
