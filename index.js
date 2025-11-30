import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "os";
import picomatch from "picomatch";

function readConfigIfExists(configPath) {
  try {
    if (!fs.existsSync(configPath)) {
      return [];
    }

    return fs.readFileSync(configPath, "utf8").split(/\r?\n/);
  } catch (err) {
    console.warn(`[opencode-leak-proof] Failed to read config at ${configPath}: `, err);
    return [];
  }
}

function getExclusionPatterns(projectRoot) {
  const globalAiExcludePath = path.join(
    os.homedir(),
    ".aiexclude"
  );
  const globalAiExcludeCfg = readConfigIfExists(globalAiExcludePath);

  const projectGitIgnorePath = path.join(
    projectRoot,
    ".gitignore"
  );
  const projectGitIgnoreCfg = readConfigIfExists(projectGitIgnorePath);

  const projectAiExcludePath = path.join(
    projectRoot,
    ".aiexclude"
  );
  const projectAiExcludeCfg = readConfigIfExists(projectAiExcludePath);
 
  return [...globalAiExcludeCfg, ...projectGitIgnoreCfg, ...projectAiExcludeCfg]
    .map((filter) => filter.trim())
    .filter((pattern) => pattern && !pattern.startsWith('#'))
    .flatMap((pattern) => asRegex(pattern, projectRoot))
    .filter(({ regex }) => regex)
    .reverse();
}

function parseRegex(pattern, strict = true) {
  try {
    const regex = picomatch.makeRe(pattern, { dot: true, noext: true, nonegate: true, contains: !strict });

    if (!regex) {
      console.warn(`[opencode-leak-proof] Could not parse pattern ${pattern}, skipping.`);
      return null;
    }

    return regex;
  } catch (err) {
    console.warn(`[opencode-leak-proof] Could not parse pattern ${pattern}, skipping: `, err);
    return null;
  }
}

function asRegex(pattern, projectRoot) {
  const inverted = pattern.startsWith('!');
  let effectivePattern = inverted ? pattern.substring(1) : pattern;

  if (!effectivePattern) {
    return {};
  }

  if (effectivePattern.endsWith('/')) {
    effectivePattern = effectivePattern + '**';
  }

  if (effectivePattern.startsWith('/')) {
    effectivePattern = effectivePattern.substring(1);
  }

  return [
    {
      pattern,
      regex: parseRegex(effectivePattern),
      isInvertedRegex: inverted
    },
    {
      pattern,
      regex: parseRegex(projectRoot + '/' + effectivePattern, false),
      isInvertedRegex: inverted
    }
  ];
}

function isContentExcluded(content, exclusionPatterns) {
  const normalizedContent = content.replace(/\\/g, "/");
  for (const {regex, isInvertedRegex} of exclusionPatterns) {
    if (regex.test(normalizedContent)) {
      return !isInvertedRegex;
    }
  }
  return false;
}

function extractPatterns(exclusionPatterns) {
  return [...new Set(exclusionPatterns.map(({ pattern }) => pattern))].join(', ');
}

export default async function LeakProof({ project }) {
  const exclusionPatterns = getExclusionPatterns(project.worktree);

  if (!exclusionPatterns.length) {
    console.warn("[opencode-leak-proof] No exclusion patterns found.");
    return {};
  }

  const originalPatterns = extractPatterns(exclusionPatterns);
  return {
    "tool.execute.before": async (input, output) => {
      const content = output?.args?.filePath || output?.args?.command;
      if (content && isContentExcluded(content, exclusionPatterns)) {
        const errorMessage = `[opencode-leak-proof] Content \`${content}\` rejected due to sensitive content exclusions. PAY ATTENTION TO THESE EXCLUSIONS GOING FORWARD: ${originalPatterns}`;
        console.error(errorMessage);
        throw new Error(errorMessage);
      }
    },
    "tool.execute.after": async (input, output) => {
      const effectiveOutput = output?.output || output?.metadata?.output;
      if (effectiveOutput) {
        let excluded = false;

        if (Array.isArray(effectiveOutput)) {
          excluded = effectiveOutput.some((out) => typeof out === "string" && isContentExcluded(out, exclusionPatterns));
        } else if (typeof effectiveOutput === "string") {
          excluded = isContentExcluded(effectiveOutput, exclusionPatterns);
        }

        if (excluded) {
          const errorMessage = `[opencode-leak-proof] Output rejected due to sensitive content exclusions. PAY ATTENTION TO THESE EXCLUSIONS GOING FORWARD: ${originalPatterns}.`;
          console.error(errorMessage);
          throw new Error(errorMessage);
        }
      }
    }
  };
}
