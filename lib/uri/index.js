/* global URLSearchParams */
/* eslint-env browser, node */

/*
https://tools.ietf.org/html/rfc3986#section-1.1.3
https://github.com/jden/url-relative/blob/master/index.js
https://medialize.github.io/URI.js/about-uris.html
https://github.com/Polymer/URL/blob/master/url.js
https://gist.github.com/Yaffle/1088850
               origin
       __________|__________
      /                     \
                         authority
     |             __________|_________
     |            /                    \
              userinfo                host                          resource
     |         __|___                ___|___                 __________|___________
     |        /      \              /       \               /                      \
         username  password     hostname    port       pathname           search   hash
     |     __|___   __|__    ______|______   |   __________|_________   ____|____   |
     |    /      \ /     \  /             \ / \ /                    \ /         \ / \
    foo://username:password@www.example.com:123/hello/world/there.html?name=ferret#foo
    \_/                     \ / \ ___ / \ /    \__________/ \   / \  /
     |                       /     |     |           |       \ /    /
  protocol         subdomain domainname tld      dirname basename suffix
                                   \____/                      \___/
                                      |                          |
                                    domain                   filename
*/

(function(global) {
    function URI(data, base) {
        if (data instanceof URI) {
            return data;
        }
        var url = new URL(data, base);
        this.fromURL(url);
        this.url = url;
    }

    var properties = {
        protocol: null,
        username: null,
        password: null,
        subdomain: null,
        domainname: null,
        tld: null,
        port: null,
        dirname: null,
        filename: null,
        suffix: null,
        searchParams: null,
        hash: null
    };

    Object.keys(properties).forEach(function(propertyName) {
        URI.prototype[propertyName] = properties[propertyName];
    });

    function splitLast(source, motif) {
        var motifIndex = source.lastIndexOf(motif);
        if (motifIndex > -1) {
            return [source.slice(0, motifIndex), source.slice(motifIndex + motif.length)];
        }
        return [source, ''];
    }

    function split(source, motif) {
        var motifIndex = source.indexOf(motif);
        if (motifIndex > -1) {
            return [source.slice(0, motifIndex), source.slice(motifIndex + motif.length)];
        }
        return ['', source];
    }

    function join(a, separator, b) {
        var result = '';

        if (a) {
            result += a;
            if (b) {
                result += separator + b;
            }
        } else if (b) {
            result += b;
        }

        return result;
    }

    var abstractions = {
        // abstraction level : 1
        domain: {
            parts: ['domainname', 'tld'],
            get: function(domainname, tld) {
                return join(domainname, '.', tld);
            },

            set: function(domain) {
                return splitLast(domain, '.');
            }
        },

        userinfo: {
            parts: ['username', 'password'],
            get: function(username, password) {
                return join(username, ':', password);
            },

            set: function(userinfo) {
                return splitLast(userinfo, ':');
            }
        },

        filename: {
            parts: ['basename', 'suffix'],
            get: function(basename, suffix) {
                return join(basename, '.', suffix);
            },

            set: function(filename) {
                return splitLast(filename, '.');
            }
        },

        // abstraction level : 2
        hostname: {
            parts: ['subdomain', 'domain'],
            get: function(subdomain, domain) {
                return join(subdomain, '.', domain);
            },

            set: function(hostname) {
                return split(hostname, '.');
            }
        },

        pathname: {
            parts: ['dirname', 'filename'],
            get: function(dirname, filename) {
                return dirname ? (dirname + '/' + filename) : '';
            },

            set: function(pathname) {
                var segments = pathname.split('/');
                var length = segments.length;

                if (length === 0) {
                    return ['', ''];
                }
                if (length === 1) {
                    return ['', segments[0]];
                }
                return [segments.slice(0, -1).join('/'), segments[length - 1]];
            }
        },

        // abstraction level : 3
        host: {
            parts: ['hostname', 'port'],
            get: function(hostname, port) {
                return join(hostname, ':', port);
            },

            set: function(host) {
                return splitLast(host, ':');
            }
        },

        ressource: {
            parts: ['pathname', 'search', 'hash'],
            get: function(pathname, search, hash) {
                var ressource = '';

                if (pathname) {
                    ressource += pathname;
                }
                if (search) {
                    ressource += '?' + search;
                }
                if (hash) {
                    ressource += '#' + hash;
                }

                return ressource;
            },

            set: function(ressource) {
                var hashParts = splitLast(ressource, '#');
                var searchParts = splitLast(hashParts[0], '?');
                var hash = hashParts[1];
                var search = searchParts[1];
                var pathname = searchParts[0];

                return [pathname, search, hash];
            }
        },

        // abstraction level : 4
        authority: {
            parts: ['userinfo', 'host'],
            get: function(userinfo, host) {
                return join(userinfo, '@', host);
            },

            set: function(authority) {
                return split(authority, '@');
            }
        },

        // abstraction level : 5
        origin: {
            parts: ['protocol', 'authority'],
            get: function(protocol, authority) {
                // dependening on protocol we add // or not
                return protocol + '://' + authority;
            },

            set: function(origin) {
                var parts = split(origin, ':');
                // depending on protocol we remove // but here we auto remove //
                var authority = parts[1];
                if (authority.slice(0, 2) === '//') {
                    parts[1] = authority.slice(2);
                }
                return parts;
            }
        },

        // abstraction level : 6
        href: {
            parts: ['origin', 'ressource'],
            get: function(origin, ressource) {
                return join(origin, '/', ressource);
            },

            set: function(href) {
                var url = new URL(href);

                this.fromURL(url);

                return [this.origin, this.ressource];
            }
        }
    };

    Object.keys(abstractions).forEach(function(abstractionName) {
        var abstraction = abstractions[abstractionName];

        Object.defineProperty(URI.prototype, abstractionName, {
            configurable: true,
            // enumerable: false,

            get: function() {
                var args = abstraction.parts.map(function(partName) {
                    return this[partName];
                }, this);

                return abstraction.get.apply(abstraction, args);
            },

            set: function(value) {
                var partValues = abstraction.set(value);

                partValues.forEach(function(partValue, index) {
                    this[abstraction.parts[index]] = partValue;
                }, this);
            }
        });
    });

    Object.defineProperty(URI.prototype, 'search', {
        get: function() {
            return String(this.searchParams);
        },

        set: function(search) {
            this.searchParams = new URLSearchParams(search);
        }
    });

    URI.prototype.toString = function() {
        return this.href;
    };

    URI.prototype.resolve = function(data) {
        return new URI(data, this);
    };

    URI.prototype.commonPath = function(data) {
        var uri = new URI(data, this);

        // get commont path between uri, used to know if uri

        return uri;
    };

    URI.prototype.includes = function() {
        // search if the uri is the ancestor of the provided one
    };

    URI.prototype.relative = function(data) {
        var uri = new URI(data, this);

        if (this.origin !== uri.origin) {
            return uri.toString();
        }
        // faut retourner une nouvelle location qui soit relative donc, mettre à jour this path en fait

        // left to right, look for closest common path segment
        var fromSegments = this.pathname.split('/');
        var toSegments = uri.pathname.split('/');

        while (fromSegments[0] === toSegments[0]) {
            fromSegments.shift();
            toSegments.shift();
        }

        var length = fromSegments.length - toSegments.length;
        if (length > 0) {
            while (length--) {
                toSegments.unshift('..');
            }
        } else if (length === 0) {
            length = toSegments.length - 1;
            while (length--) {
                toSegments.unshift('..');
            }
        }

        return toSegments.join('/');
    };

    URI.prototype.fromURL = function(url) {
        this.protocol = url.protocol.slice(0, -1);
        this.host = url.host;
        this.username = url.username;
        this.password = url.password;
        this.pathname = url.pathname.slice(1);
        this.search = url.search.slice(1);
        this.hash = url.hash;
    };

    global.URI = URI;
})(typeof global === 'undefined' ? window : global);
