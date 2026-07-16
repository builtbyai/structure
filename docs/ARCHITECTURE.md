# STRUCTURE CLI Architecture

## Overview

STRUCTURE CLI combines the best patterns from Obsidian CLI and Claude Code into a unified, extensible command-line framework.

## Core Components

### 1. CLI Entry Point (`src/cli/`)

The main entry point handles:
- Argument parsing with Commander.js
- Configuration loading
- Hook initialization
- Memory loading
- TUI or single-command execution

### 2. Commands (`src/commands/`)

Modular command system organized by domain:

```
commands/
├── core/      # help, version, config, reload, init
├── files/     # files, read, create, write, move, delete
├── search/    # search, grep, glob
├── tasks/     # tasks, task:create, task:update
└── dev/       # dev:debug, dev:eval, doctor
```

### 3. Terminal UI (`src/tui/`)

Interactive mode features:
- Command autocomplete
- History navigation (up/down arrows)
- Reverse search (Ctrl+R)
- Skill invocation with `/skillname`

### 4. Hooks System (`src/hooks/`)

Event-driven automation:

| Event | When |
|-------|------|
| SessionStart | Session begins |
| SessionEnd | Session ends |
| PreCommand | Before command executes |
| PostCommand | After command completes |
| PreToolUse | Before tool invocation |
| PostToolUse | After tool completes |
| ConfigChange | Settings modified |

Hook types:
- `command`: Run shell script
- `http`: POST to URL
- `prompt`: LLM evaluation
- `agent`: Subagent evaluation

### 5. Skills System (`src/skills/`)

Packaged workflows defined in SKILL.md:

```yaml
---
name: my-skill
description: When to use this skill
allowed-tools: Read, Grep
---

Skill instructions...
```

### 6. Agents System (`src/agents/`)

Specialized subagents:

```yaml
---
name: my-agent
description: Agent purpose
tools: Read, Grep, Bash
model: fast
---

Agent system prompt...
```

Built-in agents:
- **Explore**: Fast, read-only codebase exploration
- **Plan**: Planning and analysis
- **Bash**: Terminal command execution

### 7. Memory System (`src/memory/`)

Three-tier persistence:

1. **User-level**: `~/.structure/STRUCTURE.md`
2. **Project-level**: `./STRUCTURE.md`
3. **Auto-memory**: `~/.structure/projects/<id>/memory/`

### 8. Configuration (`src/config/`)

Multi-scope settings (highest to lowest priority):

1. CLI flags
2. Local: `.structure/settings.local.json`
3. Project: `.structure/settings.json`
4. User: `~/.structure/settings.json`
5. Defaults

### 9. MCP Integration (`src/mcp/`)

Model Context Protocol for external tools:

```bash
# Add MCP server
structure mcp add --transport http github https://api.github.com/mcp

# List servers
structure mcp list

# Remove server
structure mcp remove github
```

## Data Flow

```
User Input
    │
    ▼
┌─────────────────┐
│  CLI Parser     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Hook: PreCmd   │──── Can block
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Command Exec   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Hook: PostCmd  │
└────────┬────────┘
         │
         ▼
    Output
```

## Extension Points

1. **Custom Commands**: Add to `src/commands/`
2. **Custom Skills**: Add to `.structure/skills/`
3. **Custom Agents**: Add to `.structure/agents/`
4. **Custom Hooks**: Configure in `settings.json`
5. **MCP Servers**: Add via `structure mcp add`
6. **Rules**: Add to `.structure/rules/`
