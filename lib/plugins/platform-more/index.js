import jsenv from 'jsenv';
import populate from './#{jsenv|default.agent.type}.js';

jsenv.provide(function populatePlatform() {
    populate(jsenv.platform);
});
