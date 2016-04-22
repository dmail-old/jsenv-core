import jsenv from 'jsenv';

import restart from './#{jsenv|default.agent.type}.js';

jsenv.provide(function provideRestart() {
    return {
        restart: restart
    };
});

