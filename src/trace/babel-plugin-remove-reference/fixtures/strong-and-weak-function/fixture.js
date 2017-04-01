export function strong() {}
function strongChild() {
    strong()
}
function weakAncestor() {}
function weak() {
    weakAncestor()
}
export function otherStrong() {}
function otherWeak() {}
export function willBeRemoved() {
    strongChild()
    weak()
    otherStrong()
    otherWeak()
}
