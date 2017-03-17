System.register('object-keys.js', [], function (_export, _context) {
  "use strict";

  return {
    setters: [],
    execute: function () {

      console.log('fixing object keys');

      _export('default', 'keys');
    }
  };
});
System.register('object-assign.js', ['./object-keys.js'], function (_export, _context) {
  "use strict";

  return {
    setters: [function (_objectKeysJs) {}],
    execute: function () {

      console.log('fixing object assign');

      _export('default', 'assign');
    }
  };
});
//# sourceMappingURL=outfile.js.map