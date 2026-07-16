# STRUCTURE CLI - Project Context

> This file provides persistent context for the STRUCTURE CLI project.

## Project Overview

STRUCTURE CLI is a modern command-line framework inspired by:
- **Obsidian CLI**: Command structure, TUI, file operations
- **Claude Code**: Skills, hooks, agents, memory system

## Architecture

```
src/
├── cli/        # Entry point and argument parsing
├── commands/   # Command modules (core, files, search, tasks, dev)
├── tui/        # Terminal UI with autocomplete
├── hooks/      # Lifecycle event system
├── skills/     # Extensible skill system
├── agents/     # Subagent orchestration
├── memory/     # Persistent context
├── mcp/        # Model Context Protocol integration
├── config/     # Multi-scope configuration
└── utils/      # Shared utilities
```

## Development Guidelines

### Code Style
- TypeScript with strict mode
- ESM modules
- Async/await for all async operations
- Explicit type annotations

### Testing
- Unit tests in `tests/unit/`
- Integration tests in `tests/integration/`
- Run with `npm test`

### Commands
- `npm run dev` - Run in development
- `npm run build` - Build for production
- `npm test` - Run tests
- `npm run lint` - Check code style

## Key Concepts

### Skills (10 available)
Packaged workflows in `.structure/skills/<name>/SKILL.md`:
- **code-review** - Reviews code for quality, security, and best practices
- **simplify** - Reviews changed code for refactoring opportunities
- **safe-refactoring** - Checkpoint-based refactoring with rollback
- **tdd-workflow** - Test-Driven Development with Red-Green-Refactor
- **deep-reasoning** - Structured thinking for complex problems
- **troubleshooting** - Systematic debugging with hypothesis testing
- **fast-file-search** - Optimized codebase search and discovery
- **git-workflow** - Feature branches and conventional commits
- **quality-gates** - Pre-commit/push/deploy validation layers
- **project-health-check** - Comprehensive project health assessment

### Agents (3 available)
Specialized subagents in `.structure/agents/<name>.md`:
- **debugger** - Root cause analysis and bug fixing
- **researcher** - Fast codebase exploration (read-only)
- **quality-checker** - Automated quality checks and reporting

### Hooks (6 lifecycle events)
Event-driven automation in `.structure/hooks/`:
- **SessionStart** - Load project context on startup
- **PreCommand** - Validate before destructive operations
- **PostCommand** - Post-write checks
- **PreToolUse** - Command validation
- **PreCommit** - Quality gate before commits
- **PostTest** - Test result analysis

Hook scripts in `.structure/hooks/scripts/`:
- `pre-commit.sh` - Lint, type check, secret scan, tests
- `session-start.sh` - Git status, project info, quick commands
- `post-test.sh` - Coverage check, result analysis, next actions

### Memory
- `STRUCTURE.md` - Project instructions (this file)
- Auto-memory - Learned patterns in `~/.structure/projects/`
