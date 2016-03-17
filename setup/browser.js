/* global navigator, document */

import platform from 'platform';

var agent = (function() {
    var ua = navigator.userAgent.toLowerCase();
    var regex = /(opera|ie|firefox|chrome|version)[\s\/:]([\w\d\.]+(?:\.\d+)?)?.*?(safari|version[\s\/:]([\w\d\.]+)|$)/;
    var UA = ua.match(regex) || [null, 'unknown', 0];
    var name = UA[1] === 'version' ? UA[3] : UA[1];
    var version;

    // version
    if (UA[1] === 'ie' && document.documentMode) {
        version = document.documentMode;
    } else if (UA[1] === 'opera' && UA[4]) {
        version = UA[4];
    } else {
        version = UA[2];
    }

    return {
        name: name,
        version: version
    };
})();

platform.name = agent.name;
platform.setVersion(agent.version);
// platform.engine.setName(); // spider monkey, v8, etc
platform.language.set(navigator.language || navigator.userLanguage || navigator.browserLanguage);
