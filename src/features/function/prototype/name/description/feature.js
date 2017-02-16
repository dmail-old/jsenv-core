expose({
    dependencies: ['object/get-own-property-descriptor'],
    code: parent.code,
    pass: function() {
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
    },
    solution: 'none'
});
