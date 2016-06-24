var definePropertyOf;

if (Object.defineProperty) {
    definePropertyOf = function(object, name, owner) {
        var descriptor = Object.getOwnPropertyDescriptor(owner, name);
        Object.defineProperty(object, name, descriptor);
    };
} else {
    definePropertyOf = function(object, name, owner) {
        object[name] = owner[name];
    };
}

export default definePropertyOf;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('define redefine property not calling getter/setter', function() {
            var object = {
                set foo(value) {
                    this.bar = value;
                },

                get foo() {
                    return this.bar;
                }
            };

            definePropertyOf(object, 'foo', {
                foo: 'hey'
            });

            assert.equal(object.foo, 'hey');
            assert.equal('bar' in object, false);
        });
    }
};
