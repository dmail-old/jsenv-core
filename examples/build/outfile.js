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

System.register("module.js", ["./a.js"], function($__export) {
  "use strict";
  var name;
  return {
    setters: [function($__m) {}],
    execute: function() {
      name = 'a';
      $__export('default', name);
    }
  };
});
