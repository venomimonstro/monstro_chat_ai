/**
 * Симуляции использования чата — поиск скрытых багов (Sprint 71).
 * Run: node --experimental-strip-types src/utils/chatSimulation.test.mts
 */
import assert from 'node:assert/strict';
import { dedupeMessages } from './messages.ts';
import { createStreamBatcher, mergeLiveStream } from './streamState.ts';

function testDedupeOnReconnect() {
  const history = [
    { id: 'm1', role: 'user' as const, content: 'Привет', createdAt: '2026-01-01T10:00:00Z' },
    { id: 'm2', role: 'assistant' as const, content: 'Здравствуйте', createdAt: '2026-01-01T10:00:01Z' },
  ];
  const duplicate = [...history, ...history];
  const result = dedupeMessages(duplicate);
  assert.equal(result.length, 2, 'reconnect must not duplicate history');
}

function testDedupeLocalAndServerIds() {
  const msgs = [
    { id: 'local-1', role: 'user' as const, content: 'test', createdAt: 't1' },
    { id: 'srv-1', role: 'assistant' as const, content: 'ok', createdAt: 't2' },
    { id: 'srv-1', role: 'assistant' as const, content: 'ok', createdAt: 't2' },
  ];
  assert.equal(dedupeMessages(msgs).length, 2);
}

function testStreamBatcherCoalescesTokens() {
  let flushCount = 0;
  let lastContent = '';
  const batcher = createStreamBatcher((content) => {
    flushCount += 1;
    lastContent = content;
  });

  for (let i = 0; i < 100; i++) {
    batcher.push('a');
  }
  batcher.flush();

  assert.equal(flushCount, 1, '100 tokens should coalesce to 1 RAF flush');
  assert.equal(lastContent.length, 100);
  batcher.cancel();
}

function testStreamBatcherCancelOnDisconnect() {
  let flushed = false;
  const batcher = createStreamBatcher(() => {
    flushed = true;
  });
  batcher.push('partial');
  batcher.cancel();
  batcher.flush();
  assert.equal(flushed, false, 'cancelled stream must not flush stale tokens');
}

function testMergeLiveStreamDoesNotMutateStable() {
  const stable = [
    { id: '1', role: 'user' as const, content: 'hi', createdAt: 't' },
  ];
  const frozen = Object.freeze([...stable]);
  const merged = mergeLiveStream(frozen, 'typing...');
  assert.equal(stable.length, 1, 'stable messages unchanged');
  assert.equal(merged.length, 2);
  assert.equal(merged[1]?.streaming, true);
}

function testRapidOpenCloseMessageFlood() {
  const messages: { id?: string; role: 'user' | 'assistant'; content: string }[] = [];
  for (let i = 0; i < 200; i++) {
    messages.push({ id: `u-${i}`, role: 'user', content: `msg ${i}` });
    messages.push({ id: `a-${i}`, role: 'assistant', content: `reply ${i}` });
  }
  const deduped = dedupeMessages(messages);
  assert.equal(deduped.length, 400);

  let live: string | null = null;
  for (let i = 0; i < 500; i++) {
    live = (live ?? '') + 'x';
    mergeLiveStream(deduped, live);
  }
  assert.ok(true, '500 stream updates without throw');
}

function testPartialStreamOnDisconnect() {
  const stable = [{ id: '1', role: 'user' as const, content: 'q', createdAt: 't' }];
  const partial = 'Ответ оборвал';
  const afterDisconnect = dedupeMessages([
    ...stable,
    { role: 'assistant' as const, content: partial, createdAt: new Date().toISOString() },
  ]);
  assert.equal(afterDisconnect.length, 2);
  assert.ok(!afterDisconnect.some((m) => 'streaming' in m && m.streaming));
}

function testEmptyStreamTokens() {
  const batcher = createStreamBatcher(() => {
    assert.fail('empty flush should not call handler');
  });
  batcher.flush();
  batcher.cancel();
}

const tests = [
  testDedupeOnReconnect,
  testDedupeLocalAndServerIds,
  testStreamBatcherCoalescesTokens,
  testStreamBatcherCancelOnDisconnect,
  testMergeLiveStreamDoesNotMutateStable,
  testRapidOpenCloseMessageFlood,
  testPartialStreamOnDisconnect,
  testEmptyStreamTokens,
];

let passed = 0;
for (const t of tests) {
  t();
  passed += 1;
}
console.log(`chatSimulation: ${passed}/${tests.length} OK`);
