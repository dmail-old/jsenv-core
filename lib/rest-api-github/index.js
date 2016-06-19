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

let githubAPI = rest.createAPI('github', {
    uri: 'https://api.github.com',
    headers: {
        // https://developer.github.com/v3/repos/contents/#custom-media-types
        accept: {
            default: 'application/vnd.github.v3.raw'
        }
    }
});

githubAPI.useAuthorizationHandler();
githubAPI.authorizationHandler.tokens = {};
githubAPI.authorizationHandler.getToken = function(apiCall) {
    var user = apiCall.params.user;
    if (user in this.tokens) {
        return this.tokens[user];
    }
};

var contentRoute = githubAPI.route({
    documentation: 'https://developer.github.com/v3/repos/contents',
    uri: 'repos/{user}/{repo}/contents/{path}',
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
    }
});

// var giturl = 'https://api.github.com/repos/dmail/argv/contents/index.js?ref=master';
// var xhr = new XMLHttpRequest();
// // var date = new Date();
// // date.setMonth(0);
// xhr.open('GET', giturl);
// xhr.setRequestHeader('accept', 'application/vnd.github.v3.raw');
// // xhr.setRequestHeader('if-modified-since', date.toUTCString());
// xhr.send(null);
contentRoute.get({
    documentation: 'https://developer.github.com/v3/repos/contents/#get-contents',
    methodName: 'getFile',
    params: {
        ref: {
            type: 'string',
            default: 'master'
        }
    }
});

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
contentRoute.put({
    documentation: 'https://developer.github.com/v3/repos/contents/#update-a-file',
    methodName: 'updateFile',
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
});

// let githubFileService = rest.createService({
//     name: 'service-github',
//     tokens: {},

//     match(request) {
//         return request.uri.protocol === 'github';
//     },

//     methods: {
//         get(request) {
//             return this.get(request);
//         },

//         post(request) {
//             return this.post(request);
//         }
//     }
// });

export default githubAPI;
