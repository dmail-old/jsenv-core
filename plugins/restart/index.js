import restart from './#{jsenv|platform.type}.js';

export function install(jsenv) {
    jsenv.provide(function provideRestart() {
        return {
            restart: restart
        };
    });
}
