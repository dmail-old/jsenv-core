import fetchProtocols from './#{jsenv|default.agent.type}.js';

function fetch(url) {
    let protocol = url.protocol.slice(1);

    if (protocol in fetchProtocols) {
        return fetchProtocols[protocol](url);
    }
    throw new Error('cannot fetch from' + url + '(protocol must be one of : ' + Object.keys(fetchProtocols) + ')');
}

function fetchAsText(url) {
    return fetch(url).then(function(response) {
        if (response.status < 200 || response.status > 299) {
            throw response.status;
        }
        return response.text;
    });
}

export default fetchAsText;
