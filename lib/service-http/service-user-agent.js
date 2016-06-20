import env from 'env';
import rest from 'env/rest';

// import transport from './lib/transporter-#{jsenv|default.agent.type}.js';
// origin: env.baseURI.pathname

var UserAgentService = rest.createService({
    name: 'user-agent',

    prepare(request) {
        if (request.headers.has('user-agent') === false) {
            var userAgent = 'jsenv ';

            userAgent += env.agent.name;
            userAgent += '/';
            userAgent += env.agent.version;
            userAgent += ' (';
            userAgent += env.platform.name;
            userAgent += ' ';
            userAgent += env.platform.version;
            userAgent += ')';

            request.headers.set('user-agent', userAgent);
        }
    }
});

export default UserAgentService;
