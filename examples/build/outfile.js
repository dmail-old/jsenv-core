System.registerDynamic('examples/build/dir/mock.js', [], false, function ($__require, $__exports, $__module) {
  var _retrieveGlobal = System.registry.get("@@global-helpers").prepareGlobal($__module.id, null, null);

  (function ($__global) {
    console.log('mock');
  })(this);

  return _retrieveGlobal();
});
System.register("examples/build/dir/object-assign.js", [], function($__export) {
  "use strict";
  return {
    setters: [],
    execute: function() {
      console.log('same name but not object assign');
      $__export('default', null);
    }
  };
});

System.register("examples/build/object-keys.js", ["./dir/object-assign.js"], function($__export) {
  "use strict";
  return {
    setters: [function($__m) {}],
    execute: function() {
      console.log('fixing object keys');
      $__export('default', 'keys');
    }
  };
});

System.registerDynamic("@env", [], true, function() {
  return {
    "platform": "node",
    "__esModule": true
  };
});

System.register("examples/build/plat/node.js", [], function($__export) {
  "use strict";
  return {
    setters: [],
    execute: function() {
      $__export('default', 'node');
    }
  };
});

System.register("examples/build/plat/index.js", ["./#{@env|platform}.js"], function($__export) {
  "use strict";
  return {
    setters: [function($__m) {}],
    execute: function() {}
  };
});

System.registerDynamic('node_modules/core-js/modules/_to-object.js', ['./_defined'], true, function ($__require, exports, module) {
  var global = this || self,
      GLOBAL = global;
  // 7.1.13 ToObject(argument)
  var defined = $__require('./_defined');
  module.exports = function (it) {
    return Object(defined(it));
  };
});
System.registerDynamic("node_modules/core-js/modules/_cof.js", [], true, function ($__require, exports, module) {
  var global = this || self,
      GLOBAL = global;
  var toString = {}.toString;

  module.exports = function (it) {
    return toString.call(it).slice(8, -1);
  };
});
System.registerDynamic('node_modules/core-js/modules/_iobject.js', ['./_cof'], true, function ($__require, exports, module) {
  var global = this || self,
      GLOBAL = global;
  // fallback for non-array-like ES3 and non-enumerable old V8 strings
  var cof = $__require('./_cof');
  module.exports = Object('z').propertyIsEnumerable(0) ? Object : function (it) {
    return cof(it) == 'String' ? it.split('') : Object(it);
  };
});
System.registerDynamic("node_modules/core-js/modules/_defined.js", [], true, function ($__require, exports, module) {
  var global = this || self,
      GLOBAL = global;
  // 7.2.1 RequireObjectCoercible(argument)
  module.exports = function (it) {
    if (it == undefined) throw TypeError("Can't call method on  " + it);
    return it;
  };
});
System.registerDynamic('node_modules/core-js/modules/_to-iobject.js', ['./_iobject', './_defined'], true, function ($__require, exports, module) {
  var global = this || self,
      GLOBAL = global;
  // to indexed object, toObject with fallback for non-array-like ES3 strings
  var IObject = $__require('./_iobject'),
      defined = $__require('./_defined');
  module.exports = function (it) {
    return IObject(defined(it));
  };
});
System.registerDynamic('node_modules/core-js/modules/_to-length.js', ['./_to-integer'], true, function ($__require, exports, module) {
  var global = this || self,
      GLOBAL = global;
  // 7.1.15 ToLength
  var toInteger = $__require('./_to-integer'),
      min = Math.min;
  module.exports = function (it) {
    return it > 0 ? min(toInteger(it), 0x1fffffffffffff) : 0; // pow(2, 53) - 1 == 9007199254740991
  };
});
System.registerDynamic("node_modules/core-js/modules/_to-integer.js", [], true, function ($__require, exports, module) {
  var global = this || self,
      GLOBAL = global;
  // 7.1.4 ToInteger
  var ceil = Math.ceil,
      floor = Math.floor;
  module.exports = function (it) {
    return isNaN(it = +it) ? 0 : (it > 0 ? floor : ceil)(it);
  };
});
System.registerDynamic('node_modules/core-js/modules/_to-index.js', ['./_to-integer'], true, function ($__require, exports, module) {
  var global = this || self,
      GLOBAL = global;
  var toInteger = $__require('./_to-integer'),
      max = Math.max,
      min = Math.min;
  module.exports = function (index, length) {
    index = toInteger(index);
    return index < 0 ? max(index + length, 0) : min(index, length);
  };
});
System.registerDynamic('node_modules/core-js/modules/_array-includes.js', ['./_to-iobject', './_to-length', './_to-index'], true, function ($__require, exports, module) {
  var global = this || self,
      GLOBAL = global;
  // false -> Array#indexOf
  // true  -> Array#includes
  var toIObject = $__require('./_to-iobject'),
      toLength = $__require('./_to-length'),
      toIndex = $__require('./_to-index');
  module.exports = function (IS_INCLUDES) {
    return function ($this, el, fromIndex) {
      var O = toIObject($this),
          length = toLength(O.length),
          index = toIndex(fromIndex, length),
          value;
      // Array#includes uses SameValueZero equality algorithm
      if (IS_INCLUDES && el != el) while (length > index) {
        value = O[index++];
        if (value != value) return true;
        // Array#toIndex ignores holes, Array#includes - not
      } else for (; length > index; index++) if (IS_INCLUDES || index in O) {
        if (O[index] === el) return IS_INCLUDES || index || 0;
      }return !IS_INCLUDES && -1;
    };
  };
});
System.registerDynamic('node_modules/core-js/modules/_shared.js', ['./_global'], true, function ($__require, exports, module) {
  var global = this || self,
      GLOBAL = global;
  var global = $__require('./_global'),
      SHARED = '__core-js_shared__',
      store = global[SHARED] || (global[SHARED] = {});
  module.exports = function (key) {
    return store[key] || (store[key] = {});
  };
});
System.registerDynamic('node_modules/core-js/modules/_shared-key.js', ['./_shared', './_uid'], true, function ($__require, exports, module) {
  var global = this || self,
      GLOBAL = global;
  var shared = $__require('./_shared')('keys'),
      uid = $__require('./_uid');
  module.exports = function (key) {
    return shared[key] || (shared[key] = uid(key));
  };
});
System.registerDynamic('node_modules/core-js/modules/_object-keys-internal.js', ['./_has', './_to-iobject', './_array-includes', './_shared-key'], true, function ($__require, exports, module) {
  var global = this || self,
      GLOBAL = global;
  var has = $__require('./_has'),
      toIObject = $__require('./_to-iobject'),
      arrayIndexOf = $__require('./_array-includes')(false),
      IE_PROTO = $__require('./_shared-key')('IE_PROTO');

  module.exports = function (object, names) {
    var O = toIObject(object),
        i = 0,
        result = [],
        key;
    for (key in O) if (key != IE_PROTO) has(O, key) && result.push(key);
    // Don't enum bug & hidden keys
    while (names.length > i) if (has(O, key = names[i++])) {
      ~arrayIndexOf(result, key) || result.push(key);
    }
    return result;
  };
});
System.registerDynamic('node_modules/core-js/modules/_enum-bug-keys.js', [], true, function ($__require, exports, module) {
  var global = this || self,
      GLOBAL = global;
  // IE 8- don't enum bug keys
  module.exports = 'constructor,hasOwnProperty,isPrototypeOf,propertyIsEnumerable,toLocaleString,toString,valueOf'.split(',');
});
System.registerDynamic('node_modules/core-js/modules/_object-keys.js', ['./_object-keys-internal', './_enum-bug-keys'], true, function ($__require, exports, module) {
  var global = this || self,
      GLOBAL = global;
  // 19.1.2.14 / 15.2.3.14 Object.keys(O)
  var $keys = $__require('./_object-keys-internal'),
      enumBugKeys = $__require('./_enum-bug-keys');

  module.exports = Object.keys || function keys(O) {
    return $keys(O, enumBugKeys);
  };
});
System.registerDynamic('node_modules/core-js/modules/_an-object.js', ['./_is-object'], true, function ($__require, exports, module) {
  var global = this || self,
      GLOBAL = global;
  var isObject = $__require('./_is-object');
  module.exports = function (it) {
    if (!isObject(it)) throw TypeError(it + ' is not an object!');
    return it;
  };
});
System.registerDynamic('node_modules/core-js/modules/_global.js', [], true, function ($__require, exports, module) {
  var global = this || self,
      GLOBAL = global;
  // https://github.com/zloirock/core-js/issues/86#issuecomment-115759028
  var global = module.exports = typeof window != 'undefined' && window.Math == Math ? window : typeof self != 'undefined' && self.Math == Math ? self : Function('return this')();
  if (typeof __g == 'number') __g = global; // eslint-disable-line no-undef
});
System.registerDynamic('node_modules/core-js/modules/_dom-create.js', ['./_is-object', './_global'], true, function ($__require, exports, module) {
  var global = this || self,
      GLOBAL = global;
  var isObject = $__require('./_is-object'),
      document = $__require('./_global').document
  // in old IE typeof document.createElement is 'object'
  ,
      is = isObject(document) && isObject(document.createElement);
  module.exports = function (it) {
    return is ? document.createElement(it) : {};
  };
});
System.registerDynamic('node_modules/core-js/modules/_ie8-dom-define.js', ['./_descriptors', './_fails', './_dom-create'], true, function ($__require, exports, module) {
  var global = this || self,
      GLOBAL = global;
  module.exports = !$__require('./_descriptors') && !$__require('./_fails')(function () {
    return Object.defineProperty($__require('./_dom-create')('div'), 'a', { get: function () {
        return 7;
      } }).a != 7;
  });
});
System.registerDynamic('node_modules/core-js/modules/_is-object.js', [], true, function ($__require, exports, module) {
  var global = this || self,
      GLOBAL = global;
  module.exports = function (it) {
    return typeof it === 'object' ? it !== null : typeof it === 'function';
  };
});
System.registerDynamic('node_modules/core-js/modules/_to-primitive.js', ['./_is-object'], true, function ($__require, exports, module) {
  var global = this || self,
      GLOBAL = global;
  // 7.1.1 ToPrimitive(input [, PreferredType])
  var isObject = $__require('./_is-object');
  // instead of the ES6 spec version, we didn't implement @@toPrimitive case
  // and the second argument - flag - preferred type is a string
  module.exports = function (it, S) {
    if (!isObject(it)) return it;
    var fn, val;
    if (S && typeof (fn = it.toString) == 'function' && !isObject(val = fn.call(it))) return val;
    if (typeof (fn = it.valueOf) == 'function' && !isObject(val = fn.call(it))) return val;
    if (!S && typeof (fn = it.toString) == 'function' && !isObject(val = fn.call(it))) return val;
    throw TypeError("Can't convert object to primitive value");
  };
});
System.registerDynamic('node_modules/core-js/modules/_object-dp.js', ['./_an-object', './_ie8-dom-define', './_to-primitive', './_descriptors'], true, function ($__require, exports, module) {
  var global = this || self,
      GLOBAL = global;
  var anObject = $__require('./_an-object'),
      IE8_DOM_DEFINE = $__require('./_ie8-dom-define'),
      toPrimitive = $__require('./_to-primitive'),
      dP = Object.defineProperty;

  exports.f = $__require('./_descriptors') ? Object.defineProperty : function defineProperty(O, P, Attributes) {
    anObject(O);
    P = toPrimitive(P, true);
    anObject(Attributes);
    if (IE8_DOM_DEFINE) try {
      return dP(O, P, Attributes);
    } catch (e) {/* empty */}
    if ('get' in Attributes || 'set' in Attributes) throw TypeError('Accessors not supported!');
    if ('value' in Attributes) O[P] = Attributes.value;
    return O;
  };
});
System.registerDynamic("node_modules/core-js/modules/_property-desc.js", [], true, function ($__require, exports, module) {
  var global = this || self,
      GLOBAL = global;
  module.exports = function (bitmap, value) {
    return {
      enumerable: !(bitmap & 1),
      configurable: !(bitmap & 2),
      writable: !(bitmap & 4),
      value: value
    };
  };
});
System.registerDynamic('node_modules/core-js/modules/_descriptors.js', ['./_fails'], true, function ($__require, exports, module) {
  var global = this || self,
      GLOBAL = global;
  // Thank's IE8 for his funny defineProperty
  module.exports = !$__require('./_fails')(function () {
    return Object.defineProperty({}, 'a', { get: function () {
        return 7;
      } }).a != 7;
  });
});
System.registerDynamic('node_modules/core-js/modules/_hide.js', ['./_object-dp', './_property-desc', './_descriptors'], true, function ($__require, exports, module) {
  var global = this || self,
      GLOBAL = global;
  var dP = $__require('./_object-dp'),
      createDesc = $__require('./_property-desc');
  module.exports = $__require('./_descriptors') ? function (object, key, value) {
    return dP.f(object, key, createDesc(1, value));
  } : function (object, key, value) {
    object[key] = value;
    return object;
  };
});
System.registerDynamic("node_modules/core-js/modules/_has.js", [], true, function ($__require, exports, module) {
  var global = this || self,
      GLOBAL = global;
  var hasOwnProperty = {}.hasOwnProperty;
  module.exports = function (it, key) {
    return hasOwnProperty.call(it, key);
  };
});
System.registerDynamic('node_modules/core-js/modules/_uid.js', [], true, function ($__require, exports, module) {
  var global = this || self,
      GLOBAL = global;
  var id = 0,
      px = Math.random();
  module.exports = function (key) {
    return 'Symbol('.concat(key === undefined ? '' : key, ')_', (++id + px).toString(36));
  };
});
System.registerDynamic('node_modules/core-js/modules/_redefine.js', ['./_global', './_hide', './_has', './_uid', './_core'], true, function ($__require, exports, module) {
  var global = this || self,
      GLOBAL = global;
  var global = $__require('./_global'),
      hide = $__require('./_hide'),
      has = $__require('./_has'),
      SRC = $__require('./_uid')('src'),
      TO_STRING = 'toString',
      $toString = Function[TO_STRING],
      TPL = ('' + $toString).split(TO_STRING);

  $__require('./_core').inspectSource = function (it) {
    return $toString.call(it);
  };

  (module.exports = function (O, key, val, safe) {
    var isFunction = typeof val == 'function';
    if (isFunction) has(val, 'name') || hide(val, 'name', key);
    if (O[key] === val) return;
    if (isFunction) has(val, SRC) || hide(val, SRC, O[key] ? '' + O[key] : TPL.join(String(key)));
    if (O === global) {
      O[key] = val;
    } else {
      if (!safe) {
        delete O[key];
        hide(O, key, val);
      } else {
        if (O[key]) O[key] = val;else hide(O, key, val);
      }
    }
    // add fake Function#toString for correct work wrapped methods / constructors with methods like LoDash isNative
  })(Function.prototype, TO_STRING, function toString() {
    return typeof this == 'function' && this[SRC] || $toString.call(this);
  });
});
System.registerDynamic('node_modules/core-js/modules/_a-function.js', [], true, function ($__require, exports, module) {
  var global = this || self,
      GLOBAL = global;
  module.exports = function (it) {
    if (typeof it != 'function') throw TypeError(it + ' is not a function!');
    return it;
  };
});
System.registerDynamic('node_modules/core-js/modules/_ctx.js', ['./_a-function'], true, function ($__require, exports, module) {
  var global = this || self,
      GLOBAL = global;
  // optional / simple context binding
  var aFunction = $__require('./_a-function');
  module.exports = function (fn, that, length) {
    aFunction(fn);
    if (that === undefined) return fn;
    switch (length) {
      case 1:
        return function (a) {
          return fn.call(that, a);
        };
      case 2:
        return function (a, b) {
          return fn.call(that, a, b);
        };
      case 3:
        return function (a, b, c) {
          return fn.call(that, a, b, c);
        };
    }
    return function () /* ...args */{
      return fn.apply(that, arguments);
    };
  };
});
System.registerDynamic('node_modules/core-js/modules/_export.js', ['./_global', './_core', './_hide', './_redefine', './_ctx'], true, function ($__require, exports, module) {
  var global = this || self,
      GLOBAL = global;
  var global = $__require('./_global'),
      core = $__require('./_core'),
      hide = $__require('./_hide'),
      redefine = $__require('./_redefine'),
      ctx = $__require('./_ctx'),
      PROTOTYPE = 'prototype';

  var $export = function (type, name, source) {
    var IS_FORCED = type & $export.F,
        IS_GLOBAL = type & $export.G,
        IS_STATIC = type & $export.S,
        IS_PROTO = type & $export.P,
        IS_BIND = type & $export.B,
        target = IS_GLOBAL ? global : IS_STATIC ? global[name] || (global[name] = {}) : (global[name] || {})[PROTOTYPE],
        exports = IS_GLOBAL ? core : core[name] || (core[name] = {}),
        expProto = exports[PROTOTYPE] || (exports[PROTOTYPE] = {}),
        key,
        own,
        out,
        exp;
    if (IS_GLOBAL) source = name;
    for (key in source) {
      // contains in native
      own = !IS_FORCED && target && target[key] !== undefined;
      // export native or passed
      out = (own ? target : source)[key];
      // bind timers to global for call from export context
      exp = IS_BIND && own ? ctx(out, global) : IS_PROTO && typeof out == 'function' ? ctx(Function.call, out) : out;
      // extend global
      if (target) redefine(target, key, out, type & $export.U);
      // export
      if (exports[key] != out) hide(exports, key, exp);
      if (IS_PROTO && expProto[key] != out) expProto[key] = out;
    }
  };
  global.core = core;
  // type bitmap
  $export.F = 1; // forced
  $export.G = 2; // global
  $export.S = 4; // static
  $export.P = 8; // proto
  $export.B = 16; // bind
  $export.W = 32; // wrap
  $export.U = 64; // safe
  $export.R = 128; // real proto method for `library` 
  module.exports = $export;
});
System.registerDynamic('node_modules/core-js/modules/_core.js', [], true, function ($__require, exports, module) {
  var global = this || self,
      GLOBAL = global;
  var core = module.exports = { version: '2.4.0' };
  if (typeof __e == 'number') __e = core; // eslint-disable-line no-undef
});
System.registerDynamic("node_modules/core-js/modules/_fails.js", [], true, function ($__require, exports, module) {
  var global = this || self,
      GLOBAL = global;
  module.exports = function (exec) {
    try {
      return !!exec();
    } catch (e) {
      return true;
    }
  };
});
System.registerDynamic('node_modules/core-js/modules/_object-sap.js', ['./_export', './_core', './_fails'], true, function ($__require, exports, module) {
  var global = this || self,
      GLOBAL = global;
  // most Object methods by ES6 should accept primitives
  var $export = $__require('./_export'),
      core = $__require('./_core'),
      fails = $__require('./_fails');
  module.exports = function (KEY, exec) {
    var fn = (core.Object || {})[KEY] || Object[KEY],
        exp = {};
    exp[KEY] = exec(fn);
    $export($export.S + $export.F * fails(function () {
      fn(1);
    }), 'Object', exp);
  };
});
System.registerDynamic('node_modules/core-js/modules/es6.object.keys.js', ['./_to-object', './_object-keys', './_object-sap'], true, function ($__require, exports, module) {
  var global = this || self,
      GLOBAL = global;
  // 19.1.2.14 Object.keys(O)
  var toObject = $__require('./_to-object'),
      $keys = $__require('./_object-keys');

  $__require('./_object-sap')('keys', function () {
    return function keys(it) {
      return $keys(toObject(it));
    };
  });
});
System.register("examples/build/object-assign.js", ["./dir/mock.js", "./object-keys.js", "./plat/index.js", "core-js/modules/es6.object.keys.js"], function($__export) {
  "use strict";
  return {
    setters: [function($__m) {}, function($__m) {}, function($__m) {}, function($__m) {}],
    execute: function() {
      console.log('fixing object assign');
    }
  };
});

//# sourceMappingURL=outfile.js.map