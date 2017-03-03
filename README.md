# jsenv

Dynamic polyfill generation and dynamic file transpilation.

## Example

```javascript
var api = require('jsenv');
var features = [
    'const',
    'for-of',
    'promise',
    'symbol'
];

api.polyfill(features, 'node/0.12.3').then(function(polyfill) {
    console.log(polyfill);
    // logs './node_modules/jsenv/cache/polyfill/ciztxodqg0000x84mdrd5crjz/polyfill.js'
});

api.transpile('./file.js', 'node/0.12.3').then(function(transpiledFile) {
    console.log(transpiledFile);
    // logs './node_modules/jsenv/cache/transpiler/ciztybhky0000zs4m9ovbujoy/file.js'
});
```

## Installation

```
npm i https://github.com/dmail/jsenv/core
```

## Basic usage

#### api.polyfill(featureIds, userAgentString)

Creates a .js file containing all the polyfill required to get the listed features for this userAgent.
It returns a promise resolving to the file path.

#### api.transpile(filePath, featureIds, userAgentString)

Create a version of the file where all feature not natively available for this userAgent are transpiled using babel.
Returns a promise resolving to the path of the transpiled file.






