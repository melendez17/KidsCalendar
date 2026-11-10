import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

test('Dashboard carga la cuenta, guarda tareas y confirma el turno antes de jugar', async () => {
  const html = readFileSync(new URL('../dashboard.html', import.meta.url), 'utf8');
  const scriptPath = html.match(/<script src="([^"]+)"/)[1];
  const script = readFileSync(new URL('../' + scriptPath, import.meta.url), 'utf8');

  const elements = new Map();
  const context2d = new Proxy({}, { get: (o, k) => o[k] || (() => {}) });

  function el(id) {
    if (!elements.has(id)) {
      elements.set(id, {
        value: '',
        hidden: false,
        style: {},
        dataset: {},
        textContent: '',
        innerHTML: '',
        classList: { toggle() {} },
        setAttribute() {},
        addEventListener(k, fn) {
          this[k] = fn;
        },
        reset() {},
        focus() {},
        showModal() {},
        close() {},
        getContext() {
          return context2d;
        }
      });
    }
    return elements.get(id);
  }

  let stored = {
    tasks: [],
    rewards: [],
    customSubjects: [],
    spent: 0,
    records: {},
    reminders: false
  };
  let revision = 0;
  let putCount = 0;

  const context = vm.createContext({
    console,
    Date,
    Math,
    JSON,
    Set,
    Number,
    String,
    Object,
    Array,
    Blob,
    URL,
    globalThis: {
      crypto: {
        randomUUID: () => 'task-test'
      }
    },
    navigator: {},
    performance: { now: () => 0 },
    requestAnimationFrame: () => 1,
    cancelAnimationFrame() {},
    matchMedia: () => ({ matches: true }),
    clearTimeout() {},
    setTimeout: () => 1,
    setInterval() {},
    window: { addEventListener() {} },
    location: {
      replace() {
        throw Error('Unexpected redirect');
      },
      assign() {}
    },
    document: {
      body: { hidden: true },
      getElementById: el,
      querySelector: el,
      querySelectorAll: () => [],
      addEventListener() {}
    },
    fetch: async (url, options) => {
      if (url === '/api/me') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ user: { name: 'Mi familia' } })
        };
      }
      if (options?.method === 'PUT') {
        const data = JSON.parse(options.body);
        assert.equal(data.revision, revision);
        stored = data.state;
        revision++;
        putCount++;
        return {
          ok: true,
          status: 200,
          json: async () => ({ revision })
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          state: structuredClone(stored),
          revision
        })
      };
    }
  });

  await vm.runInContext(script, context);
  assert.equal(el('account-name').textContent, 'Mi familia');
  assert.equal(context.document.body.hidden, false);

  el('title').value = 'Leer';
  el('description').value = 'Capítulo uno';
  el('subject').value = 'math';
  el('priority').value = 'medium';

  const now = new Date();
  el('due-date').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  el('due-time').value = '23:59';

  el('task-form').submit({ preventDefault() {} });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(stored.tasks[0].description, 'Capítulo uno');

  el('task-list').onchange({ target: { dataset: { check: 'task-test' } } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(stored.rewards.length, 1);
  assert.equal(el('game-balance').textContent, 10);

  el('play-runner').onclick();
  await el('game-start').onclick();
  assert.equal(stored.spent, 1);
  assert.equal(el('game-balance').textContent, 9);
  assert(putCount >= 3);
  assert.equal(el('sync-status').textContent, 'Guardado en tu cuenta');
});
