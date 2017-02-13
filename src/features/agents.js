// https://github.com/jsenv/core/issues/19
// https://github.com/Financial-Times/polyfill-service/blob/master/lib/UA.js
// https://github.com/3rd-Eden/useragent

var agentMapping = [
    {
        "name": "blackberry",
        "variants": [
            "blackberry webkit"
        ]
    },
    {
        "name": "firefox",
        "variants": [
            "pale moon (firefox variant)",
            "firefox namoroka",
            "firefox shiretoko",
            "firefox minefield",
            "firefox alpha",
            "firefox beta",
            "microb",
            "mozilladeveloperpreview",
            "iceweasel"
        ]
    },
    {
        "name": 'firefox-mobile',
        "variants": [
            "firefox mobile"
        ]
    },
    {
        "name": "opera",
        "variants": [
            "opera tablet"
        ]
    },
    {
        "name": "opera-mobile",
        "variants": [
            "op_mob",
            "op_mini"
        ]
    },
    {
        "name": "chrome",
        "variants": [
            "chrome mobile",
            "chrome frame",
            "chromium",
            {
                name: "yandex browser",
                redirect: function() {
                    // "14.10": ["chrome", 37],
                    // "14.8": ["chrome", 36],
                    // "14.7": ["chrome", 35],
                    // "14.5": ["chrome", 34],
                    // "14.4": ["chrome", 33],
                    // "14.2": ["chrome", 32],
                    // "13.12": ["chrome", 30],
                    // "13.10": ["chrome", 28]
                }
            }
        ]
    },
    {
        "name": "chrome-mobile-ios",
        "variants": [
            "chrome mobile ios"
        ]
    },
    {
        "name": "ie",
        "variants": [
            "ie large screen",
            "internet explorer",
            "edge",
            "edge mobile",
            {
                name: "uc browser",
                redirect: function() {
                    // "9.9.*": ["ie", 10]
                }
            }
        ]
    },
    {
        "name": "ie-mobile",
        "variants": [
            "ie mobile"
        ]
    },
    {
        "name": "safari",
        "variants": [
            {
                name: "phantomjs",
                redirect: function() {
                    // ["safari", 5],
                }
            }
        ]
    },
    {
        "name": "safari-ios",
        "variants": [
            "mobile safari",
            "iphone",
            "iphone simulator",
            "mobile safari uiwebview",
            {
                match: function(ua) {
                    return ua.family === 'facebook' && ua.os.family === 'iOS';
                },
                redirect: function(ua) {
                    return {name: ua.family, major: ua.os.major, minor: ua.os.minor};
                }
            }
        ]
    },
    {
        "name": "samsung-mobile",
        "variants": [
            "samsung internet"
        ]
    }
];

module.exports = {
    knownAgents: require('./agents.json'),
    mapping: agentMapping,
    maxUnknownAgents: 10
};
