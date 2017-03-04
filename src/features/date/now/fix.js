function now() {
    return new Date().getTime();
}

const fix = {
    type: 'inline',
    value() {
        Date.now = now;
    }
};

export default fix;
