import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function gmailService(api) {
  const source = readFileSync(new URL('../src/services/gmail.ts', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    require(name) {
      if (name === './api') return { api };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return exports.gmailService;
}

test('send errors reach the UI instead of becoming simulated success', async () => {
  const failure = new Error('Gmail could not confirm delivery');
  const service = gmailService({ post: async () => { throw failure; } });
  await assert.rejects(service.sendEmail({ to: 'recipient@example.test', subject: 'Hi', body: 'Hi' }),
    error => error === failure);
});

test('confirmed delivery reaches the UI with its real message ID', async () => {
  const confirmation = { success: true, message_id: 'confirmed-message', thread_id: 'confirmed-thread' };
  const service = gmailService({ post: async () => confirmation });
  const result = await service.sendEmail({ to: 'recipient@example.test', subject: 'Hi', body: 'Hi' });
  assert.equal(result, confirmation);
});
