import Rest from './src/rest.js';

function createRest(baseUrl) {
    return Rest.create(baseUrl);
}
export default createRest;
export {createRest};

export * from './helpers.js';

