<div align="center">

# cc-wrapped

**Your year in code with Claude, beautifully visualized.**

Generate a personalized "Spotify Wrapped"-style summary of your [Claude Code](https://claude.ai/claude-code) usage.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?logo=bun&logoColor=white)](https://bun.sh)

</div>

---

## Credits

This project is based on [opencode-wrapped](https://github.com/moddi3/opencode-wrapped) by [moddi3 (Vlad Ivanov)](https://github.com/moddi3), adapted for Claude Code by [Sergey Bulaev](https://co.actor).

**Developed by:** [Co.Actor](https://co.actor) - AI Content Creation Solution

---

## Installation

### Quick Start

Run directly without installing:

```bash
npx cc-wrapped # or bunx, or yarn/pnpm dlx
```

### Global Install

```bash
npm install -g cc-wrapped # or bun/yarn/pnpm
```

Then run anywhere:

```bash
cc-wrapped
```

## Usage Options

| Option          | Description                          |
| --------------- | ------------------------------------ |
| `--year, -y`    | Generate wrapped for a specific year |
| `--help, -h`    | Show help message                    |
| `--version, -v` | Show version number                  |

## Features

- Sessions, messages, prompts, tokens, and projects tracking
- GitHub-style activity heatmap
- Top models breakdown (Opus, Sonnet, Haiku)
- Top projects breakdown
- Daily streak tracking
- Shareable PNG image
- Inline image display (Ghostty, Kitty, iTerm2, WezTerm, Konsole)
- Auto-copy to clipboard

## Terminal Support

The wrapped image displays natively in terminals that support inline images:

| Terminal                                   | Protocol       | Status                      |
| ------------------------------------------ | -------------- | --------------------------- |
| [Ghostty](https://ghostty.org)             | Kitty Graphics | ✅ Full support             |
| [Kitty](https://sw.kovidgoyal.net/kitty/)  | Kitty Graphics | ✅ Full support             |
| [WezTerm](https://wezfurlong.org/wezterm/) | Kitty + iTerm2 | ✅ Full support             |
| [iTerm2](https://iterm2.com)               | iTerm2 Inline  | ✅ Full support             |
| [Konsole](https://konsole.kde.org)         | Kitty Graphics | ✅ Full support             |
| Other terminals                            | —              | ⚠️ Image saved to file only |

## Output

The tool generates:

1. **Terminal Summary** — Quick stats overview in your terminal
2. **PNG Image** — A beautiful, shareable wrapped card saved to your home directory
3. **Clipboard** — Automatically copies the image to your clipboard

## Data Source

Claude Code Wrapped reads data from your local Claude Code installation:

```
~/.claude/
```

**Data sources used:**
- `stats-cache.json` - Pre-computed usage statistics
- `history.jsonl` - Prompt history and project data
- `projects/` - Session data for detailed analysis

No data is sent anywhere. Everything is processed locally.

## Building

### Development

```bash
# Run in development mode with hot reload
bun run dev
```

### Production Build

```bash
# Build for all platforms
bun run build
```

### Releasing

Releases are automated via [semantic-release](https://semantic-release.gitbook.io). Merging PRs with [conventional commits](https://www.conventionalcommits.org) to `main` triggers a release.

## Tech Stack

- **Runtime**: [Bun](https://bun.sh)
- **Image Generation**: [Satori](https://github.com/vercel/satori) + [Resvg](https://github.com/nicolo-ribaudo/resvg-js)
- **CLI UI**: [@clack/prompts](https://github.com/natemoo-re/clack)
- **Font**: IBM Plex Mono

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) for details.

---

<div align="center">

Made with ❤️ for the [Claude Code](https://claude.ai/claude-code) community

**Based on [opencode-wrapped](https://github.com/moddi3/opencode-wrapped) by [moddi3](https://github.com/moddi3)**

**Adapted by [Sergey Bulaev](https://co.actor) at [Co.Actor](https://co.actor)**

</div>
