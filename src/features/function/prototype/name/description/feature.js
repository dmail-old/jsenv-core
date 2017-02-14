this.dependencies = ['object-get-own-property-descriptor'];
this.code = 'inherit';
this.pass = function() {
    var descriptor = Object.getOwnPropertyDescriptor(
        function f() {},
        'name'
    );

    return (
        descriptor.enumerable === false &&
        descriptor.writable === false &&
        descriptor.value === '',
        descriptor.configurable === true
    );
}
this.solution = 'none';
