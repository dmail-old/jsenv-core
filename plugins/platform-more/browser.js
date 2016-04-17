/* eslint-env browser */

export function install(jsenv) {
    jsenv.config(function populatePlatform() {
        jsenv.platform.setName(window.navigator.platform);
    });
}
