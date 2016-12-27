import require from '@node/require';

export default function() {
    return new Promise(function(resolve, reject) {
        require('os-locale')(function(error, locale) {
            if (error) {
                reject(error);
            } else {
                resolve(locale);
            }
        });
    });
}
