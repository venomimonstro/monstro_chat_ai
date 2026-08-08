import assert from 'node:assert/strict';
import {
  dedupeMessages,
  mergeChatHistory,
  shouldMergeChatHistory,
} from './messages';

assert.deepEqual(
  dedupeMessages([
    { role: 'user', content: 'hi', id: 'local-1', createdAt: '2026-01-01T00:00:00Z' },
    { role: 'user', content: 'hi', id: 'uuid-1', createdAt: '2026-01-01T00:00:01Z' },
  ]).length,
  1,
);

assert.equal(
  shouldMergeChatHistory(
    [{ role: 'user', content: 'Вопрос', id: 'local-1' }],
    { sameDialogReload: false },
  ),
  true,
);

assert.equal(
  shouldMergeChatHistory([], { sameDialogReload: false }),
  false,
);

assert.deepEqual(
  mergeChatHistory(
    [{ role: 'user', content: 'Вопрос', id: 'local-1', createdAt: '2026-01-01T00:00:01Z' }],
    [],
  ).map((m) => m.content),
  ['Вопрос'],
);

assert.deepEqual(
  mergeChatHistory(
    [
      { role: 'user', content: 'Привет', id: 'local-123', createdAt: '2026-01-01T00:00:00Z' },
      { role: 'assistant', content: 'partial', streaming: true },
    ],
    [
      { role: 'user', content: 'Привет', id: 'uuid-1', createdAt: '2026-01-01T00:00:00Z' },
      { role: 'assistant', content: 'Ответ', id: 'uuid-2', createdAt: '2026-01-01T00:00:01Z' },
    ],
  ).map((m) => m.role),
  ['user', 'assistant'],
);

console.log('messages.test.mts: ok');
