# OpenCode Leak Proof Plugin

An OpenCode plugin that prevents AI assistants from accessing sensitive files and content based on configurable exclusion patterns using the well-known glob style.

## Overview

This plugin hooks into OpenCode's tool execution lifecycle to filter out sensitive content before it reaches the AI provider. It honours `.aiexclude` files at various locations as well as project-root `.gitignore` files, allowing you to protect credentials, API keys, and other sensitive data.

## Installation

### Using Bun

```bash
cd $HOME/.config/opencode && bun add github:pjmartos/opencode-leak-proof
```

## Usage

### 1. Install the plugin in your OpenCode configuration

Add the plugin to your OpenCode configuration file (`$HOME/.config/opencode/opencode.json`):

```json
{
  "plugin": ["opencode-leak-proof"]
}
```

### 2. Configure exclusion patterns

You can configure exclusion patterns in three different and complimentary places (later patterns override earlier patterns):

* User-level `$HOME/.aiexclude`
* Project-local `.gitignore`, at the project's root directory (`.gitignore` files in subfolders are currently not supported)
* Project-local `.aiexclude`, at the project's root directory

Glob patterns are converted to regular expressions and matched against normalized file paths.

### 3. Provide guidelines via `AGENTS.md`

In order to increase the effectiveness of the plugin, it is recommended to add instructions similar to the following in an `AGENTS.md` file:
```Markdown
For any file operation (list, read, concatenate, dump, search), you must first run your `Read` tool on each file. If the read call returns an error, you are not allowed to use that file, and in that case you must skip it entirely.
```

## Features

- **Pre-execution filtering**: Blocks tool calls that attempt to access excluded files
- **Post-execution filtering**: Filters output that matches exclusion patterns
- **Glob pattern support**: Use wildcards and directory patterns, leverages existing `.gitignore` files for minimal setup
- **Minimal dependencies**: Lightweight plugin using only Node.js built-ins and `picomatch` as its unique dependency

## Requirements

- Bun >= 1.0.0 (or Node.js with ESM support)

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Support

- Issue Tracker: [GitHub Issues](https://github.com/pjmartos/opencode-leak-proof/issues)

## Acknowledgments

- [Juan Antonio Pedraza](https://github.com/jantpedraza/)
