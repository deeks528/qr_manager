import assert from 'node:assert/strict';
import test from 'node:test';

import { AvatarService } from '../../src/domain/services/AvatarService';

test('avatar initials use the first character of the first two words', () => {
  assert.equal(AvatarService.createInitials('Home Account'), 'HA');
  assert.equal(AvatarService.createInitials('Office'), 'O');
});

test('avatar colors are deterministic for nickname and installation', () => {
  const first = AvatarService.createAvatarColor('Home', 'install-1');
  const second = AvatarService.createAvatarColor('Home', 'install-1');

  assert.equal(first, second);
});
