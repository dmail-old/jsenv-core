# jsenv [![codecov](https://codecov.io/gh/dmail/jsenv/branch/master/graph/badge.svg?token=0aUNAZxv2B)](https://codecov.io/gh/dmail/jsenv) [![build](https://travis-ci.com/dmail/jsenv.svg?token=xrJsqdmzZ8gX9jGU8FSY)](https://travis-ci.com/dmail/jsenv)

This project is under development.  
The first thing to do is to update this readme to explain what needs to be done.  

## Presentation

jsenv respond to four prime requirements, I want to execute js file in order to...

- ... get code output
- ... monitor code output as I'm coding (hot reloading)
- ... test if code behave as expected (unit tests)
- ... see dead branch in the code (code covergae)

In response to these requirements, jsenv has one command : `jsenv path-to-file.js`.  
This command comes with many options letting you get the behaviour you want.    

- Run only : `jsenv file.js`
- Run + hot reloading : `jsenv file.js -monitor`
- Run + hot reloading + unit test : `jsenv file.js -monitor -test`
- Run + hot reloading + unit test + code coverage : `jsenv file.js -monitor -test -cover`

### List of options

name:default               | description
-------------------------- | ------------------
filename:index.js         | The file that will be runned
platform:node             | Set platform running your JavaScript, one of 'node', 'chrome'
monitor:false             | Watch runned file and internal dependencies to re-execute when one is modified
test:false                | Create a unit test report for runned file and its internal dependencies
test-report-console:true  | Generate unit test report as text in the console
test-report-json:false    | Generate unit test report as json in the console
cover:false               | Create a code coverage report for runned file and its internal dependencies
cover-report-console:true | Generate code coverage report as text in the console
cover-report-json:false   | Generate code coverage report as json in the console
cover-report-html:false   | Generate code coverage report as html in a folder at 'index-coverage' for 'index.js'
cover-upload-codecov:false | Send code coverage report to codecov
cover-upload-codecov-token:process.env.CODECOV_TOKEN | Use this token as authentification on codecov






