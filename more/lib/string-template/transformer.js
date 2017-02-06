import proto from 'env/proto';

const Transformer = proto.extend('Transformer', {
    name: 'transform',

    constructor() {
        this.args = arguments;
    },

    transformMethod(input) {
        return input;
    },

    transform(input) {
        return this.transformMethod(input, ...this.args);
    }
});

export default Transformer;
