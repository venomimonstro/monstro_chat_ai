let failed = false;

function generateUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      /* fall through */
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const original = globalThis.crypto?.randomUUID;
if (globalThis.crypto) {
  delete globalThis.crypto.randomUUID;
}

const id = generateUuid();
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
  console.error('FAIL: generateUuid returned invalid format:', id);
  failed = true;
} else {
  console.log('OK: generateUuid works without crypto.randomUUID');
}

if (original && globalThis.crypto) {
  globalThis.crypto.randomUUID = original;
}

if (failed) process.exit(1);
