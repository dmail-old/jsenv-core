import {PrototypeStorage} from 'env/string-template';
import Filter from './filter.js';

const FilterStorage = PrototypeStorage.extend('FilterStorage', {
    prototype: Filter,

    register() {
        if (arguments.length === 2 && typeof arguments[0] === 'string' && typeof arguments[1] === 'function') {
            return PrototypeStorage.register.call(this, {name: arguments[0], filterMethod: arguments[1]});
        }
        return PrototypeStorage.register.apply(this, arguments);
    }
});
FilterStorage.add(Filter);

export default FilterStorage;
