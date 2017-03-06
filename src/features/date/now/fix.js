import {fixProperty} from '/fix-helpers.js';

function now() {
    return new Date().getTime();
}

const fix = {
    type: 'inline',
    value: fixProperty(Date, 'now', now)
};

export default fix;
