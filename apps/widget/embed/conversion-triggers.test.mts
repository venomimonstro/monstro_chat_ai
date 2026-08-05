import {
  armConversionTriggers,
  getScrollDepthPercent,
  isExitIntentEvent,
  markTriggerEngaged,
  shouldArmTriggers,
} from './conversion-triggers.ts';

let passed = 0;
let failed = 0;

function assert(name: string, condition: boolean) {
  if (condition) {
    passed += 1;
  } else {
    failed += 1;
    console.error(`FAIL: ${name}`);
  }
}

assert('scroll depth at bottom', getScrollDepthPercent(900, 1000, 100) === 100);
assert('scroll depth at top', getScrollDepthPercent(0, 2000, 800) === 0);
assert('exit intent when leaving top', isExitIntentEvent(0, null) === true);
assert(
  'not exit intent when moving inside page',
  isExitIntentEvent(120, {} as EventTarget) === false,
);

const store = new Map<string, string>();
const storageKey = 'test-widget';

assert(
  'should arm when delay configured',
  shouldArmTriggers(
    { autoOpenDelaySeconds: 5 },
    { storageKey, readStorage: (key) => store.get(key) ?? null },
  ),
);

store.set(storageKey, 'manual');
assert(
  'should not arm after engage marker',
  !shouldArmTriggers(
    { autoOpenDelaySeconds: 5 },
    { storageKey, readStorage: (key) => store.get(key) ?? null },
  ),
);

markTriggerEngaged('manual-test', (key, value) => store.set(key, value));
assert('mark manual engaged', store.get('manual-test') === 'manual');

let fired = false;
const cleanup = armConversionTriggers(
  { autoOpenDelaySeconds: 0, autoOpenOnScrollPercent: 40 },
  {
    storageKey: 'scroll-test',
    readStorage: (key) => store.get(key) ?? null,
    writeStorage: (key, value) => store.set(key, value),
  },
  () => {
    fired = true;
  },
);
cleanup();
assert('cleanup prevents fire without event', !fired);

console.log(`conversion-triggers: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
