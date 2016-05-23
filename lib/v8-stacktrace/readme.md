# StackTrace [![npm version](https://badge.fury.io/js/node-stacktrace.svg)](http://badge.fury.io/js/node-stacktrace) [![Build Status](https://travis-ci.org/dmail/node-stacktrace.svg)](http://travis-ci.org/dmail/node-stacktrace) [![coverage](https://codecov.io/github/dmail/node-stacktrace/coverage.svg?branch=master)](https://codecov.io/github/dmail/node-stacktrace?branch=master)

Parse stack from error and help to manipulate it

## create(error)

Returns a stacktrace from error using error.stack.

#### stackTrace properties

```javascript
var error = new Error();
var stackTrace = require('node-stacktrace').create(error);

stackTrace.callSites; // an array of callSite object representing the stack
stackTrace.fileName; // filename of the first callSite : __filename
stackTrace.lineNumber; // line number of the first callSite : 1
stackTrace.columnNumber; // columnnumber of the first callSite : 12
stackTrace.toString(); // todo
```

## install(error)

Returns a stacktrace from error & install some properties on error

#### installed properties on error 

```javascript
var error = new Error();
var stackTrace = require('node-stacktrace').install(error);

error.stackTrace; // stackTrace
error.fileName; // stackTrace.fileName
error.lineNumber; // stackTrace.lineNumber
error.columnNumber; // stackTrace.columnNumber
error.toString(); // todo
```


