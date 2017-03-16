System.register('a.js', [], function (_export, _context) {
    "use strict";

    function foo() {
        console.log('foo');
    }
    function bar() {
        console.log('yo');
    }

    return {
        setters: [],
        execute: function () {
            _export('foo', foo);

            _export('bar', bar);
        }
    };
});
System.register('module.js', ['./a.js'], function (_export, _context) {
  "use strict";

  return {
    setters: [function (_aJs) {}],
    execute: function () {
      _export('default', 'module');
    }
  };
});
//# sourceMappingURL=outfile.js.map