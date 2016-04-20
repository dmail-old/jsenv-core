/* eslint-env browser */
import jsenv from 'jsenv';

jsenv.provide(function populatePlatform() {
    jsenv.platform.setName(window.navigator.platform);
});
