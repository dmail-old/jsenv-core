import PrototypeStorage from './prototype-storage.js';
import Transformer from './transformer.js';

const TransformerPrototypeStorage = PrototypeStorage.extend('TransformerPrototypeStorage', {
    prototype: Transformer,

    register(name, transformMethod) {
        return PrototypeStorage.register.call(this, {name: name, transformMethod: transformMethod});
    }
});
TransformerPrototypeStorage.add(Transformer);

export default TransformerPrototypeStorage;
