import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const notesPath = (version) => `docs/releases/v${version}.md`;
const template = (version) =>
  `# v${version}\n\n## Overview\n\n<!-- Replace this prompt with a concise human-written overview before merging the release PR. -->\n\n`;

export function validateNotes(version, content) {
  if (!/^\d+\.\d+\.\d+$/.test(version))
    throw new Error('Invalid release version');
  if (!content?.trim())
    throw new Error(
      `Release notes are missing or empty: ${notesPath(version)}`,
    );
  if (!content.startsWith(`# v${version}\n`))
    throw new Error(`Release notes heading must be # v${version}`);
  const overview = content
    .split(/^## Overview\s*\n/m)[1]
    ?.split(/^## /m)[0]
    ?.replace(/<!--[\s\S]*?-->/g, '')
    ?.trim();
  if (!overview || content.includes('<!-- Replace this prompt')) {
    throw new Error(
      `Write a human overview in ${notesPath(version)} before release`,
    );
  }
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function repository() {
  if (process.env.GITHUB_REPOSITORY)
    return `https://github.com/${process.env.GITHUB_REPOSITORY}`;
  const remote = git('remote', 'get-url', 'origin');
  const match = remote.match(/github\.com[:/]([^/]+\/[^/.]+?)(?:\.git)?$/);
  if (!match) throw new Error('Could not determine GitHub repository URL');
  return `https://github.com/${match[1]}`;
}

function previousTag(version) {
  const tags = git('tag', '--list', 'v*').split('\n').filter(Boolean);
  return selectPreviousTag(tags, version, isAncestor);
}

export function selectPreviousTag(tags, version, ancestorCheck = () => true) {
  const target = version.split('.').map(Number);
  return tags
    .map((tag) => ({ tag, parts: tag.slice(1).split('.').map(Number) }))
    .filter(
      ({ tag, parts }) =>
        /^v\d+\.\d+\.\d+$/.test(tag) &&
        parts.length === 3 &&
        parts.every(Number.isInteger) &&
        parts.join('.') !== version &&
        compareSemver(parts, target) < 0 &&
        ancestorCheck(tag),
    )
    .sort((a, b) => {
      for (let i = 0; i < 3; i++)
        if (a.parts[i] !== b.parts[i]) return b.parts[i] - a.parts[i];
      return 0;
    })[0]?.tag;
}

function compareSemver(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

function isAncestor(tag) {
  try {
    git('merge-base', '--is-ancestor', tag, 'HEAD');
    return true;
  } catch {
    return false;
  }
}

export function renderNotes(version, overview, commits, repo, beforeTag) {
  const compare = beforeTag
    ? `${repo}/compare/${beforeTag}...v${version}`
    : `${repo}/commits/v${version}`;
  const list = commits.length
    ? commits
        .map(
          ({ sha, subject }) =>
            `- [${subject.replace(/[\\[\]<>]/g, '\\$&')}](${repo}/commit/${sha})`,
        )
        .join('\n')
    : '- No individual commits to list.';
  const overviewSection = overview.trim().startsWith('## Overview')
    ? overview.trim()
    : `## Overview\n\n${overview.trim()}`;
  return `${overviewSection}\n\n[Full comparison](${compare})\n\n## Commits\n\n${list}\n`;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [command, version] = process.argv.slice(2);
  if (command === 'prepare') {
    if (!/^\d+\.\d+\.\d+$/.test(version ?? ''))
      throw new Error('Usage: release-notes.mjs prepare <version>');
    fs.mkdirSync('docs/releases', { recursive: true });
    if (!fs.existsSync(notesPath(version)))
      fs.writeFileSync(notesPath(version), template(version));
  } else if (command === 'validate') {
    validateNotes(
      version,
      fs.existsSync(notesPath(version))
        ? fs.readFileSync(notesPath(version), 'utf8')
        : '',
    );
  } else if (command === 'render') {
    const path = notesPath(version);
    const overview = fs.readFileSync(path, 'utf8');
    validateNotes(version, overview);
    const previous = previousTag(version);
    const range = previous ? `${previous}..HEAD` : 'HEAD';
    const commits = git('log', range, '--no-merges', '--format=%H%x09%s')
      .split('\n')
      .filter(Boolean)
      .map((row) => {
        const [sha, ...subject] = row.split('\t');
        return { sha, subject: subject.join('\t') };
      })
      .filter(
        ({ subject }) =>
          !/^chore: prepare release v\d+\.\d+\.\d+$/i.test(subject),
      );
    process.stdout.write(
      renderNotes(
        version,
        overview.replace(/^# v\d+\.\d+\.\d+\s*/m, '').trim(),
        commits,
        repository(),
        previous,
      ),
    );
  } else {
    throw new Error(
      'Usage: release-notes.mjs <prepare|validate|render> <version>',
    );
  }
}
