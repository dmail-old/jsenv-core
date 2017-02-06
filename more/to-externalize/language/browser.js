/* eslint-env browser */

export default function() {
    if ('languages' in navigator) {
        return navigator.languages.join();
    }
    if ('language' in navigator) {
        return navigator.language;
    }
    if ('userLanguage' in navigator) {
        return navigator.userLanguage;
    }
    if ('browserLanguage' in navigator) {
        return navigator.browserLanguage;
    }
    return '';
}
