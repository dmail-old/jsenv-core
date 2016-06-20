// URITemplate
// RestAPI
// RestAPIRoute
// RestAPICall
// AuthorizationHandler

/*

api a plusieur route qui ont plusieurs méthode qui peut avoir UNE SEULE fonction associé avec par contre
des arguments variables

typiquement voici ce qu'on peut avoir

GET http://google.com
GET http://google.com?test=true

pour la même route deux méthode différente, ou alors c'est la même avec des params différent -> oui

chaque route doit hériter des uri, headers, params de l'api
chaque méthode hérite de la même manière de uri, headers, params

*/

import proto from 'env/proto';

import URITemplate from 'env/uri-template';

const RestAPI = proto.extend('RestAPI', {
    name: '',
    uri: null,

    constructor() {
        this.headers = {};
    },

    populate(data) {
        if ('uri' in data) {
            this.uri = URITemplate.create(data.uri);
        }
        if ('headers' in data) {
            Object.assign(this.headers, data.headers);
        }
    }
});

export default RestAPI;
