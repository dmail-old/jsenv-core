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

function URI(data, base) {
    if (data instanceof URI) {
        return data;
    }
    var url = new URL(data, base);
    this.fromURL(url);
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
    search: null,
    hash: null
};

Object.keys(properties).forEach(function(propertyName) {
    URI.prototype[propertyName] = properties[propertyName];
});

function splitLastIndexOf(source, motif) {
    var motifIndex = source.lastIndexOf(motif);
    if (motifIndex > -1) {
        return [source.slice(0, motifIndex), source.slice(motifIndex + motif.length)];
    }
    return [source, ''];
}

function splitIndexOf(source, motif) {
    var motifIndex = source.indexOf(motif);
    if (motifIndex > -1) {
        return [source.slice(0, motifIndex), source.slice(motifIndex + motif.length)];
    }
    return ['', source];
}

var abstractions = {
    // abstraction level : 1
    domain: {
        parts: ['domainname', 'tld'],
        get: function(domainname, tld) {
            var domain = '';

            domain += domainname;
            domain += '.' + tld;

            return domain;
        },

        set: function(domain) {
            return splitLastIndexOf(domain, '.');
        }
    },

    userinfo: {
        parts: ['username', 'password'],
        get: function(username, password) {
            var userinfo = '';

            if (username) {
                userinfo += username;
                if (password) {
                    userinfo += ':' + password;
                }
            }

            return userinfo;
        },

        set: function(userinfo) {
            return splitLastIndexOf(userinfo, ':');
        }
    },

    filename: {
        parts: ['basename', 'suffix'],
        get: function(basename, suffix) {
            var filename = '';

            if (basename) {
                filename += basename;
            }
            if (suffix) {
                filename += '.' + suffix;
            }

            return filename;
        },

        set: function(filename) {
            return splitLastIndexOf(filename, '.');
        }
    },

    // abstraction level : 2
    hostname: {
        parts: ['subdomain', 'domain'],
        get: function(subdomain, domain) {
            var hostname = '';

            if (subdomain) {
                hostname += subdomain + '.';
            }
            hostname += domain;

            return hostname;
        },

        set: function(hostname) {
            return splitIndexOf(hostname, '.');
        }
    },

    pathname: {
        parts: ['dirname', 'filename'],
        get: function(dirname, filename) {
            var pathname = '';

            if (dirname) {
                pathname += dirname;
            }
            if (filename) {
                if (dirname) {
                    pathname += '/';
                }
                pathname += filename;
            }

            return pathname;
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
            var host = '';

            host += hostname;
            if (port) {
                host += ':' + port;
            }

            return host;
        },

        set: function(host) {
            return splitLastIndexOf(host, ':');
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

        set: function() {
            var pathname = '';
            var search = '';
            var hash = '';

            // it's a bit mroe complicated than others

            return [pathname, search, hash];

            /*
            var questionCharIndex = ressource.indexOf('?');
            if (questionCharIndex > -1) {
                search = ressource.slice(questionCharIndex);
            }
            var dieseCharIndex = ressource.indexOf('#');
            if (dieseCharIndex > -1) {
                hash = ressource.slice(dieseCharIndex);
            }
            */
        }
    },

    // abstraction level : 4
    authority: {
        parts: ['userinfo', 'host'],
        get: function(userinfo, host) {
            var authority = '';

            if (userinfo) {
                authority += userinfo + '@';
            }
            authority += host;

            return authority;
        },

        set: function(authority) {
            return splitIndexOf(authority, '@');
        }
    },

    // abstraction level : 5
    origin: {
        parts: ['protocol', 'authority'],
        get: function(protocol, authority) {
            var origin = '';

            if (protocol) {
                origin += protocol + '://';
            }
            if (authority) {
                origin += authority;
            }

            return origin;
        },

        set: function(origin) {
            return origin.indexOf('://') > -1 ? splitIndexOf('://') : splitIndexOf(':');
        }
    },

    // abstraction level : 6
    href: {
        parts: ['origin', 'ressource'],
        get: function(origin, ressource) {
            var href = '';

            href += origin;
            if (ressource) {
                href += '/' + ressource;
            }

            return href;
        },

        set: function(href) {
            var url = new URL(href);

            this.fromURL(url);
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

URI.prototype.toString = function() {
    return this.href;
};

URI.prototype.resolve = function(data) {
    return new URI(data, this);
};

URI.prototype.relative = function(data) {
    var uri = new URI(data, this);

    if (this.origin !== uri.origin) {
        return uri.toString();
    }
    // faut retourner une nouvelle location qui soit relative donc, mettre à jour this path en fait

    // left to right, look for closest common path segment
    var fromSegments = this.pathname.slice(1).split('/');
    var toSegments = uri.pathname.slice(1).split('/');

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
    console.log('from URL', url);

    this.protocol = url.protocol.slice(0, -1);
    this.host = url.host;
    this.username = url.username;
    this.password = url.password;
    this.pathname = url.pathname.slice(1);
    this.search = url.search.slice(1);
    this.hash = url.hash;
};
