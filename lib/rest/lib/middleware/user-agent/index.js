import env from 'env';

import AutoRequestHeader from '../auto-request-header.js';

const UserAgentAutoRequestHeader = AutoRequestHeader.create('user-agent', function() {
    var userAgent = 'jsenv ';

    userAgent += env.agent.name;
    userAgent += '/';
    userAgent += env.agent.version;
    userAgent += ' (';
    userAgent += env.platform.name;
    userAgent += ' ';
    userAgent += env.platform.version;
    userAgent += ')';

    return userAgent;
});

export default UserAgentAutoRequestHeader;
