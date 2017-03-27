// https://astexplorer.net/
// https://github.com/babel/babel/blob/master/packages/babel-plugin-undeclared-variables-check/src/index.js#L19

/*
- faudras tester iife non sont pas supprimé
*/

function removeReference(identifiers) {
    identifiers = identifiers.slice();

    function removeReferencePlugin() {
        function identifierMustBeRemoved(identifier, path) {
            // must be toplevel
            var parentNode = path.parentPath.node;
            if (
                parentNode.type === 'ExportDefaultDeclaration' ||
                parentNode.type === 'ExportNamedDeclaration'
            ) {
                parentNode = path.parentPath.parentPath.node;
            }
            if (parentNode.type !== 'Program') {
                console.log('remove only top level', identifier.name);
                return false;
            }
            // il faudrait aussi check qu'il n'y a aucune référence en internal dans le fichier
            // pas seulement qu'on demande à le supprimer
            if (identifiers.indexOf(identifier.name) > -1) {
                console.log('remove because asked', identifier.name);
                return true;
            }
            var bindings = path.scope.getAllBindings(identifier.name);
            if (bindings) {
                var referenceNames = Object.keys(bindings);
                if (referenceNames.length === 0) {
                    console.log('remove because no reference to', identifier.name);
                    return true;
                }
                var everyReferencesMustBeRemoved = Object.keys(bindings).every(function(name) {
                    var binding = bindings[name];
                    // console.log('the binding', binding.identifier.name, binding.path.node);
                    var referenceIdentifier = binding.identifier;
                    // var referencePath = binding.path;
                    console.log('check reference', binding.path.node);

                    // si c'est à supprimer on le fait
                    if (identifiers.indexOf(referenceIdentifier.name) > -1) {
                        return true;
                    }
                    return false;
                });
                return everyReferencesMustBeRemoved;
            }
            console.log('no bindings');
            return false;
        }
        function visitIdentifier() {
            // var node = path.node;
            // var scope = path.scope;
            // var binding = scope.getBinding(node.name);
            // console.log('the references for', node.name, scope.references);//  binding ? binding.references : 0);
        }
        function visitVariable(path) {
            var node = path.node;
            node.declarations = node.declarations.filter(function(declaration) {
                return identifierMustBeRemoved(declaration.id, path) === false;
            });
            if (node.declarations.length === 0) {
                if (
                    path.parentPath.type === 'ExportNamedDeclaration' ||
                    path.parentPath.type === 'ExportDefaultDeclaration'
                ) {
                    path.parentPath.remove();
                } else {
                    path.remove();
                }
            }
        }
        function visitFunction(path) {
            var node = path.node;
            if (identifierMustBeRemoved(node.id, path)) {
                if (
                    path.parentPath.node.type === 'ExportNamedDeclaration' ||
                    path.parentPath.node.type === 'ExportDefaultDeclaration'
                ) {
                    path.parentPath.remove();
                } else {
                    path.remove();
                }
            }
        }
        function visitExportNamed(path) {
            var node = path.node;
            var declaration = node.declaration;
            if (declaration) {
                // will be handled by function/variable
            } else {
                node.specifiers = node.specifiers.filter(function(specifier) {
                    return identifierMustBeRemoved(specifier.local, path) === false;
                });
                if (node.specifiers.length === 0) {
                    if (
                        path.parentPath.type === 'ExportNamedDeclaration' ||
                        path.parentPath.type === 'ExportDefaultDeclaration'
                    ) {
                        path.parentPath.remove();
                    } else {
                        path.remove();
                    }
                }
            }
        }
        function visitExportDefault(path) {
            var node = path.node;
            var declaration = node.declaration;
            if (declaration) {
                console.log('ignore declaration');
            } else if (identifierMustBeRemoved(node.declaration.name)) {
                path.remove();
            }
        }

        return {
            visitor: {
                Identifier: visitIdentifier,
                FunctionDeclaration: visitFunction,
                VariableDeclaration: visitVariable,
                ExportNamedDeclaration: visitExportNamed,
                ExportDefaultDeclaration: visitExportDefault
            }
        };
    }
    return removeReferencePlugin;
}

var fs = require('fs');
var assert = require('assert');
function test(name, names) {
    var fixture = String(fs.readFileSync('./fixtures/' + name + '/fixture.js'));
    var expected = String(fs.readFileSync('./fixtures/' + name + '/expected.js'));
    var babel = require('babel-core');
    var result = babel.transform(fixture, {
        plugins: [
            removeReference(names)
        ]
    });
    var actual = result.code;

    assert.equal(actual, expected);
}

test('remove-reference/export-default', ['foo']);
// test('remove-reference/scope', ['bar']);
// test('remove-reference/live', ['count']);
