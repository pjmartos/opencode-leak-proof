# Contributing to OpenCode Leak Proof Plugin

Thank you for your interest in contributing to the OpenCode Leak Proof Plugin!

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Submitting Changes](#submitting-changes)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Enhancements](#suggesting-enhancements)

## Code of Conduct

This project adheres to a code of conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to [me](https://www.linkedin.com/in/pjmartos/).

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Create a new branch for your contribution
4. Make your changes
5. Submit a pull request

## How to Contribute

### Development Setup

#### Windows
```shell
powershell -Command "irm bun.sh/install.ps1|iex ; $env:PATH = [Environment]::GetEnvironmentVariable('Path', 'Machine'),[Environment]::GetEnvironmentVariable('Path', 'User') -join ';'"
```

#### Linux / MacOSX
```bash
curl -fsSL https://bun.com/install | bash && bash
```

### Coding Standards

All contributions must adhere to the following standards observed in this codebase:

#### Code Style

- **Naming conventions**: Use camelCase for functions and variables
- **Const by default**: Prefer `const` for variables that don't change; use `let` only when reassignment is necessary
- **Function design**: Write small, focused functions that do one thing well
- **Early returns**: Validate inputs early and return immediately on invalid conditions
- **Destructuring**: Extract object properties in function parameters when appropriate
- **Portability**: Always have cross-platform compatibility in mind

#### Code Organization

- Helper functions should appear before the main export
- Group related functionality together
- Keep the dependency footprint minimal

#### Comments and Documentation

- Code should be self-documenting through clear naming
- Add comments only when the logic is complex or non-obvious
- Avoid redundant comments that merely repeat what the code does

#### Module System

- Use ESM syntax exclusively (`import`/`export`)
- Default export for the main plugin function
- Named exports for utilities only when necessary

#### Array Operations

- Prefer functional methods: `map()`, `filter()`, `some()`, `reverse()`
- Use `for...of` loops when early returns are needed

#### Testing Requirements

- All code changes must include corresponding tests
- Tests must be realistic and cover edge cases
- All tests must pass before submitting: `bun test`
- Test coverage should include:
  - Happy path scenarios
  - Edge cases (empty inputs, malformed data)
  - Error conditions
  - Cross-platform compatibility (Windows/Unix paths)

#### Dependencies

- Avoid adding new dependencies unless absolutely necessary
- New dependencies must:
  - Be well-maintained and widely adopted
  - Bring zero or minimal transitive dependencies
  - Have a clear, focused purpose
  - Be safe and security-audited

### Documentation Standards

All documentation must follow these guidelines derived from the existing README:

#### Writing Style

- Use imperative mood for instructions
- Be concise and direct
- Use numbered lists for sequential steps
- Use bullet points for feature lists or non-sequential items
- Include practical, realistic examples

#### Code Examples

- Always specify language for code blocks (```bash, ```json, etc.)
- Whenever possible, use actual file paths, not placeholders
- Show complete, runnable examples
- Include context (where to add the code, what it does)

#### Cross-references

- Link to related files (LICENSE, CONTRIBUTING.md)
- Provide external resource links (GitHub Issues, documentation)
- Use markdown link syntax: `[text](url)`

### Submitting Changes

1. Ensure all tests pass
2. Update documentation as needed
3. Write clear commit messages
4. Submit a pull request with a clear description of changes

#### Pull Request Process

1. Update the README.md with details of changes if applicable
2. Ensure your code follows the project's coding standards
3. Your pull request will be reviewed by maintainers
4. Address any feedback from reviewers

### Reporting Bugs

When reporting bugs, please include:

- A clear and descriptive title
- Steps to reproduce the issue
- Expected behavior
- Actual behavior
- Environment details (OS, version, etc.)
- Any relevant logs or screenshots

### Suggesting Enhancements

We welcome enhancement suggestions! Please provide:

- A clear and descriptive title
- Detailed description of the proposed enhancement
- Rationale for why this enhancement would be useful
- Any examples or mockups if applicable

## Questions?

If you have questions about contributing, please open an issue with the "question" label.

## License

By contributing to this project, you agree that your contributions will be licensed under the Apache License 2.0.
