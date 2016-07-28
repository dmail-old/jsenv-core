import PrototypeStorage from './prototype-storage.js';
import Transformer from './transformer.js';

const TransformerStorage = PrototypeStorage.extend('TransformerStorage', {
    prototype: Transformer,

    register(name, transformMethod) {
        return PrototypeStorage.register.call(this, {name: name, transformMethod: transformMethod});
    }
});
TransformerStorage.add(Transformer);

export default TransformerStorage;
