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

export default fetch;
