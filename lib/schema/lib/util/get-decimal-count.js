function getDecimalCount(number) {
    let numberString = String(number);
    let dotIndex = numberString.indexOf('.');

    if (dotIndex === -1) {
        return 0;
    }
    return numberString.slice(dotIndex + 1).length;
}

export default getDecimalCount;
