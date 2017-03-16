import {fixProperty} from '/fix-helpers.js';
import polymorphPlatform from 'someehre.js';

const nowPolymorph = polymorphPlatform({
    browser() {
        const offset = (() => {
            if (typeof performance === 'object' && performance.timing && performance.timing.navigationStart) {
                return performance.timing.navigationStart;
            }
            return Date.now();
        })();
        const now = () => {
            return Date.now() - offset;
        };
        return now;
    },
    node() {
        // https://github.com/braveg1rl/performance-now/blob/master/src/performance-now.coffee
        const hrtime = process.hrtime;
        const getNanoSeconds = () => {
            const hourtime = hrtime();
            return hourtime[0] * 1e9 + hourtime[1];
        };
        const offset = (() => {
            const moduleLoadTime = getNanoSeconds();
            const upTime = process.uptime() * 1e9;
            return moduleLoadTime - upTime;
        })();
        const now = () => {
            const ns = getNanoSeconds();
            const diff = ns - offset;
            return diff / 1e6;
        };
        return now;
    }
});

const fix = {
    type: 'inline',
    value: fixProperty('performance', nowPolymorph)
};

export default fix;
