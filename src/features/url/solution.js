var URL = (function() {
    function mustAppendSlashesForProtocol(protocol) {
        return protocol === 'http' || protocol === 'https' || protocol === 'file';
    }

    // https://github.com/Polymer/URL/blob/master/url.js
    // https://gist.github.com/Yaffle/1088850
    function parseURL(url) {
        if (url === null) {
            throw new TypeError(url + ' is not a valid url');
        }
        if (url instanceof URL ) { // eslint-disable-line
            return url;
        }

        url = String(url);
        url = url.replace(/^\s+|\s+$/g, ''); // trim

        var regex = /^([^:\/?#]+:)?(?:\/\/(?:([^:@\/?#]*)(?::([^:@\/?#]*))?@)?(([^:\/?#]*)(?::(\d*))?))?([^?#]*)(\?[^#]*)?(#[\s\S]*)?/;
        // /^([^:\/?#]+:)?(\/\/(?:[^:@\/?#]*(?::[^:@\/?#]*)?@)?(([^:\/?#]*)(?::(\d*))?))?([^?#]*)(\?[^#]*)?(#[\s\S]*)?/;
        var match = url.match(regex);
        // authority = '//' + user + ':' + pass '@' + hostname + ':' port
        var parsed = null;

        if (match) {
            parsed = {
                href: match[0] || '',
                protocol: match[1] || '',
                username: match[2] || '',
                password: match[3] || '',
                host: match[4] || '',
                hostname: match[5] || '',
                port: match[6] || '',
                pathname: match[7] || '',
                search: match[8] || '',
                hash: match[9] || ''
            };

            var protocol = parsed.protocol.slice(0, -1);

            if (protocol) {
                if (protocol === 'http' || protocol === 'https') {
                    parsed.origin = protocol;
                    parsed.origin += '//';
                    parsed.origin += parsed.host;
                } else {
                    parsed.origin = protocol + ':';
                    if (parsed.host) {
                        var pathname = parsed.pathname;
                        parsed.pathname = parsed.host;
                        if (pathname) {
                            parsed.pathname += pathname;
                        }
                    }
                    parsed.host = '';
                    parsed.hostname = '';
                }
            }
        } else {
            throw new RangeError();
        }

        return parsed;
    }

    function removeDotSegments(input) {
        var output = [];

        input
        .replace(/^(\.\.?(\/|$))+/, '')
        .replace(/\/(\.(\/|$))+/g, '/')
        .replace(/\/\.\.$/, '/../')
        .replace(/\/?[^\/]*/g, function(p) {
            if (p === '/..') {
                output.pop();
            } else {
                output.push(p);
            }
        });

        return output.join('').replace(/^\//, input.charAt(0) === '/' ? '/' : '');
    }

    var URL = {
        constructor: function(urlString, base) {
            var url = parseURL(urlString);

            if (arguments.length > 1) {
                base = parseURL(base);
                var flag = url.protocol === '' && url.host === '' && url.username === '';

                if (flag && url.pathname === '' && url.search === '') {
                    url.search = base.search;
                }

                if (flag && url.pathname[0] !== '/') {
                    var pathname = '';

                    if (url.pathname) {
                        if ((base.host || base.username) && base.pathname === '') {
                            pathname += '/';
                        }
                        pathname += base.pathname.slice(0, base.pathname.lastIndexOf('/') + 1) + url.pathname;
                    } else {
                        pathname = base.pathname;
                    }

                    url.pathname = pathname;
                } else if (base.protocol === 'file:' && urlString[0] === '/' && urlString[1] === '/') {
                    url.pathname = '/' + url.host + url.pathname;
                    url.host = '';
                    url.hostname = '';
                }

                url.pathname = removeDotSegments(url.pathname);

                if (flag) {
                    url.port = base.port;
                    url.hostname = base.hostname;
                    url.host = base.host;
                    url.password = base.password;
                    url.username = base.username;
                }

                if (url.protocol === '') {
                    url.protocol = base.protocol;
                }
                url.origin = base.origin;
            }

            this.protocol = url.protocol;
            this.username = url.username;
            this.password = url.password;
            this.host = url.host;
            this.hostname = url.hostname;
            this.origin = url.origin;
            this.port = url.port;
            this.pathname = url.pathname;
            this.search = url.search;
            this.hash = url.hash;

            this.href = this.toString();
        },

        toString: function() {
            var url = '';

            url += this.protocol;
            if (this.protocol !== '' && mustAppendSlashesForProtocol(this.protocol.slice(0, -1))) {
                url += '//';
            }
            if (this.username) {
                url += this.username;
                url += this.password ? ':' + this.password : '';
                url += '@';
            }
            url += this.host;
            if (this.port) {
                url += ':' + this.port;
            }
            url += this.pathname;
            url += this.search;
            url += this.hash;

            return url;
        }
    };

    URL.constructor.prototype = URL;
    URL = URL.constructor;
    return URL;
})();

jsenv.global.URL = URL;
