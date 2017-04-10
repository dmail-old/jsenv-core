const assert = global.assert
const root = global.trace.root

assert.equal(root.id, 'fixtures/variable/main.js')
assert.deepEqual(root.members, [{name: 'default', as: 'answer'}])
const dependency = root.dependencies[0]
assert.equal(dependency.id, 'fixtures/variable/node.js')
assert.deepEqual(dependency.members, [{name: 'default', state: 'inline'}])
assert.equal(dependency.dependents[0], root)
