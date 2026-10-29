import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../src/lib/workspacePaths.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { workspaceRootPath, parseWorkspacePath, resolveCanvasIndexKey } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const root = 'content://com.android.externalstorage.documents/tree/primary%3ADocuments';
test('workspace paths retain root identity without changing default paths', () => {
  assert.equal(workspaceRootPath(), 'Excalidraw');
  const path = `${workspaceRootPath(root)}/canvases/a.excalidraw`;
  assert.deepEqual(parseWorkspacePath(path), { treeUri: root, path: 'Excalidraw/canvases/a.excalidraw' });
  assert.equal(parseWorkspacePath('Excalidraw/canvases/a.excalidraw'), null);
  assert.notEqual(workspaceRootPath(root), workspaceRootPath(`${root}%2Fother`));
});
test('workspace paths reject remote providers, traversal and reserved names', () => {
  for (const path of ['../file', 'a//file', '.excalibur-file', 'a\\b', 'bad\n\nname']) {
    assert.throws(() => parseWorkspacePath(`${workspaceRootPath(root)}/${path}`));
  }
  assert.throws(() => parseWorkspacePath(workspaceRootPath('https://esm.sh/')));
  assert.throws(() => parseWorkspacePath(workspaceRootPath('content://remote.provider/tree/id')));
});

test('default Documents tree reuses legacy canvas IDs in both directions', () => {
  const path = 'Excalidraw/canvases/a.excalidraw';
  const saf = `${workspaceRootPath(root)}/canvases/a.excalidraw`;
  const legacyKey = `documents:${path}`;
  const safKey = `documents:${saf}`;
  const legacy = { [legacyKey]: { id: 'existing', location: 'documents', path } };
  assert.equal(resolveCanvasIndexKey('documents', saf, legacy), legacyKey);
  const previousWorkspace = { [safKey]: { id: 'workspace-existing', location: 'documents', path: saf } };
  assert.equal(resolveCanvasIndexKey('documents', path, previousWorkspace), safKey);
  previousWorkspace[safKey].path = path;
  assert.equal(resolveCanvasIndexKey('documents', path, previousWorkspace), safKey);
  assert.equal(resolveCanvasIndexKey('documents', saf, {}), legacyKey);
});
test('different roots stay distinct and existing conflicting histories are not merged', () => {
  const path = 'Excalidraw/canvases/a.excalidraw';
  const saf = `${workspaceRootPath(root)}/canvases/a.excalidraw`;
  const other = `${workspaceRootPath(`${root}%2Fother`)}/canvases/a.excalidraw`;
  const legacyKey = `documents:${path}`, safKey = `documents:${saf}`;
  const index = { [legacyKey]: { id: 'legacy', location: 'documents', path },
    [safKey]: { id: 'workspace', location: 'documents', path: saf } };
  const before = JSON.stringify(index);
  assert.equal(resolveCanvasIndexKey('documents', path, index), legacyKey);
  assert.equal(resolveCanvasIndexKey('documents', saf, index), safKey);
  assert.equal(resolveCanvasIndexKey('documents', other, index), `documents:${other}`);
  assert.equal(JSON.stringify(index), before);
});
