import StringTemplate from './string-template.js';
// import tokenize from './tokenize.js';
// import parse from './parse.js';

function compile(input) {
    var stringTemplate = StringTemplate.create();

    console.log(input);
    // do something with input to populate the stringTemplate object

    return stringTemplate;
}

export default compile;
