// https://github.com/thejameskyle/the-super-tiny-compiler/blob/master/super-tiny-compiler.js

import proto from 'env/proto';

import Tokenizer from './tokenizer.js';
import Parser from './parser.js';
import Generator from './generator.js';

const Compiler = proto.extend('Compiler', {
    constructor() {
        this.parser = Parser.create();
        this.generator = Generator.create();
    },

    registerTokenizer(detectors) {
        this.tokenizer = Tokenizer.create(detectors);
    },

    registerParser(nodeName, nodeParser) {
        return this.parser.registerParser(nodeName, nodeParser);
    },

    registerNode(...args) {
        return this.generator.registerNode(...args);
    },

    tokenize(input) {
        return this.tokenizer.tokenize(input);
    },

    parse(tokens) {
        return this.parser.parse(tokens);
    },

    transform(ast) {
        return ast;
    },

    generate(ast) {
        // throw new Error('unexpected node.name');
        return this.generator.generate(ast);
    },

    compile(input) {
        var tokens = this.tokenize(input);
        var ast = this.parse(tokens);
        var transformedAst = this.transform(ast);
        var generationResult = this.generate(transformedAst);

        return generationResult;
    }
});

export default Compiler;
