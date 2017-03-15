System.register("a.js", [], function($__export) {
  "use strict";
  function foo() {
    console.log('foo');
  }
  function bar() {
    console.log('yo');
  }
  return {
    setters: [],
    execute: function() {
      $__export("foo", foo);
      $__export("bar", bar);
    }
  };
});
