/* eslint-env browser */

import engine from 'engine';

engine.config(function provideRestart() {
    engine.provide({
        restart() {
            window.reload();
        }
    });
});

engine.config(function populatePlatform() {
    engine.platform.setName(navigator.platform);
});

engine.config(function populateAgent() {
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

    engine.agent.setName(name);
    engine.agent.setVersion(version);
});

engine.config(function populateLanguage() {
    engine.language.listPreferences = function() {
        if ('languages' in navigator) {
            return navigator.languages.join();
        }
        if ('language' in navigator) {
            return navigator.language;
        }
        if ('userLanguage' in navigator) {
            return navigator.userLanguage;
        }
        if ('browserLanguage' in navigator) {
            return navigator.browserLanguage;
        }
        return '';
    };
});
