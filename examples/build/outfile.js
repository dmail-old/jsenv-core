System.register('dir/object-assign.js', [], function (_export, _context) {
  "use strict";

  return {
    setters: [],
    execute: function () {
      console.log('same name but not object assign');

      _export('default', null);
    }
  };
});
System.register('object-keys.js', ['./dir/object-assign.js'], function (_export, _context) {
  "use strict";

  return {
    setters: [function (_dirObjectAssignJs) {}],
    execute: function () {

      console.log('fixing object keys');

      _export('default', 'keys');
    }
  };
});
System.register('object-assign.js', ['./object-keys.js', './plat/index.js'], function (_export, _context) {
  "use strict";

  return {
    setters: [function (_objectKeysJs) {}, function (_platIndexJs) {}],
    execute: function () {
      // after
      // before
      // import './dir/mock.js'
      console.log('fixing object assign');
    }
  };
});
System.registerDynamic("@env", [], true, function() {
  return {
    "platform": "node",
    "__esModule": true
  };
});

System.register('plat/index.js', ['./#{@env|platform}.js'], function (_export, _context) {
  "use strict";

  return {
    setters: [function (_envPlatformJs) {}],
    execute: function () {}
  };
});
System.register('plat/node.js', [], function (_export, _context) {
  "use strict";

  return {
    setters: [],
    execute: function () {
      _export('default', 'node');
    }
  };
});
//# sourceMappingURL=outfile.js.map