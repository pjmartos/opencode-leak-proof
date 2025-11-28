import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "os";

describe("opencode-leak-proof", () => {
  let testProjectRoot;
  let testHomeDir;
  let LeakProof;

  beforeEach(async () => {
    testProjectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "leak-proof-test-project-"));
    testHomeDir = fs.mkdtempSync(path.join(os.tmpdir(), "leak-proof-test-home-"));

    mock.module("os", () => ({
      homedir: () => testHomeDir,
      default: {
        homedir: () => testHomeDir
      }
    }));

    LeakProof = (await import("./index.js?" + Date.now())).default;
  });

  afterEach(() => {
    mock.restore();
    if (fs.existsSync(testProjectRoot)) {
      fs.rmSync(testProjectRoot, { recursive: true, force: true });
    }
    if (fs.existsSync(testHomeDir)) {
      fs.rmSync(testHomeDir, { recursive: true, force: true });
    }
  });

  function createConfigFile(filePath, content, useHomeDir = false) {
    const baseDir = useHomeDir ? testHomeDir : testProjectRoot;
    const fullPath = path.join(baseDir, filePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content);
  }

  describe("basic glob patterns", () => {
    test("simple wildcard pattern *.env", async () => {
      createConfigFile(".aiexclude", "**/*.env");
      const plugin = await LeakProof({ project: { worktree: testProjectRoot } });

      const before = plugin["tool.execute.before"];

      await expect(before({}, { args: { filePath: "test.env" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: ".env" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: "config.json" } })).resolves.toBeUndefined();
      await expect(before({}, { args: { filePath: "src/test.env" } })).rejects.toThrow();
    });

    test("directory wildcard src/*.js", async () => {
      createConfigFile(".aiexclude", "src/*.js");
      const plugin = await LeakProof({ project: { worktree: testProjectRoot } });

      const before = plugin["tool.execute.before"];

      await expect(before({}, { args: { filePath: "src/index.js" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: "src/sub/file.js" } })).resolves.toBeUndefined();
      await expect(before({}, { args: { filePath: "lib/file.js" } })).resolves.toBeUndefined();
    });

    test("globstar pattern **/*.log", async () => {
      createConfigFile(".aiexclude", "**/*.log");
      const plugin = await LeakProof({ project: { worktree: testProjectRoot } });

      const before = plugin["tool.execute.before"];

      await expect(before({}, { args: { filePath: "test.log" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: "logs/app.log" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: "logs/2024/01/debug.log" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: "test.txt" } })).resolves.toBeUndefined();
    });

    test("question mark pattern test?.log", async () => {
      createConfigFile(".aiexclude", "test?.log");
      const plugin = await LeakProof({ project: { worktree: testProjectRoot } });

      const before = plugin["tool.execute.before"];

      await expect(before({}, { args: { filePath: "test1.log" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: "testa.log" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: "test_.log" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: "test.log" } })).resolves.toBeUndefined();
      await expect(before({}, { args: { filePath: "test12.log" } })).resolves.toBeUndefined();
    });

    test("character class pattern file[0-9].txt", async () => {
      createConfigFile(".aiexclude", "file[0-9].txt");
      const plugin = await LeakProof({ project: { worktree: testProjectRoot } });

      const before = plugin["tool.execute.before"];

      await expect(before({}, { args: { filePath: "file0.txt" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: "file5.txt" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: "file9.txt" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: "file12.txt" } })).resolves.toBeUndefined();
      await expect(before({}, { args: { filePath: "filea.txt" } })).resolves.toBeUndefined();
      await expect(before({}, { args: { filePath: "file.txt" } })).resolves.toBeUndefined();
    });

    test("root-anchored pattern .env", async () => {
      createConfigFile(".aiexclude", ".env");
      const plugin = await LeakProof({ project: { worktree: testProjectRoot } });

      const before = plugin["tool.execute.before"];

      await expect(before({}, { args: { filePath: ".env" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: "src/.env" } })).resolves.toBeUndefined();
      await expect(before({}, { args: { filePath: "config/.env" } })).resolves.toBeUndefined();
    });
  });

  describe("negation patterns", () => {
    test("exclude then include with negation", async () => {
      createConfigFile(".aiexclude", "**/*.log\n!important.log");
      const plugin = await LeakProof({ project: { worktree: testProjectRoot } });

      const before = plugin["tool.execute.before"];

      await expect(before({}, { args: { filePath: "test.log" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: "debug.log" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: "important.log" } })).resolves.toBeUndefined();
    });

    test("exclude directory then include specific files", async () => {
      createConfigFile(".aiexclude", "secrets/*\n!secrets/*.example");
      const plugin = await LeakProof({ project: { worktree: testProjectRoot } });

      const before = plugin["tool.execute.before"];

      await expect(before({}, { args: { filePath: "secrets/api-key.txt" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: "secrets/password.txt" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: "secrets/config.example" } })).resolves.toBeUndefined();
    });

    test("complex negation chain", async () => {
      createConfigFile(".aiexclude", "**/*.env\n!.env.example\n.env.local");
      const plugin = await LeakProof({ project: { worktree: testProjectRoot } });

      const before = plugin["tool.execute.before"];

      await expect(before({}, { args: { filePath: ".env" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: ".env.production" } })).resolves.toBeUndefined();
      await expect(before({}, { args: { filePath: ".env.example" } })).resolves.toBeUndefined();
      await expect(before({}, { args: { filePath: ".env.local" } })).rejects.toThrow();
    });

    test("re-exclude after negation", async () => {
      createConfigFile(".aiexclude", "**/*.log\n!public/*.log\npublic/secret.log");
      const plugin = await LeakProof({ project: { worktree: testProjectRoot } });

      const before = plugin["tool.execute.before"];

      await expect(before({}, { args: { filePath: "test.log" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: "public/access.log" } })).resolves.toBeUndefined();
      await expect(before({}, { args: { filePath: "public/error.log" } })).resolves.toBeUndefined();
      await expect(before({}, { args: { filePath: "public/secret.log" } })).rejects.toThrow();
    });
  });

  describe("multiple config sources", () => {
    test("project .aiexclude takes precedence", async () => {
      createConfigFile(".aiexclude", "**/*.log", true);
      createConfigFile(".gitignore", "**/*.txt");
      createConfigFile(".aiexclude", "**/*.md\n!**/*.log");

      const plugin = await LeakProof({ project: { worktree: testProjectRoot } });
      const before = plugin["tool.execute.before"];

      await expect(before({}, { args: { filePath: "test.txt" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: "test.md" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: "test.log" } })).resolves.toBeUndefined();
    });

    test("patterns from all sources are combined", async () => {
      createConfigFile(".aiexclude", "**/*.env", true);
      createConfigFile(".gitignore", "node_modules/**");

      const plugin = await LeakProof({ project: { worktree: testProjectRoot } });
      const before = plugin["tool.execute.before"];

      await expect(before({}, { args: { filePath: ".env" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: "node_modules/package.json" } })).rejects.toThrow();
    });
  });

  describe("comments and empty lines", () => {
    test("ignore comment lines", async () => {
      createConfigFile(".aiexclude", "# This is a comment\n**/*.env\n# Another comment\n**/*.log");
      const plugin = await LeakProof({ project: { worktree: testProjectRoot } });

      const before = plugin["tool.execute.before"];

      await expect(before({}, { args: { filePath: ".env" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: "test.log" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: "# This is a comment" } })).resolves.toBeUndefined();
    });

    test("ignore empty lines", async () => {
      createConfigFile(".aiexclude", "**/*.env\n\n\n**/*.log\n\n");
      const plugin = await LeakProof({ project: { worktree: testProjectRoot } });

      const before = plugin["tool.execute.before"];

      await expect(before({}, { args: { filePath: ".env" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: "test.log" } })).rejects.toThrow();
    });

    test("trim whitespace from patterns", async () => {
      createConfigFile(".aiexclude", "  **/*.env  \n\t**/*.log\t\n");
      const plugin = await LeakProof({ project: { worktree: testProjectRoot } });

      const before = plugin["tool.execute.before"];

      await expect(before({}, { args: { filePath: ".env" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: "test.log" } })).rejects.toThrow();
    });
  });

  describe("path normalization", () => {
    test("windows backslashes normalized to forward slashes", async () => {
      createConfigFile(".aiexclude", "src/*.js");
      const plugin = await LeakProof({ project: { worktree: testProjectRoot } });

      const before = plugin["tool.execute.before"];

      await expect(before({}, { args: { filePath: "src\\file.js" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: "src/file.js" } })).rejects.toThrow();
    });

    test("mixed slashes handled correctly", async () => {
      createConfigFile(".aiexclude", "logs/**/*.log");
      const plugin = await LeakProof({ project: { worktree: testProjectRoot } });

      const before = plugin["tool.execute.before"];

      await expect(before({}, { args: { filePath: "logs\\2024\\01\\app.log" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: "logs/2024/01/app.log" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: "logs\\2024/01\\app.log" } })).rejects.toThrow();
    });
  });

  describe("tool.execute.after output filtering", () => {
    test("block string output matching patterns", async () => {
      createConfigFile(".aiexclude", "**/*.env");
      const plugin = await LeakProof({ project: { worktree: testProjectRoot } });

      const after = plugin["tool.execute.after"];

      await expect(after({}, { output: "test.env" })).rejects.toThrow();
      await expect(after({}, { output: "config.json" })).resolves.toBeUndefined();
    });

    test("block array output with matching paths", async () => {
      createConfigFile(".aiexclude", "**/*.env");
      const plugin = await LeakProof({ project: { worktree: testProjectRoot } });

      const after = plugin["tool.execute.after"];

      await expect(after({}, { output: ["file1.txt", "test.env", "file2.txt"] })).rejects.toThrow();
      await expect(after({}, { output: ["file1.txt", "file2.txt"] })).resolves.toBeUndefined();
    });

    test("handle mixed type arrays", async () => {
      createConfigFile(".aiexclude", "**/*.env");
      const plugin = await LeakProof({ project: { worktree: testProjectRoot } });

      const after = plugin["tool.execute.after"];

      await expect(after({}, { output: ["file.txt", 123, "test.env"] })).rejects.toThrow();
      await expect(after({}, { output: [123, { key: "value" }, "file.txt"] })).resolves.toBeUndefined();
    });

    test("check metadata.output when output is missing", async () => {
      createConfigFile(".aiexclude", "**/*.env");
      const plugin = await LeakProof({ project: { worktree: testProjectRoot } });

      const after = plugin["tool.execute.after"];

      await expect(after({}, { metadata: { output: "test.env" } })).rejects.toThrow();
      await expect(after({}, { metadata: { output: "config.json" } })).resolves.toBeUndefined();
    });
  });

  describe("real-world scenarios", () => {
    test("typical node.js project", async () => {
      createConfigFile(".gitignore", `node_modules/**
.env
.env.local
.env.*
**/*.log
coverage/**
dist/**`);

      const plugin = await LeakProof({ project: { worktree: testProjectRoot } });
      const before = plugin["tool.execute.before"];

      await expect(before({}, { args: { filePath: "node_modules/express/index.js" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: ".env" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: ".env.production" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: "test.log" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: "coverage/index.html" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: "dist/bundle.js" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: "src/index.js" } })).resolves.toBeUndefined();
      await expect(before({}, { args: { filePath: "package.json" } })).resolves.toBeUndefined();
    });

    test("secrets and credentials", async () => {
      createConfigFile(".aiexclude", `**/*.key
**/*.pem
**/credentials.json
secrets/**
.ssh/**
.aws/**
**/*.env
!.env.example`);

      const plugin = await LeakProof({ project: { worktree: testProjectRoot } });
      const before = plugin["tool.execute.before"];

      await expect(before({}, { args: { filePath: "private.key" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: "cert.pem" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: "config/credentials.json" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: "secrets/api-key.txt" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: ".ssh/id_rsa" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: ".aws/credentials" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: ".env" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: ".env.example" } })).resolves.toBeUndefined();
    });

    test("dotfiles exclusion with exceptions", async () => {
      createConfigFile(".aiexclude", `.*
!.gitignore
!.editorconfig`);

      const plugin = await LeakProof({ project: { worktree: testProjectRoot } });
      const before = plugin["tool.execute.before"];

      await expect(before({}, { args: { filePath: ".env" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: ".secret" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: ".gitignore" } })).resolves.toBeUndefined();
      await expect(before({}, { args: { filePath: ".editorconfig" } })).resolves.toBeUndefined();
    });
  });

  describe("edge cases", () => {
    test("no config files present", async () => {
      const plugin = await LeakProof({ project: { worktree: testProjectRoot } });

      expect(plugin).toEqual({});
    });

    test("empty config file", async () => {
      createConfigFile(".aiexclude", "");
      const plugin = await LeakProof({ project: { worktree: testProjectRoot } });

      expect(plugin).toEqual({});
    });

    test("only comments in config", async () => {
      createConfigFile(".aiexclude", "# Just comments\n# Nothing else");
      const plugin = await LeakProof({ project: { worktree: testProjectRoot } });

      expect(plugin).toEqual({});
    });

    test("no filePath in tool.execute.before", async () => {
      createConfigFile(".aiexclude", "*.env");
      const plugin = await LeakProof({ project: { worktree: testProjectRoot } });

      const before = plugin["tool.execute.before"];

      await expect(before({}, { args: {} })).resolves.toBeUndefined();
      await expect(before({}, {})).resolves.toBeUndefined();
    });

    test("no output in tool.execute.after", async () => {
      createConfigFile(".aiexclude", "*.env");
      const plugin = await LeakProof({ project: { worktree: testProjectRoot } });

      const after = plugin["tool.execute.after"];

      await expect(after({}, {})).resolves.toBeUndefined();
      await expect(after({}, { metadata: {} })).resolves.toBeUndefined();
    });

    test("malformed patterns are skipped", async () => {
      createConfigFile(".aiexclude", "**/*.env\n[unclosed\n**/*.log");
      const plugin = await LeakProof({ project: { worktree: testProjectRoot } });

      const before = plugin["tool.execute.before"];

      await expect(before({}, { args: { filePath: ".env" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: "test.log" } })).rejects.toThrow();
    });
  });

  describe("pattern precedence", () => {
    test("later patterns override earlier ones", async () => {
      createConfigFile(".aiexclude", `**/*.log
!important.log
important.log`);

      const plugin = await LeakProof({ project: { worktree: testProjectRoot } });
      const before = plugin["tool.execute.before"];

      await expect(before({}, { args: { filePath: "important.log" } })).rejects.toThrow();
    });

    test("project patterns override global patterns", async () => {
      createConfigFile(".aiexclude", "**/*.log", true);
      createConfigFile(".aiexclude", "**/*.log\n!app.log");

      const plugin = await LeakProof({ project: { worktree: testProjectRoot } });
      const before = plugin["tool.execute.before"];

      await expect(before({}, { args: { filePath: "app.log" } })).resolves.toBeUndefined();
      await expect(before({}, { args: { filePath: "other.log" } })).rejects.toThrow();
    });
  });

  describe("special characters in patterns", () => {
    test("patterns with dots", async () => {
      createConfigFile(".aiexclude", ".env.*");
      const plugin = await LeakProof({ project: { worktree: testProjectRoot } });

      const before = plugin["tool.execute.before"];

      await expect(before({}, { args: { filePath: ".env.local" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: ".env.production" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: ".env" } })).resolves.toBeUndefined();
    });

    test("patterns with hyphens and underscores", async () => {
      createConfigFile(".aiexclude", "test-*.js\nfile_*.txt");
      const plugin = await LeakProof({ project: { worktree: testProjectRoot } });

      const before = plugin["tool.execute.before"];

      await expect(before({}, { args: { filePath: "test-utils.js" } })).rejects.toThrow();
      await expect(before({}, { args: { filePath: "file_data.txt" } })).rejects.toThrow();
    });
  });
});
