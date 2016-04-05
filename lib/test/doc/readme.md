# system-test

Unit tests es6 modules

## Features

- Support es6 modules
- Based on promise
- Powerful HTML test report

## Examples

Check examples in the [test folder](./test).
You can run them using this command : `npm install system-test & cd system-test & npm test`

## How to use

Create a file at `test/my-test.js`

```javascript
export function suite(add){
  add("2+2 = 3", function(test){
    test.equal(2+2, 3);
  });
}
```

Now run `npm install system-test --save & npm test` to get the following output.

```
test/my-test.js:3:9
      test.equal(2+2, 3);
      ^AssertionError: 4 not equal to 3
```

## Documentation

- [timeout](./doc/timeout.md)
- [avvanced doc](./doc/advanced.md)

## Dependencies

- [node-stacktrace](https://github.com/dmail/node-stacktrace)
- [system-platform](https://github.com/dmail/system-platform)
- [system-node-sourcemap](https://github.com/dmail/system-node-sourcemap)
