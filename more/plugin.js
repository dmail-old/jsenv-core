export default {
    name: 'plugin',
    dependencies: [], // plugin qu'on doit installer avant celui là
    defaultOptions: {},
    install(options) {
        console.log('installing default plugin with options', options);
    }
};
