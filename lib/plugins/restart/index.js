import jsenv from 'jsenv';

import restart from './#{jsenv|platform.type}.js';

jsenv.provide(function provideRestart() {
    return {
        restart: restart
    };
});

