import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function dailyPrioritiesService(api) {
  const source = readFileSync(new URL('../src/services/dailyPriorities.ts', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    Date,
    require(name) {
      if (name === './api') return { api };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return exports.dailyPrioritiesService;
}

test('queue request goes to the server endpoint with the browser UTC offset', async () => {
  const calls = [];
  const service = dailyPrioritiesService({ get: async (path, params) => { calls.push({ path, params }); return {}; } });
  await service.getOrganizationQueue();
  assert.equal(calls[0].path, '/api/business-development/daily-priorities/organization-queue');
  assert.equal(calls[0].params.utc_offset_minutes, -new Date().getTimezoneOffset());
});

test('queue errors propagate so the widget can show its error and retry state', async () => {
  const failure = new Error('Access denied');
  const service = dailyPrioritiesService({ get: async () => { throw failure; } });
  await assert.rejects(service.getOrganizationQueue(), (e) => e === failure);
});

test('every link the queue emits points at a registered route', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const backend = readFileSync(
    new URL('../../backend/app/services/daily_priorities.py', import.meta.url), 'utf8');
  const emitted = [...backend.matchAll(/(?:source_url|organization_url)=f?"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(emitted.length >= 3, 'expected task, follow-up and organization links');
  for (const url of emitted) {
    const routePath = url.replace(/\{[^}]+\}/g, ':id');
    assert.ok(app.includes(`path="${routePath}"`), `no route registered for ${url}`);
  }
});
