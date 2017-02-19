expose(
    'object/get-own-property-descriptor',
    {
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
    }
);
