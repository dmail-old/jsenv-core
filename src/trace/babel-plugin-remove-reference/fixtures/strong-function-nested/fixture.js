export function strong() {}
function strongChild() {
    strong()
}
export function willBeRemoved() {
    strongChild()
}