const test = require('node:test');
const assert = require('node:assert/strict');
const MinHeap = require('../src/scheduler/MinHeap');

test('pops items in ascending order', () => {
  const heap = new MinHeap((a, b) => a - b);
  for (const n of [5, 3, 9, 1, 7, 1, 4]) heap.push(n);
  const out = [];
  while (heap.size() > 0) out.push(heap.pop());
  assert.deepEqual(out, [1, 1, 3, 4, 5, 7, 9]);
  assert.equal(heap.pop(), undefined);
});
