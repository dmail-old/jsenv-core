import fetchProtocols from './#{env|default.agent.type}.js';

function fetch(url) {
    url = new URL(url);
    let protocol = url.protocol.slice(0, -1);

    if (protocol in fetchProtocols) {
        return fetchProtocols[protocol](url.href);
    }
    throw new Error('cannot fetch from ' + url + ' (protocol must be one of : ' + Object.keys(fetchProtocols) + ')');
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
