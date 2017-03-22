var sys = require('systemjs');

sys.config({
    baseURL: 'http://google.fr/folder'
});

console.log(sys.resolveSync('dir/file.js'));
