import jsenv from 'jsenv';
import populate from './#{jsenv|default.agent.type}.js';

populate(jsenv.platform);
