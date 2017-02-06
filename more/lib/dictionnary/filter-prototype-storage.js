import {PrototypeStorage} from 'env/string-template';
import Filter from './filter.js';

const FilterPrototypeStorage = PrototypeStorage.extend('FilterPrototypeStorage', {
    prototype: Filter,

    register() {
        if (arguments.length === 2 && typeof arguments[0] === 'string' && typeof arguments[1] === 'function') {
            return PrototypeStorage.register.call(this, {name: arguments[0], filterMethod: arguments[1]});
        }
        return PrototypeStorage.register.apply(this, arguments);
    }
});
FilterPrototypeStorage.add(Filter);

export default FilterPrototypeStorage;
