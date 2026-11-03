import assert from 'node:assert/strict';
import test from 'node:test';
import {
  renderNotes,
  selectPreviousTag,
  validateNotes,
} from '../../scripts/release-notes.mjs';

test('release notes require the expected version and a human overview', () => {
  assert.throws(() => validateNotes('1.2.3', ''), /missing or empty/);
  assert.throws(
    () => validateNotes('1.2.3', '# v1.2.2\n\n## Overview\nReady.'),
    /heading/,
  );
  assert.throws(
    () =>
      validateNotes(
        '1.2.3',
        '# v1.2.3\n\n## Overview\n\n<!-- Replace this prompt -->',
      ),
    /human overview/,
  );
  assert.throws(
    () =>
      validateNotes(
        '1.2.3',
        '# v1.2.3\n\n## Overview\n<!-- only a comment -->',
      ),
    /human overview/,
  );
  assert.throws(
    () =>
      validateNotes(
        '1.2.3',
        '# v1.2.3\n\n## Overview\n\nOverview text.\n\n<!-- Replace this prompt -->',
      ),
    /human overview/,
  );
  assert.doesNotThrow(() =>
    validateNotes(
      '1.2.3',
      '# v1.2.3\n\n## Overview\n\nImproves playback handling.\n',
    ),
  );
});

test('generated notes include overview, commit links, and full comparison link', () => {
  const notes = renderNotes(
    '1.2.3',
    '## Overview\n\nImproves playback handling.',
    [{ sha: 'abcdef1', subject: 'Fix playback startup' }],
    'https://github.com/example/project',
    'v1.2.2',
  );
  assert.match(notes, /Improves playback handling/);
  assert.match(notes, /compare\/v1\.2\.2\.\.\.v1\.2\.3/);
  assert.match(notes, /commit\/abcdef1/);
  assert.ok(
    renderNotes(
      '1.2.3',
      'Overview',
      [{ sha: 'x', subject: 'Fix [player] <UI>' }],
      'https://github.com/example/project',
    ).includes('Fix \\[player\\] \\<UI\\>'),
  );
  assert.match(
    renderNotes('1.0.0', 'Overview', [], 'https://github.com/example/project'),
    /commits\/v1\.0\.0/,
  );
});

test('previous tag selection handles first releases and retries of a tagged version', () => {
  assert.equal(selectPreviousTag([], '1.0.0'), undefined);
  const tags = ['v0.1.0', 'v0.0.1', 'v1.0.0', 'v2.0.0', 'v9..9', 'v-1.0.0'];
  assert.equal(selectPreviousTag(tags, '1.0.0'), 'v0.1.0');
  assert.equal(
    selectPreviousTag(tags, '1.0.0', (tag) => tag !== 'v0.1.0'),
    'v0.0.1',
  );
  assert.equal(
    selectPreviousTag(tags, '2.0.0', (tag) => tag !== 'v1.0.0'),
    'v0.1.0',
  );
});
