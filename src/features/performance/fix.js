import '/date/now/fix.js';
import {fixProperty} from '/fix-helpers.js';

const fix = {
    type: 'inline',
    value: fixProperty('performance', {})
};

export default fix;
