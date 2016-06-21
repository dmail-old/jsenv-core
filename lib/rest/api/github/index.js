// resolve this :
// this is github api, the service related to it is specific to system.fetch but
// is maybe not even needed we may be able to call githupApi.getFile(load.address);
// if load.address can be resolved relatively so that fetch hook can recognize that the file must be fetched
// from github

// then do :

import rest from 'env/rest';
// import Base64 from './lib/base64.js';
// import httpService from 'env/service-http';

// import replace from './lib/replace.js';

// function parseGithubURI(uri) {
//     var pathname = uri.pathname;
//     var parts = pathname.split('/');

//     var user = parts[1];
//     var repo = parts[2];
//     var path = parts.slice(3);
//     var branch = uri.searchParams.get('ref');

//     if (!branch) {
//         branch = 'master';
//     }

//     return {
//         user: user,
//         repo: repo,
//         branch: branch,
//         path: path
//     };
// }

let githubAPI = rest.createAPI('https://api.github.com', {
    services: {
        'header-manage-authorization': {
            tokens: {},

            prepare(request) {
                if (request.headers.has('authorization') === false) {
                    var requestUser = 'dmail'; // get it from the request object

                    if (requestUser in this.tokens) {
                        var authorizationheaderValue = 'token ' + this.tokens[requestUser];

                        request.headers.set('authorization', authorizationheaderValue);
                    }
                }
            }
        }
    },
    headers: {
        // https://developer.github.com/v3/repos/contents/#custom-media-types
        accept: {
            default: 'application/vnd.github.v3.raw'
        }
    }
});

githubAPI.route('repos/{user}/{repo}/contents/{path}', {
    documentation: 'https://developer.github.com/v3/repos/contents',
    services: {
        'header-manage-authorization': true
    },
    params: {
        user: {
            required: true,
            type: 'string'
        },
        repo: {
            required: true,
            type: 'string'
        },
        path: {
            required: true,
            type: 'string'
        }
    },
    methods: {
        get: {
            // var giturl = 'https://api.github.com/repos/dmail/argv/contents/index.js?ref=master';
            // var xhr = new XMLHttpRequest();
            // // var date = new Date();
            // // date.setMonth(0);
            // xhr.open('GET', giturl);
            // xhr.setRequestHeader('accept', 'application/vnd.github.v3.raw');
            // // xhr.setRequestHeader('if-modified-since', date.toUTCString());
            // xhr.send(null);
            documentation: 'https://developer.github.com/v3/repos/contents/#get-contents',
            params: {
                ref: {
                    type: 'string',
                    default: 'master'
                }
            }
        },

        put: {
            // live example (only to create, updating need the SHA, this you should use a PUT request
            // // author & committer are optional
            // var giturl = 'https://api.github.com/repos/dmail/argv/contents/test.js';
            // var xhr = new XMLHttpRequest();

            // xhr.open('PUT', giturl);
            // xhr.setRequestHeader('Authorization', 'token 0b6d30a35dd7eac332909186379673b56e1f03c2');
            // xhr.setRequestHeader('content-type', 'application/json');
            // xhr.send(JSON.stringify({
            //     message: 'create test.js',
            //     content: btoa('Hello world'),
            //     branch: 'master'
            // }));
            documentation: 'https://developer.github.com/v3/repos/contents/#update-a-file',
            // thoose params are added to the body because mehtod is put
            params: {
                message: {
                    required: true,
                    type: 'string'
                },
                content: {
                    required: true,
                    type: 'string',
                    format: 'base64'
                }
            }
            // not needed because default type is json
            // body: {
            //     type: 'json', // it means doing contentRoute.put({user: 'damil', repo: 'argv', path: 'index.js', message: 'udate', content: 'hello'})
            //     // will automatically create a body with message & content params & put content-type to application/json

            //     transform() {
            //         // I can do the base64 encoding in the transform method responsible to transform body into the right format
            //         // however having a format: 'base64' into the params signature is more convenient
            //     }
            // },
        }
    }
});

export default githubAPI;
