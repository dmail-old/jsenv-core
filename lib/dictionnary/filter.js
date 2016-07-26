import proto from 'env/proto';

const Filter = proto.extend('Filter', {
    name: 'filter',
    trait: null,

    constructor() {
        this.args = arguments;
    },

    getLevel() {
        return -1;
    },

    filterMethod() {
        return true;
    },

    filter(input) {
        return Boolean(this.filterMethod(input, ...this.args));
    }
});

export default Filter;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('core', function() {
            var calledWith;
            var calledOn;
            var CustomFilter = Filter.extend({
                filterMethod() {
                    calledWith = arguments;
                    calledOn = this;
                    return 1;
                }
            });
            var customFilter = CustomFilter.create('a');
            var result = customFilter.filter('b');

            assert(calledWith.length === 2);
            assert(calledWith[0] === 'b');
            assert(calledWith[1] === 'a');
            assert(calledOn === customFilter);
            assert(result === true);
        });
    }
};
