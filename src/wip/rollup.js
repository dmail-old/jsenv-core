/*

rollup parse es6 using acorn which is used by babel
the resulting ast differs a bit from babel because of subtil differences

anyway rollup is altering source files assuming you bundle once for all
but for my use case (dynamic import and reusing already bundled module)
you may later reference the dead import and it would be hard to get all this working
because we alter the module source

so dead code removal is not really interesting however I may want to get the rolup behaviour
concerning the analysis of the module tree to throw on undefined export or strange cyclic import

*/

let ressourcePromise
const rollup = require('rollup')
ressourcePromise = rollup.rollup({
    entry: 'fixtures/basic/main.js'
}).then((result) => {
    return result.bundle.modules[1]

    // console.log('module declarations', result.bundle.modules[1].declarations['*'].originals)
})
// const babel = require('babel-core')
// ressourcePromise = Promise.resolve().then(() => {
//     const code = require('fs').readFileSync('./fixtures/basic/file.js')
//     const result = babel.transform(code)
//     return {
//         ast: result.ast,
//         code: code
//     }
// })

const generate = require('babel-generator').default
ressourcePromise.then((ressource) => {
    // console.log('the module', rollupModule)
    const ast = ressource.ast
    console.log('ast', ast.body)
    const generated = generate(ast)

    console.log('resulting in', generated.code)
}).catch((e) => {
    setTimeout(() => {
        throw e
    })
})
