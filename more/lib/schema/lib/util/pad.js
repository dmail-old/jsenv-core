function pad(string, size, motif, direction) {
    size = size || 0;
    motif = motif || ' ';
    direction = direction || 'both';

    let length = string.length;

    if (size + 1 >= length) {
        if (direction === 'left') {
            string = motif.repeat(size + 1 - length) + string;
        } else if (direction === 'right') {
            string += motif.repeat(size + 1 - length);
        } else {
            let motifCount = size - length;
            let right = Math.ceil(motifCount / 2);
            let left = motifCount - right;
            string = motif.repeat(left + 1) + string + motif.repeat(right + 1);
        }
    }

    return string;
}

export default pad;
