export default function() {
    // https://github.com/sindresorhus/os-locale/blob/master/index.js
    if ('lang' in process.env) {
        return process.env.lang;
    }
    return '';
}
