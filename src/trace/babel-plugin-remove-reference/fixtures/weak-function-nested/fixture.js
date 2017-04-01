function weakAncestor() {}
function weak() {
    weakAncestor()
}
export function willBeRemoved() {
    weak()
}
