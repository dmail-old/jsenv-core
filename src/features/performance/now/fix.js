import {fixProperty} from '/fix-helpers.js';

let nowOffset;
if (typeof performance === 'object' && performance.timing && performance.timing.navigationStart) {
    nowOffset = performance.timing.navigationStart;
} else {
    nowOffset = Date.now();
}
const now = () => {
    return Date.now() - nowOffset;
};

const fix = {
    type: 'inline',
    value: fixProperty('performance', now)
};

export default fix;
