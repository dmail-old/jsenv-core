import jsenv from 'jsenv';

import restart from './#{jsenv|default.agent.type}.js';

jsenv.provide(function restartMethod() {
    return {
        restart: restart
    };
});

