/*
scope : https://github.com/babel/babel/blob/8a82cc060ae0ab46bf52e05e592de770bd246f6f/packages/babel-traverse/src/scope/index.js
binding : https://github.com/babel/babel/blob/8a82cc060ae0ab46bf52e05e592de770bd246f6f/packages/babel-traverse/src/scope/binding.js

cette fonction doit être appelé avec comme premier arg un scope
et comme second arg les bindings qu'on veut remove dans ce scope

en gros le comportement sera que

- (a)on peut remove un binding que si ce binding n'a aucune référence ou que des référence weak
- (b)une référence est weak lorsqu'elle est elle même supprimé si le binding est supprimé (export default name)
- (c)un binding peut aussi être supprimé si une référence strong est considéré comme weak
parce qu'elle va elle même être supprimé ou n'a pas d'autre référence ou que les dites références sont weak

- il faut un comportement récursif
ça c'est "chaud", à voir au fur et à mesure

- export default b doit être considéré comme weak parce que
c'est supprimé en même temps que le binding
je vois pas d'autre référence weak pour le moment

function name() {} n'est pas une référence weak c'est juste la déclaration du binding
aucunement une référence vers celui-ci

- il faut pouvoir identifié comment le binding est utilisé pour être capable
de répondre à : est ce que ce qui l'utilise sera supprimé ?

const a = b; c'est a qui utilise b
(function (t = b)) c'est t qui utilise b
bref en gros être capable de trace qui utilise le binding
pour dire est ce que c'est lui même un binding qu'on va supprimé

*/

function traceBindingRemoval(scope, namesToTrace) {
    var bindings = scope.getAllBindings();
    for (let binding of bindings) {
        binding.dependents = binding.referencePaths.map(referencePath => {
            return referencePath.scope.getBinding(binding.identifier.name);
        });
    }
    const bindingsToRemove = [];
    const bindingWillBeRemoved = binding => {
        if (namesToTrace.indexOf(binding.identifier.name) > -1) {
            return true;
        }
        return false;
    };
    const dependentBindingWillBeRemoved = binding => {

    };
    for (let binding of bindings) {
        if (bindingWillBeRemoved(binding)) {
            if (binding.dependents.every(dependentBindingWillBeRemoved)) {
                bindingsToRemove.push(binding);
            }
        }
    }
}

module.exports = traceBindingRemoval;
