function fetch(url) {
    var xhr = new XMLHttpRequest();

    var textPromise = new Promise(function(resolve, reject) {
        xhr.onerror = function(e) {
            reject(e);
        };

        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                resolve({
                    status: xhr.status,
                    text: xhr.responseText
                });
            }
        };

        xhr.open('GET', url);
        xhr.send();
    });

    return textPromise;
}

export default {
    http: fetch,
    https: fetch,
    file: function(url) {
        return fetch(url).then(function(response) {
            if (response.status === 0) {
                if (response.text) {
                    response.status = 200;
                } else {
                    response.status = 404;
                }
            }
            return response;
        });
    }
};
