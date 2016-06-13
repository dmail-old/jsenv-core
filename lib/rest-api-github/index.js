// this is github api, the service related to it is specific to system.fetch but
// is maybe not even needed we may be able to call githupApi.getFile(load.address);
// if load.address can be resolved relatively so that fetch hook can recognize that the file must be fetched
// from github

import rest from 'env/rest';
import httpService from 'env/service-http';

import replace from './lib/replace.js';
import Base64 from './lib/base64.js';

function parseGithubURI(uri) {
    var pathname = uri.pathname;
    var parts = pathname.split('/');

    var user = parts[1];
    var repo = parts[2];
    var path = parts.slice(3);
    var branch = uri.searchParams.get('ref');

    if (!branch) {
        branch = 'master';
    }

    return {
        user: user,
        repo: repo,
        branch: branch,
        path: path
    };
}

function fetchHttpRequest(request) {
    return httpService.transport(request);
}

let githubFileService = rest.createService({
    name: 'service-github',
    tokens: {}, // tokens to be authentified when requesting github (private repo or post method for instance)

    /*
    live example
    var giturl = 'https://api.github.com/repos/dmail/argv/contents/index.js?ref=master';
    var xhr = new XMLHttpRequest();
    //var date = new Date();
    //date.setMonth(0);

    xhr.open('GET', giturl);
    xhr.setRequestHeader('accept', 'application/vnd.github.v3.raw');
    //xhr.setRequestHeader('if-modified-since', date.toUTCString());
    xhr.send(null);
    */
    get(request) {
        var data = parseGithubURI(request.uri);
        var gituri = replace('https://api.github.com/repos/{user}/{repo}/contents/{path}?ref={branch}', data);

        // request.method = 'GET';
        request.uri = rest.createURI(gituri);
        if (request.headers.has('authorization') === false && data.user in this.tokens) {
            request.headers.set('authorization', 'token ' + this.tokens[data.user]);
        }
        if (request.headers.has('accept') === false) {
            request.headers.set('accept', 'application/vnd.github.v3.raw');
        }
        // 'user-agent': 'jsenv' // https://developer.github.com/changes/2013-04-24-user-agent-required/

        return fetchHttpRequest(request);
    },

    /*
    live example (only to create, updating need the SHA, this you should use a PUT request
    author & committer are optional
    var giturl = 'https://api.github.com/repos/dmail/argv/contents/test.js';
    var xhr = new XMLHttpRequest();

    xhr.open('PUT', giturl);
    xhr.setRequestHeader('Authorization', 'token 0b6d30a35dd7eac332909186379673b56e1f03c2');
    xhr.setRequestHeader('content-type', 'application/json');
    xhr.send(JSON.stringify({
        message: 'create test.js',
        content: btoa('Hello world'),
        branch: 'master'
    }));
    */
    post(request) {
        var data = parseGithubURI(request.uri);
        var gituri = replace('https://api.github.com/repos/{user}/{repo}/contents/{path}', data);
        var method = 'PUT';
        var uri = rest.createURI(gituri);
        var body = rest.createBody();

        request.body.readAsString().then(function(text) {
            body.write(JSON.stringify({
                message: 'update ' + uri.pathname,
                content: Base64.encode(text)
            }));
            body.close();
        }, body.error);

        request.method = method;
        request.uri = uri;
        request.headers.set('content-type', 'application/json');
        // transform the body
        request.body = body;

        return this.fetchHttpRequest(request);
    },

    match(request) {
        return request.uri.protocol === 'github';
    },

    methods: {
        get(request) {
            return this.get(request);
        },

        post(request) {
            return this.post(request);
        }
    }
});

export default githubFileService;
