import {foo as bar} from './file.js'

export function foo() {
    bar()
}

export {bar}
