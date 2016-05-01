import jsenv from 'jsenv';

import restart from './#{jsenv|default.agent.type}.js';

jsenv.build(function restartMethod() {
    return {
        restart: restart
    };
});

