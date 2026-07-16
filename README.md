# Structure CLI

> A modern, extensible command-line framework for building agentic developer tools — commands, skills, hooks, agents, and multi-provider AI routing in one TypeScript codebase.

## What it is

Structure CLI is a terminal framework that borrows the command ergonomics of Obsidian CLI and the extension model of Claude Code, and unifies them under a single, provider-agnostic runtime. It gives you a modular command system, an interactive TUI, a lifecycle hook engine, a packaged-skill loader, subagent orchestration, and a persistent memory system — all driven by a layered configuration model.

The goal is a framework you can extend without touching the core: drop a `SKILL.md` in a search path to add a workflow, add a markdown-defined agent, or wire a shell script to a lifecycle event — no recompilation required.

## Features

- **Modular commands** — Commands are grouped by domain (core, files, search, tasks, dev, vault, provider, usage, analyze) and self-register with a Commander.js program, so new command modules are additive.
- **Interactive TUI** — Autocomplete, command history, and `/skill` invocation for an interactive session, or run any command one-shot.
- **Multi-provider AI** — First-class support for Anthropic, OpenAI/Codex, and Ollama behind one abstraction. Switch with `--provider` or config; each provider maps `fast` / `standard` / `advanced` tiers to concrete models.
- **Fleet routing** — Route Ollama workloads across multiple nodes with health checks, capability matching, and priority-based selection.
- **Skills** — Packaged workflows defined by a `SKILL.md` with YAML frontmatter, discovered across a prioritized set of search paths (project, user, and env-configured).
- **Lifecycle hooks** — Emit/subscribe hook system for `SessionStart`, `PreCommand`, `PostCommand`, `PreToolUse`, `PostToolUse`, and more, with the ability to block an action.
- **Subagents** — Provider-aware agent registry defined in markdown; invoke specialized agents for focused tasks.
- **Three-tier memory** — User-level, project-level (`STRUCTURE.md`), and learned auto-memory for persistent context.
- **Layered configuration** — CLI flags > local settings > project settings > user settings > defaults.
- **MCP integration** — Model Context Protocol clients for HTTP servers, Ollama, and the Codex CLI.
- **Usage ledger** — Track token usage, cost, and cache-hit reporting per provider.

## Tech Stack

- **Language:** TypeScript (strict, ES2022, NodeNext ESM)
- **Runtime:** Node.js >= 18
- **CLI:** Commander.js, Inquirer, Ora, Chalk
- **Files/Config:** glob, js-yaml, chokidar
- **Testing:** Jest + ts-jest
- **Tooling:** ESLint, Prettier

## Getting Started

```bash
# Install dependencies
npm install

# Configure providers (optional — only needed for the provider you use)
cp .env.example .env
# then edit .env with your API keys

# Run in development (ts-node)
npm run dev

# Or build and run the compiled CLI
npm run build
npm start
```

Once built, the `structure` binary is available (see `bin` in `package.json`).

```bash
# Start the interactive TUI
structure

# Run a single command
structure help
structure search --query "TODO"

# Provider management
structure provider list
structure provider use ollama
structure provider status
```

## Architecture

```
src/
├── cli/          # Entry point + argument parsing (Commander.js)
├── commands/     # Command modules, self-registered via registerCommands()
│   └── provider/ # Multi-provider management (Anthropic, OpenAI, Ollama)
├── tui/          # Interactive terminal UI
├── hooks/        # Lifecycle event system (emit/subscribe, blocking)
├── skills/       # SKILL.md loader + runner
├── agents/       # Subagent orchestration
├── memory/       # Three-tier persistent context
├── config/       # Layered configuration + provider abstraction
├── mcp/          # Model Context Protocol clients (http, ollama, codex)
├── anthropic/    # Anthropic API client, caching, rate limits
├── parallel-think/ # Multi-strategy reasoning engine
└── utils/        # Shared utilities
```

**Entry flow:** `src/cli/index.ts` loads configuration, initializes the hook and memory systems, then dispatches to either the TUI or a single command. Command modules receive a `CommandContext` (config, hooks, memory, agents) so extensions interact through stable interfaces rather than internal state.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`STRUCTURE.md`](STRUCTURE.md) for a deeper walkthrough.

## Extending

**Add a skill** — create `<project>/.structure/skills/<name>/SKILL.md`:

```yaml
---
name: my-skill
description: When this skill should be used
allowed-tools: Read, Grep, Bash
---

Instructions for the workflow...
```

**Add an agent** — create `.structure/agents/<name>.md` with `name`, `description`, `tools`, and `model` frontmatter.

**Add a hook** — register it in `.structure/settings.json` under the `hooks` key, pointing at a command or script.

## Testing

```bash
npm test               # all tests
npm run test:unit      # unit tests only
npm run lint           # ESLint
```

## License

MIT © Jalen Ward — see [LICENSE](LICENSE).
