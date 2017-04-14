# Ensure

Functionnal unit test library

## Contents

- [Example](#example)
- [Writing tests](#writing-tests)
- [Running tests](#running-tests)

## Example

```js
import {
  test,
  pipe
} from 'ensure'

export default test(
  pipe(() => ({name: 'damien', age: 20}),
  'user name is a string equals to dam',
  test(
    pipe((user) => user.name),
    (name) => typeof name === 'string',
    (name) => name === 'dam'
  ),
  'user age equals 20',
  test(
    pipe((user) => user.age),
    (age) => age === 20
  )
)
```

This is a basic example, be sure to check the complete [Writing tests](#writing-tests) section to see more examples.

## Writing tests

### test(...assertions)

```js
import {test} from 'ensure'

export default test(
  'always returning true',
  () => true,
  'test first arg is truthy',
  Boolean
)
```

The test function expect any number of argument.
argument must be function optionnaly preceeded with a string describing what the function do.
function passed as argument to test are called `assertion`.

### pipe(func)

```js
import {
  test,
  pipe
} from 'ensure'

test(
  pipe((value) => Promise.resolve('foo')),
  // assertion below will receive 'foo' as value
  (value) => {}
)
```

### pipeSync(func)

```js
import {
  test,
  pipeSync
} from 'ensure'

const promise = Promise.resolve()
test(
  pipeSync(() => promise),
  // assertion below will receive promise as value
  (value) => {}
)
```

### pipeException(func)

```js
import {
  test,
  pipeException
} from 'ensure'

test(
  pipeException(() => Promise.reject('foo')),
  // assertion below will receive 'foo' as value
  (value) => {}
)
test(
  pipeException(() => {
    throw 'bar'
  }),
  // assertion below will receive 'bar' as value
  (value) => {}
)
test(
  pipeException(() => Promise.resolve('foo')),
  // assertion below will not be called because pipeException above has failed to throw/reject
  (value) => {}
)
```

### setup(func)

```js
import {
  test,
  setup
} from 'ensure'

test(
  // the function passed to setup must the first in the chain of assertions
  // it creates a special kind of assertion : "setup assertion"
  // "setup assertion" can optionally return an other function
  // in that case it will automatically create a "teardown assertion" from that returned function
  // - "normal assertion" await for "setup assertion" (they are runned in serie)
  // - "teardown assertion" are runned after all "normal assertion"
  // - "teardown assertion" are runned even in case of failure or unexpected error
  setup(() => {
    const timeoutId = setTimeout(() => {}, 1000)
    return Promise.resolve().then(() => {
      setupIsDone = true
      return () => clearTimeout(timeoutId)
    })
  }),
  () => {}
)
```

## Running tests

```js
// assuming './test/file.js' is exporting a test as default
import test from './test/file.js'

// running a test returns a promise
test().then(
  // the report object below has its own section
  (report) => {}
  // reason below can be anything but 99% of the time it will be an error object
  // that was thrown somewhere and wasn't expected by the assertions
  (reason) => {}
)

// by default assertion receive no argument until you use a "pipe assertion"
// you can pass them a first argument using the value options
test({value: 10})

// by default running a test a no timeout
// you can force test timeout doing
test({timeout: 100})
```

### Report object

Running a test means running all of its assertions.
The report object reflects that by being the composition of assertions reports.
This is the report I got applied to the [example](#Example)

```js
{
  "state": "failed",
  "duration": 10.0909090, // nanoseconds
  "detail": [
    {
      "name": "user name is a string equals to dam",
      "duration": 0.20000,
      "state": "failed",
      "detail": [
        // report below is corresponding to pipe((user) => user.name)
        {
          "duration": 1,
          "state": "passed"
        },
        // report below is corresponding to (name) => typeof name === 'string'
        {
          "duration": 1,
          "state": "passed"
        },
        // report below is corresponding to (name) => name === 'dam'
        {
          "duration": 2,
          "state": "failed",
          "detail": {
            "name": "AssertionError",
            "code": "RESOLVED_TO_FALSE",
            "message": "anonymous assertion resolved to false"
          }
        }
      ]
    },
    {
      "name": "user age equals 20",
      "duration": 3,
      "state": "passed",
      "detail": [
        // report below is corresponding to pipe((user) => user.age)
        {
          "state": "passed",
          "duration": 1
        },
        // report below is corresponding to (age) => age === 20
        {
          "state": "passed",
          "duration": 1
        }
      ]
    }
  ]
}
```
