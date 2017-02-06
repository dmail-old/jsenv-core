function safeHasProperty(value, propertyName) {
    if (typeof propertyName !== 'string') {
        throw new TypeError('safeHasProperty function second argument must be a string');
    }

    let hasProperty;

    if (typeof value === 'object') {
        hasProperty = propertyName in value;
    } else {
        // primitive does not support in operator
        hasProperty = value.hasOwnProperty(propertyName);

        if (hasProperty === false) {
            let valueProto = Object.getPrototypeOf(value);
            if (valueProto) {
                hasProperty = propertyName in valueProto;
            }
        }
    }

    return hasProperty;
}

export default safeHasProperty;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add("core", function() {
            function assertHas(value, propertyName) {
                assert.equal(safeHasProperty(value, propertyName), true);
            }

            function assertHasNot(value, propertyName) {
                assert.equal(safeHasProperty(value, propertyName), false);
            }

            assertHas({name: true}, 'name');
            assertHas({}, 'toString');
            assertHas(10, 'valueOf');
            /*
            var primitive = 'string';
            primitive.boo = 'bar';
            assertHas('foo', primitive);
            */

            assertHasNot({}, 'name');
            assertHasNot(10, 'name');
        });
    }
};

