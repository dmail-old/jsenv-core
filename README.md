# jsenv-core

Warning : Under developpment, first working version planned for the 9/03/2017.

Dynamic polyfill generation and dynamic file transpilation.

## Example

```javascript
var jsenv = require('jsenv-core');
var features = [
    'const',
    'for-of',
    'promise',
    'symbol'
];

jsenv.polyfill(features, 'firefox/44.0').then(function(polyfill) {
    console.log(polyfill);
    // logs './node_modules/jsenv-core/cache/polyfill/ciztxodqg0000x84mdrd5crjz/polyfill.js'
});

jsenv.transpile('./file.js', features, 'chrome/52.5.10').then(function(transpiledFile) {
    console.log(transpiledFile);
    // logs './node_modules/jsenv-core/cache/transpiler/ciztybhky0000zs4m9ovbujoy/file.js'
});
```

## Installation

```
npm i https://github.com/jsenv/core
```

## Basic usage

#### jsenv.polyfill(featureIds, userAgent)

Creates a file with fix instructions required by this userAgent to get the listed features.  
Returns a promise resolving to the path of the file containing instructions.

#### jsenv.transpile(filePath, featureIds, userAgent)

Creates a file transpiling what is required by this userAgent to get the listed features (transpilation is done using [babel](https://babeljs.io/)).  
Returns a promise resolving to the path of the transpiled file.






