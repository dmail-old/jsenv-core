import Server from './server.js';

function createServer(requestHandler) {
    return Server.create(requestHandler);
}
export default createServer;
export {createServer};
