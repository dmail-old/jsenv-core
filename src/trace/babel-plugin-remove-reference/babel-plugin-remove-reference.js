// https://astexplorer.net/
// https://github.com/babel/babel/blob/master/packages/babel-plugin-undeclared-variables-check/src/index.js#L19
// https://github.com/GavinJoyce/babel-plugin-remove-functions/blob/master/src/index.js

/*

- tester que les fonctions sont bien supprimées (comme variable et export en gros)

*/

function removeReference(names) {
    names = names.slice();

    function removeReferencePlugin() {
        function removeVariableDeclarator(path) {
            var variableDeclarator = path.node;
            var variableDeclarationPath = path.parentPath;
            var variableDeclaration = variableDeclarationPath.node;
            var declarations = variableDeclaration.declarations;
            var filteredDeclarations = declarations.filter(function(declarator) {
                return declarator !== variableDeclarator;
            });
            variableDeclaration.declarations = filteredDeclarations;

            if (filteredDeclarations.length === 0) {
                variableDeclarationPath.remove();
            }
        }
        function removeFunction(path) {
            path.remove();
        }
        function removeExportSpecifier(path) {
            var exportSpecifier = path.node;
            var namedExportPath = path.parentPath;
            var namedExport = namedExportPath.node;
            var specifiers = namedExport.specifiers;
            var filteredSpecifiers = specifiers.filter(function(specifier) {
                return specifier !== exportSpecifier;
            });
            namedExport.specifiers = filteredSpecifiers;

            if (filteredSpecifiers.length === 0) {
                namedExportPath.remove();
            }
        }
        function removeExportDefault(path) {
            // var node = path.node;
            // var declaration = node.declaration;
            // if (declaration) {
            //     console.log('the declaration', declaration);
            // }
            path.remove();
        }
        function removeExportNamed(path) {
            // var node = path.node;
            // var declaration = node.declaration;
            // if (declaration) {
            //     console.log('the declaration', declaration);
            // }
            path.remove();
        }
        function removeExportAndDeclaration(path) {
            path.remove();
        }
        function isExportDeclaration(path) {
            var node = path.node;
            if (node.type !== 'ExportNamedDeclaration' && node.type !== 'ExportDefaultDeclaration') {
                return false;
            }
            return Boolean(node.declaration);
        }
        function visitProgram(path) {
            var scope = path.scope;
            var globalBindings = scope.getAllBindings();
            Object.keys(globalBindings).forEach(function(name) {
                var binding = globalBindings[name];
                var identifier = binding.identifier;
                if (names.indexOf(identifier.name) > -1) {
                    var weakReferences = binding.referencePaths.filter(function(referencePath) {
                        if (isExportDeclaration(referencePath)) {
                            return true;
                        }
                        return (
                            referencePath.parentPath.node.type === 'ExportNamedDeclaration' ||
                            referencePath.parentPath.node.type === 'ExportDefaultDeclaration' ||
                            referencePath.parentPath.node.type === 'ExportSpecifier'
                        );
                    });
                    var strongReferences = binding.referencePaths.filter(function(referencePath) {
                        return weakReferences.indexOf(referencePath) === -1;
                    });
                    if (strongReferences.length === 0) {
                        weakReferences.forEach(function(referencePath) {
                            if (isExportDeclaration(referencePath)) {
                                removeExportAndDeclaration(referencePath);
                            } else {
                                var parentPath = referencePath.parentPath;
                                var parentNode = parentPath.node;
                                if (parentNode.type === 'ExportSpecifier') {
                                    removeExportSpecifier(parentPath);
                                } else if (parentNode.type === 'ExportDefaultDeclaration') {
                                    removeExportDefault(parentPath);
                                } else if (parentNode.type === 'ExportNamedDeclaration') {
                                    removeExportNamed(parentPath);
                                }
                            }
                        });

                        var bindingPath = binding.path;
                        var node = bindingPath.node;
                        if (node.type === 'VariableDeclarator') {
                            removeVariableDeclarator(bindingPath);
                        } else if (node.type === 'FunctionDeclaration') {
                            removeFunction(bindingPath);
                        }
                    } else {
                        console.log('preserve', identifier.name, 'because of', strongReferences.map(function(ref) {
                            return ref.node;
                        }));
                    }
                }
            });
        }

        return {
            visitor: {
                Program: visitProgram
            }
        };
    }
    return removeReferencePlugin;
}

module.exports = removeReference;
