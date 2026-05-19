# Tau

Tau UI, also called Tau Workspace, is a desktop interface for the [Pi Coding Agent](https://pi.dev/). In mathematics, tau is equal to 2 times pi. The name is a nod to Pi as the underlying agent runtime, with a small hacker joke tucked inside: Tau aims to be a step beyond the original terminal experience.

Tau is not a replacement for Pi. It is a GUI workspace built on top of Pi's RPC mode and SDK so you can use Pi sessions, models, extension commands, and package management from a desktop app.

## What It Does

- Runs Pi through native RPC mode with strict JSONL handling.
- Streams Pi conversations in an Electron and React desktop UI.
- Supports prompt, steer, and follow-up message flows.
- Exposes model selection, thinking levels, API key status, and runtime settings.
- Handles Pi extension UI requests such as select, confirm, input, and editor.
- Lists Pi extension commands, prompt commands, and skill commands.
- Manages Pi packages through the official `@earendil-works/pi-coding-agent` package manager.
- Browses [pi.dev packages](https://pi.dev/packages) with search, type filters, sorting, pagination, install, update, and remove actions.
- Supports session switching, new sessions, fork targets, compaction, session naming, and HTML export.

## Relationship To Pi

Tau explicitly depends on Pi and uses Pi's public runtime surfaces:

- Pi home: [https://pi.dev](https://pi.dev/)
- Pi docs: [https://pi.dev/docs/latest](https://pi.dev/docs/latest)
- Pi package gallery: [https://pi.dev/packages](https://pi.dev/packages)
- Pi GitHub repository: [earendil-works/pi](https://github.com/earendil-works/pi)
- Pi coding agent package: [`@earendil-works/pi-coding-agent`](https://www.npmjs.com/package/@earendil-works/pi-coding-agent)

Tau uses Pi RPC for the agent session loop and Pi SDK APIs for package management because Pi RPC does not currently expose package install, update, or remove commands.

## Tech Stack

- Electron
- electron-vite
- React
- TypeScript
- Tailwind CSS
- `@earendil-works/pi-coding-agent`

## Getting Started

Install dependencies:

```bash
npm install
```

Run the desktop app in development:

```bash
npm run dev
```

Build the app:

```bash
npm run build
```

Build a Windows installer:

```bash
npm run build:win
```

## Configuration

Tau reads and writes Pi-compatible configuration where possible. API keys are stored through Pi's auth storage, and runtime settings are applied through Pi settings and RPC commands.

Pi package operations follow Pi's normal package source formats:

```bash
npm:package-name
npm:@scope/package-name
git:github.com/user/repo
https://github.com/user/repo
./local-package
```

Package installs can be user-scoped or project-local, matching Pi's global and `.pi/settings.json` behavior.

## Development Notes

The app starts Pi in RPC mode from the installed `@earendil-works/pi-coding-agent` package. If you need a custom Node executable for the Pi subprocess, set:

```bash
PI_NODE_PATH=/path/to/node
```

The package browser currently reads the public pi.dev package gallery. It uses the official gallery pages rather than a private or undocumented API.

## License

Tau is released under the [MIT License](./LICENSE).

Pi and `@earendil-works/pi-coding-agent` are separate projects from Earendil Works. Tau is an independent UI built to interoperate with Pi.
