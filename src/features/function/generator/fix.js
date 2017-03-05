import '/symbol-iterator/fix.js';
import '/object/get-prototype-of/fix.js';
import '/regenerator-runtime/fix.js';

const fix = {
    type: 'babel',
    value: 'transform-regenerator',
    config(features) {
        var config = {};
        config.generators = true;
        config.async = jsenv.Iterable.some(features, function(feature) {
            return feature.fix.value === 'transform-async-to-generator';
        });
        config.asyncGenerators = config.async;
        return config;
    }
};

export default fix;
