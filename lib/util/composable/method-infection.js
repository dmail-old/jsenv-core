const MethodInfection = {
    methodName: '',

    create(methodName) {
        const namedMethodInfection = Object.create(this);
        namedMethodInfection.methodName = methodName;
        return namedMethodInfection;
    },

    infect(object, infectedMethod) {
        const methodName = this.methodName;
        let infectedMethodCallState = '';
        function propagatedInfectedMethod(...args) {
            if (infectedMethodCallState === 'before') {
                throw new Error('infected method must not be called recursively');
            }
            infectedMethodCallState = 'before';
            const returnedObject = infectedMethod.apply(this, args);
            infectedMethodCallState = 'after';

            if (Object.getPrototypeOf(returnedObject) !== Object.getPrototypeOf(object)) {
                throw new TypeError('infected method must return object sharing prototype');
            }
            // propagate the infected compose method
            returnedObject[methodName] = propagatedInfectedMethod;

            return returnedObject;
        }

        if (methodName in object) {
            const uninfected = object[methodName];
            if (infectedMethod === uninfected) {
                throw new Error('infected method must be different than the current method');
            }

            if ('pure' in uninfected) {
                propagatedInfectedMethod.pure = uninfected.pure;
            } else {
                propagatedInfectedMethod.pure = uninfected;
            }
            propagatedInfectedMethod.uninfected = uninfected;
        }
        propagatedInfectedMethod.infected = infectedMethod;

        const infectedObject = object.clone();
        infectedObject[methodName] = propagatedInfectedMethod;

        return infectedObject;
    },

    cure(object) {
        const methodName = this.methodName;
        let curedObject;

        if (methodName in object) {
            const methodSupposedAsInfected = object[methodName];

            if ('infected' in methodSupposedAsInfected) {
                const uninfected = methodSupposedAsInfected.uninfected;
                if (uninfected) {
                    curedObject = object.clone();
                    curedObject[methodName] = uninfected;
                    // MethodInfection.infect(object, methodName, uninfected);
                } else {
                    // restore the object previous state : he had not method at all
                    curedObject = object.clone();
                    delete curedObject[methodName];
                }
            } else {
                // the method is not infected ?
                curedObject = object;
            }
        } else {
            // should we do throw because methodName is not in object and it's unexpected ?
            curedObject = object;
        }

        return curedObject;
    },

    purify(object) {
        const methodName = this.methodName;
        let pureObject;

        if (methodName in object) {
            const methodSupposedAsInfected = object[methodName];

            if ('infected' in methodSupposedAsInfected) {
                pureObject = object.clone();
                const pure = methodSupposedAsInfected.pure;
                if (pure) {
                    pureObject[methodName] = pure;
                } else {
                    delete pureObject[methodName];
                }
            } else {
                pureObject = object;
            }
        } else {
            pureObject = object;
        }

        return pureObject;
    }
};

export default MethodInfection;
