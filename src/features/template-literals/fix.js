import '/object/freeze/fix.js';
import '/object/is-frozen/fix.js';
import '/object/define-properties/fix.js';

const fix = {
    type: 'babel',
    value: 'transform-es2015-template-literals',
    config() {
        return {
            loose: false,
            spec: true
        };
    }
};

export default fix;
