export function strong() {}
function weak() {}
function mixedStrongAndWeak() {
    weak()
    strong()
}
export function willBeRemoved() {
    mixedStrongAndWeak()
}
