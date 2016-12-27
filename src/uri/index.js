/* global URLSearchParams */
/* eslint-env browser, node */

/*
// more universal way to manipulate urls because there is browser inconsistency
// for instance urlSearchParams and some data are missing like dirname, etc

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

compare

if (firstURI.protocol !== secondURI.protocol ) {
    return 1;
}

toNumber: function(){
        var score = 0;

        if( this.protocol ){
            score+= 1;
        }
        if( this.hostname ){
            score+= 2;
        }
        if( this.port ){
            score+= 4;
        }
        if( this.pathname ){
            score+= 8;
        }
        if( this.dirname ){
            score+= 16;
        }
        if( this.extname ){
            score+= 32;
        }

        return score;
    },
*/

import '../polyfill/url-search-params/index.js#?env|default.needs.url-search-params';

import env from 'env';
import proto from 'env/proto';

function mustAppendSlashesForProtocol(protocol) {
    return protocol === 'http' || protocol === 'https' || protocol === 'file';
}

let URI = proto.extend('URI', {
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
    hash: null,

    constructor(data, base) {
        if (data === null || data === undefined) {
            throw new TypeError(data + ' is not a valid uri');
        }
        if (URI.isPrototypeOf(data)) {
            return data;
        }

        if (typeof data === 'string') {
            data = env.cleanPath(data);
        }
        if (typeof base === 'string') {
            base = env.cleanPath(base);
        }

        var url = new URL(data, base);
        this.fromURL(url);
        this.url = url;
    },

    clone() {
        var uri = Object.create(URI);

        Object.assign(uri, this);

        return uri;
    },

    get search() {
        return String(this.searchParams);
    },

    set search(search) {
        this.searchParams = new URLSearchParams(search);
    },

    toString() {
        return this.href;
    },

    resolve(data) {
        return URI.create(data, this);
    },

    equals(uri) {
        return this.href === uri.href;
    },

    fromURL(url) {
        this.protocol = url.protocol.slice(0, -1);
        this.host = url.host;
        this.username = url.username;
        this.password = url.password;
        this.pathname = url.pathname[0] === '/' ? url.pathname.slice(1) : url.pathname;
        this.search = url.search.slice(1);
        this.hash = url.hash.slice(1);
    },

    toURL() {
        return new URL(this.href);
    }
});

// helpers properties
(function() {
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
            get(domainname, tld) {
                return join(domainname, '.', tld);
            },

            set(domain) {
                return splitLast(domain, '.');
            }
        },

        userinfo: {
            parts: ['username', 'password'],
            get(username, password) {
                return join(username, ':', password);
            },

            set(userinfo) {
                return splitLast(userinfo, ':');
            }
        },

        filename: {
            parts: ['basename', 'suffix'],
            get(basename, suffix) {
                return join(basename, '.', suffix);
            },

            set(filename) {
                return splitLast(filename, '.');
            }
        },

        // abstraction level : 2
        hostname: {
            parts: ['subdomain', 'domain'],
            get(subdomain, domain) {
                return join(subdomain, '.', domain);
            },

            set(hostname) {
                return split(hostname, '.');
            }
        },

        pathname: {
            parts: ['dirname', 'filename'],
            get(dirname, filename) {
                return dirname ? (dirname + '/' + filename) : '';
            },

            set(pathname) {
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
            get(hostname, port) {
                return join(hostname, ':', port);
            },

            set(host) {
                return splitLast(host, ':');
            }
        },

        ressource: {
            parts: ['pathname', 'search', 'hash'],
            get(pathname, search, hash) {
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

            set(ressource) {
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
            get(userinfo, host) {
                return join(userinfo, '@', host);
            },

            set(authority) {
                return split(authority, '@');
            }
        },

        // abstraction level : 5
        origin: {
            parts: ['protocol', 'authority'],
            get(protocol, authority) {
                // dependening on protocol we add // or not
                let origin = '';
                if (protocol) {
                    origin += protocol;
                    origin += ':';
                    if (mustAppendSlashesForProtocol(protocol)) {
                        origin += '//';
                    }
                }
                if (authority) {
                    origin += authority;
                }
                return origin;
            },

            set(origin) {
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
            get(origin, ressource) {
                if (mustAppendSlashesForProtocol(this.protocol)) {
                    return join(origin, '/', ressource);
                }
                return join(origin, '', ressource);
            },

            set(href) {
                var url = new URL(href);

                this.fromURL(url);

                return [this.origin, this.ressource];
            }
        }
    };

    Object.keys(abstractions).forEach(function(abstractionName) {
        var abstraction = abstractions[abstractionName];

        Object.defineProperty(URI, abstractionName, {
            configurable: true,
            enumerable: false,

            get() {
                var args = abstraction.parts.map(function(partName) {
                    return this[partName];
                }, this);

                return abstraction.get.apply(this, args);
            },

            set(value) {
                var partValues = abstraction.set(value);

                partValues.forEach(function(partValue, index) {
                    this[abstraction.parts[index]] = partValue;
                }, this);
            }
        });
    });
})();

// helper methods
URI.define({
    commonPath(data) {
        var uri = URI.create(data, this);

        var index = uri.pathname.indexOf(this.pathname);
        if (index === -1) {
            return '';
        }
        return uri.pathname.slice(0, index);
    },

    includes(data) {
        var uri = URI.create(data, this);

        if (this.origin !== uri.origin) {
            return false;
        }

        // console.log(this, 'includes', uri);

        return uri.dirname.startsWith(this.dirname);
    },

    relative(data) {
        var uri = URI.create(data, this);

        if (this.origin !== uri.origin) {
            return uri.toString();
        }

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
    }
});

// var absURLRegEx = /^[^:\/?#]+:/;
// function isAbsoluteURL(name) {
//     if (name[0] === '/') {
//         return false;
//     }
//     if (name.length === 1) {
//         return false;
//     }

//     if (name[0] === '.' && (name[1] === '/' || name[1] === '.')) {
//         return false;
//     }

//     return absURLRegEx.test(name);
// }

export default URI;
