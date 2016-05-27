import fetch from './#{jsenv|default.agent.type}.js';

function fetchAsText(url) {
    return fetch(url).then(function(response) {
        if (response.status < 200 || response.status > 299) {
            throw response.status;
        }
        return response.text;
    });
}

export default fetchAsText;
