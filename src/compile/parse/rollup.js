const rollup = require('rollup')
// const uneval = require('../../api/util/uneval.js')

// is usedByBundle
// https://github.com/rollup/rollup/blob/8466b4ce56415f27687842b3177138929efee62c/src/ast/nodes/shared/isUsedByBundle.js#L3

// https://github.com/rollup/rollup/blob/47e0f93a6eeab3f20e3c07c12b7c785b9427d81d/src/finalisers/es.js#L18

/*
ok en fait j'ai l'impression que tout ça fait doublon avec istanbul

https://github.com/istanbuljs/istanbuljs/tree/master/packages/istanbul-lib-instrument

quand je regarde rollup je vois qu'en gros il faut ce que fais istanbul
donc en gros on va utiliser le plugin qui instrumente le code instanbul
récupérer un coverage qui permettra de savoir par où on est passé (et ou on n'est pas)
et partout où on est pas passé c'est du code mort qu'on peut supprimer

comme ça pas de rollup, pas de truc custom et on prépare l'arrivée de instanbul

*/

rollup.rollup({
    entry: 'fixtures/basic/main.js'
}).then((result) => {
    const secondModule = result.bundle.modules[1]
    // const firstNode = secondModule.ast.body[0]
    // clone c'est la version original de l'ast
    // const firstClonedNode = secondModule.astClone.body[0]
    // console.log('firstNode', firstClonedNode.declaration

    // mais donc firstNode est enchanced

    /*
    en gros j'ai l'impression que rollup expose

    - declarations['*']
    pour lequel il faut faire .originals pour avoir les declarations et savoir si activated = true
    - declaration['default']
    à tester
    - declarations['anyvalididentifier']
    la on fait .activated = true

    gràce à ça on doit pouvoir savoir toutes les branches inutiles
    */

    console.log('secondModule declarations', secondModule.declarations['*'].originals)

    // console.log('export named variable declarator', firstNode.declaration.declarations[0])
}).catch((e) => {
    setTimeout(() => {
        throw e
    })
})
