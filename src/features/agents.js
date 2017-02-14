// https://github.com/jsenv/core/issues/19
// https://github.com/Financial-Times/polyfill-service/blob/master/lib/UA.js
// https://github.com/3rd-Eden/useragent

var normalizers = [
    {
        match: [
            "blackberry webkit"
        ],
        normalize: "blackberry"
    },
    {
        match: [
            "pale moon (firefox variant)",
            "firefox namoroka",
            "firefox shiretoko",
            "firefox minefield",
            "firefox alpha",
            "firefox beta",
            "microb",
            "mozilladeveloperpreview",
            "iceweasel"
        ],
        normalize: "firefox"
    },
    {
        match: [
            "firefox mobile"
        ],
        normalize: 'firefox-mobile'
    },
    {
        match: [
            "opera tablet"
        ],
        normalize: "opera"
    },
    {
        match: [
            "op_mob",
            "op_mini"
        ],
        normalize: "opera-mobile"
    },
    {
        match: [
            "chrome mobile",
            "chrome frame",
            "chromium"
        ],
        normalize: "chrome"
    },
    {
        meta: {
            "13.10": 28,
            "13.12": 30,
            "14.2": 32,
            "14.4": 33,
            "14.5": 34,
            "14.7": 35,
            "14.8": 36,
            "14.10": 37
        },
        match: function(ua) {
            return (
                ua.name === "yandex browser" &&
                ua.version in this.meta
            );
        },
        normalize: function(ua) {
            return {
                name: 'chrome',
                major: this.meta[ua.version],
                minor: 0,
                patch: 0
            };
        }
    },
    {
        match: [
            "chrome mobile ios"
        ],
        normalize: "chrome-mobile-ios"
    },
    {
        match: [
            "ie large screen",
            "internet explorer",
            "edge",
            "edge mobile"
        ],
        normalize: 'ie'
    },
    {
        match: function(ua) {
            return (
                ua.name === 'uc browser' &&
                ua.version.major === 9 &&
                ua.version.minor === 9
            );
        },
        normalize: function() {
            return {
                name: 'ie',
                major: 10,
                minor: 0,
                patch: 0
            };
        }
    },
    {
        match: [
            "ie mobile"
        ],
        normalize: "ie-mobile"
    },
    {
        match: [
            "phantomjs"
        ],
        normalize: function() {
            return {
                name: 'safari',
                major: 5,
                minor: 0,
                patch: 0
            };
        }
    },
    {
        match: [
            "mobile safari",
            "iphone",
            "iphone simulator",
            "mobile safari uiwebview"
        ],
        normalize: "safari-ios"
    },
    {
        match: function(ua) {
            return (
                ua.family === 'facebook' &&
                ua.os.family === 'iOS'
            );
        },
        normalize: function(ua) {
            return {
                name: ua.family,
                major: ua.os.major,
                minor: ua.os.minor,
                patch: 0
            };
        }
    },
    {
        match: [
            "samsung internet"
        ],
        normalize: "samsung-mobile"
    }
];

module.exports = {
    agents: require('./agents.json'),
    allowedUnknownAgents: 10,
    normalizers: normalizers
};
