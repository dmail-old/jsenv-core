const fix = {
    type: 'corejs',
    beforeFix: 'delete Promise;', // to be sure corejs override when we need it
    value: 'es6.promise'
};

export default fix;
