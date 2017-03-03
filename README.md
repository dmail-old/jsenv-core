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

api.transpile('./file.js', features, 'node/0.12.3').then(function(transpiledFile) {
    console.log(transpiledFile);
    // logs './node_modules/jsenv/cache/transpiler/ciztybhky0000zs4m9ovbujoy/file.js'
});
```

## Installation

```
npm i https://github.com/dmail/jsenv/core
```

## Basic usage

#### api.polyfill(featureIds, userAgent)

Creates a file with fix instructions required by this userAgent to get the listed features.  
Returns a promise resolving to the path of the file containing instructions.

#### api.transpile(filePath, featureIds, userAgent)

Creates a file transpiling what is required by this userAgent to get the listed features (transpilation is done using [babel](https://babeljs.io/)).  
Returns a promise resolving to the path of the transpiled file.






