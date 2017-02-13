this.code = 'inherit';
this.pass = function(fn) {
    var value = 2;
    // the expected behaviour is
    // var {a} = 2;
    // leads to a = 2.constructor.prototype.a;
    var prototypeValue = 'foo';
    var primitivePrototype = value.constructor.prototype;
    primitivePrototype.a = prototypeValue;
    var result = fn(value);
    delete primitivePrototype.a;

    return result === prototypeValue;
};
this.solution = 'inherit';
