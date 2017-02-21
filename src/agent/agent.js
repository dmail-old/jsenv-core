// https://github.com/jsenv/core/issues/19
// https://github.com/Financial-Times/polyfill-service/blob/master/lib/UA.js
// https://github.com/3rd-Eden/useragent

// https://github.com/babel/babel-preset-env/blob/master/src/index.js#L97

require('../jsenv.js');
var Iterable = jsenv.Iterable;
var createAgent = jsenv.createAgent;
var createPlatform = jsenv.createPlatform;
function match() {
    var agents = [];
    var i = 0;
    var j = arguments.length;
    while (i < j) {
        var agent = createAgent(arguments[i]);
        if (agent.version.isUnspecified()) {
            agent.setVersion('*');
        }
        agents.push(agent);
        i++;
    }
    var predicates = agents.map(function(agent) {
        return function(detectedAgent) {
            return agent.match(detectedAgent);
        };
    });

    return jsenv.Predicate.some.apply(null, predicates);
}
var normalizers = [
    {
        match: match(
            "blackberry webkit"
        ),
        normalize: "blackberry"
    },
    {
        match: match(
            "pale moon (firefox variant)",
            "firefox namoroka",
            "firefox shiretoko",
            "firefox minefield",
            "firefox alpha",
            "firefox beta",
            "microb",
            "mozilladeveloperpreview",
            "iceweasel"
        ),
        normalize: "firefox"
    },
    {
        match: match(
            "firefox mobile"
        ),
        normalize: 'firefox-mobile'
    },
    {
        match: match(
            "opera tablet"
        ),
        normalize: "opera"
    },
    {
        match: match(
            "op_mob",
            "op_mini"
        ),
        normalize: "opera-mobile"
    },
    {
        match: match(
            "chrome mobile",
            "chrome frame",
            "chromium"
        ),
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
        match: function(agent) {
            var majorAndMinorString = agent.version.major + '.' + agent.version.minor;
            return (
                agent.name === "yandex browser" &&
                majorAndMinorString in this.meta
            );
        },
        normalize: function(agent) {
            var majorAndMinorString = agent.version.major + '.' + agent.version.minor;
            return 'chrome/' + this.meta[majorAndMinorString] + '.0.0';
        }
    },
    {
        match: match(
            "chrome mobile ios"
        ),
        normalize: "chrome-mobile-ios"
    },
    {
        match: match(
            "ie large screen",
            "internet explorer",
            "edge",
            "edge mobile"
        ),
        normalize: 'ie'
    },
    {
        match: match(
            'uc browser/9.9.*'
        ),
        normalize: 'ie/10.0.0'
    },
    {
        match: match(
            "ie mobile"
        ),
        normalize: "ie-mobile"
    },
    {
        match: match(
            "phantomjs"
        ),
        normalize: 'safari/5.0.0'
    },
    {
        match: match(
            "mobile safari",
            "iphone",
            "iphone simulator",
            "mobile safari uiwebview"
        ),
        normalize: "safari-ios"
    },
    {
        match: function(agent, platform) {
            return (
                agent.name === 'facebook' &&
                platform.name === 'ios'
            );
        },
        normalize: function(agent, platform) {
            return agent.name + '/' + platform.major + '.' + platform.minor;
        }
    },
    {
        match: match(
            "samsung internet"
        ),
        normalize: "samsung-mobile"
    }
];
var USER_AGENT_STRING_MAX_LENGTH = 200;
var ua = require('useragent');

function parse(firstArg) {
    // https://github.com/Financial-Times/polyfill-service/blob/master/lib/UA.js
    var userAgentString = String(firstArg);
    // Limit the length of the UA to avoid perf issues in UA parsing
    var truncatedUserAgentString = userAgentString.slice(0, USER_AGENT_STRING_MAX_LENGTH);
    var match;
    // The longest string that can possibly be a normalized browser name that we
    // support is XXXXXXXXXX/###.###.### (22 chars), so avoid doing the regex if
    // the input string is longer than that
    if (truncatedUserAgentString.length < 22) {
        match = truncatedUserAgentString.match(/^([\w ]+)\/(\d+)(?:\.(\d+)(?:\.(\d+))?)?$/i);
    }
    var userAgent;
    if (match) {
        userAgent = new ua.Agent(
            match[1],
            match[2],
            (match[3] || 0),
            (match[4] || 0)
        );
    } else {
        var strippedTruncatedUserAgentString = stripiOSWebViewBrowsers(truncatedUserAgentString);
        userAgent = ua.parse(strippedTruncatedUserAgentString);
    }
    var agent = createAgent(
        userAgent.family.toLowerCase(),
        userAgent.toVersion()
    );
    var platform = createPlatform(
        userAgent.os.family.toLowerCase(),
        userAgent.os.toVersion()
    );
    return normalize(agent, platform);
}
function stripiOSWebViewBrowsers(userAgentString) {
    return userAgentString.replace(/((CriOS|OPiOS)\/(\d+)\.(\d+)\.(\d+)\.(\d+)|(FxiOS\/(\d+)\.(\d+)))/, '');
}
function normalize(agent, platform) {
    var matchedNormalizer = Iterable.find(normalizers, function(normalizer) {
        return normalizer.match(agent, platform);
    });
    if (matchedNormalizer) {
        var normalizationAgent;
        var normalize = matchedNormalizer.normalize;
        if (typeof normalize === 'string') {
            normalizationAgent = normalize;
        } else {
            normalizationAgent = matchedNormalizer.normalize(agent, platform);
        }
        if (typeof normalizationAgent === 'string') {
            normalizationAgent = createAgent(normalizationAgent);
        }
        return normalizeAgent(agent, normalizationAgent);
    }
    return agent;

    function normalizeAgent(agent, normalizationAgent) {
        var agentVersion = agent.version;
        var normalizationAgentVersion = normalizationAgent.version;
        var normalizedAgent = createAgent(normalizationAgent.name, normalizationAgent.version);
        var normalizedAgentVersion = normalizedAgent.version;

        if (normalizationAgentVersion.major.isPrecise() === false) {
            normalizedAgentVersion.major = agentVersion.major.clone();
        }
        if (normalizationAgentVersion.minor.isPrecise() === false) {
            normalizedAgentVersion.minor = agentVersion.minor.clone();
        }
        if (normalizationAgentVersion.patch.isPrecise() === false) {
            normalizedAgentVersion.patch = agentVersion.patch.clone();
        }
        return normalizedAgent;
    }
}

module.exports = {
    parse: parse,
    normalize: normalize
};

expect('yandex browser/13.10', 'chrome/28.0.0');
expect('uc browser/9.9', 'ie/10.0.0');
expect('uc browser/9.9.14', 'ie/10.0.0');
// expect('phantomjs', 'safari/5.0.0');
expect('phantomjs/2', 'safari/5.0.0');
expect('node/2', 'node/2.0.0');
expect(
    'Mozilla/5.0 (Windows NT 10.0; WOW64; rv:51.0) Gecko/20100101 Firefox/51.0',
    'firefox/51.0.0'
);
expect(
    'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36',
    'chrome/56.0.2924'
);
expect(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; ServiceUI 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.79 Safari/537.36 Edge/14.14393',
    'ie/14.14393.0'
);
function expect(agentString, expectedNormalizedAgentString) {
    var normalizedAgent = parse(agentString);
    var normalizedAgentString = normalizedAgent.toString();
    if (normalizedAgentString === expectedNormalizedAgentString) {
        // console.log(agentString, '->', expectedNormalizedAgentString);
    } else {
        throw new Error(
            agentString +
            ' must be ' +
            expectedNormalizedAgentString +
            ' (got ' +
            normalizedAgentString +
            ')'
        );
    }
}
