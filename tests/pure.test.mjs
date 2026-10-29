import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const load = async (path) => {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
};
const { isFreshStylusSample } = await load('../src/lib/stylusSample.ts');
const { createStoreZip, parseStoreZip } = await load('../src/lib/simpleZip.ts');

test('sample freshness rejects clock rollback, expiry and invalid time', () => {
  assert.equal(isFreshStylusSample(1000, 1000), true);
  assert.equal(isFreshStylusSample(1000, 1299), true);
  for (const now of [999, 1300, 5000]) assert.equal(isFreshStylusSample(1000, now), false);
  assert.equal(isFreshStylusSample(NaN, 1000), false);
});
test('backup roundtrip preserves UTF-8 bytes', async () => {
  const entries = await parseStoreZip(createStoreZip([{ name: 'canvases/a.excalidraw', data: 'été' }]));
  assert.equal(new TextDecoder().decode(entries[0].data), 'été');
});
test('backup parser rejects duplicate names and corrupted payload', async () => {
  await assert.rejects(parseStoreZip(createStoreZip([{ name: 'a', data: 'x' }, { name: 'a', data: 'y' }])), /duplicate/);
  const bytes = new Uint8Array(await createStoreZip([{ name: 'a', data: 'x' }]).arrayBuffer());
  bytes[31] ^= 1;
  await assert.rejects(parseStoreZip(new Blob([bytes])), /integrity/);
});

const { isLocalNavigation } = await load('../src/lib/offline.ts');
const { shouldInterceptTouch } = await load('../src/lib/touchRouting.ts');
const { normalizePageSettings } = await load('../src/lib/pageSettings.ts');
test('offline navigation allows local element links and rejects external schemes', () => {
  const base = 'https://localhost/';
  assert.equal(isLocalNavigation('#element=test', base), true);
  assert.equal(isLocalNavigation(base, base), true);
  for (const href of ['https://esm.sh/', '//esm.sh/', 'javascript:alert(1)', 'data:text/html,test']) {
    assert.equal(isLocalNavigation(href, base), false);
  }
});
test('pen-only routing blocks primary drawing touch without blocking pen or navigation', () => {
  const base = { penOnlyTouchNeverDraws: true, pointerType: 'touch', isPrimary: true, activeToolType: 'freedraw' };
  assert.equal(shouldInterceptTouch(base), true);
  for (const change of [{ pointerType: 'pen' }, { activeToolType: 'hand' }, { penOnlyTouchNeverDraws: false }]) {
    assert.equal(shouldInterceptTouch({ ...base, ...change }), false);
  }
});
test('page settings normalize malformed and legacy values', () => {
  assert.equal(normalizePageSettings(null).template, 'off');
  assert.equal(normalizePageSettings({ template: 'bogus' }).template, 'off');
  assert.equal(normalizePageSettings({ template: 'lined' }).mode, 'a4-vertical');
});

const { quantizePageViewport } = await load('../src/lib/pageSettings.ts');
test('guide scroll quantization stays subpixel at 0.1x through 30x zoom', () => {
  for (const zoom of [0.1, 1, 2, 30]) {
    let maxError = 0;
    for (let i = 0; i < 2000; i++) {
      const scrollX = (i - 1000) / 1999 * 100;
      const result = quantizePageViewport({ scrollX, scrollY: -scrollX, width: 412.2, height: 839.1, zoom });
      maxError = Math.max(maxError, Math.abs((result.scrollX - scrollX) * zoom));
      assert.ok(Math.abs((result.scrollY + scrollX) * zoom) <= 0.5000001);
      assert.equal(result.width, 412);
    }
    assert.ok(maxError <= 0.5000001, `${zoom}x: ${maxError}`);
  }
});
