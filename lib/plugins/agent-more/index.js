import jsenv from 'jsenv';
import populate from './#{jsenv|default.agent.type}.js';

jsenv.provide(function populateAgent() {
    populate(jsenv.agent);
});
