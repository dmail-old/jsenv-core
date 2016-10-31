export const test = {
    modules: ['@node/assert'],

    main() {
        /*
        // this.skip();
        var callId = 0;
        function spy(fn) {
            let lastCall = {
                called: false
            };
            function spyFn() {
                lastCall.this = this;
                lastCall.args = arguments;
                lastCall.id = callId;
                lastCall.called = true;
                callId++;

                if (fn) {
                    lastCall.return = fn.apply(this, arguments);
                    return lastCall.return;
                }
            }
            spyFn.lastCall = lastCall;
            return spyFn;
        }

        this.add('get unit as an object using expose', function() {
            const unit = compose({
                method() {}
            });
            const exposed = unit.expose();
            assert(exposed.method === unit.get('method'));
        });

        this.add('augment existing object using install/uninstall', function() {
            const unit = compose({
                method() {}
            });
            const installTarget = {};
            const installer = unit.install(installTarget);
            assert(installTarget.method === unit.get('method'));
            // ensure you can install from existing object
            installer.uninstall();
            assert(Object.keys(installTarget).length === 0);
        });

        this.add('custom composition implementation using infect()/cure()/purify()', function() {
            // https://medium.com/@koresar/fun-with-stamps-episode-8-tracking-and-overriding-composition-573aa85ba622#.fyv8m2wlj
            // infect() must do infectedCompose.returnValue.compose = infectedCompose (see below)
            // const infectedCompose = function(unitToCompose) {
            //     const composed = compose(this, unitToCompose);
            //     // infect the returned composed unit to also use the infected compose
            //     composed.compose = infectedCompose;
            //     return composed;
            // };
            const unit = compose({foo: true}).infect(spy(function() {
                // attention de ne pas écrire this.compose ici -> call stack sinon puisque this.compose === arguments.callee.caller
                // faut écrire this.compose.cured(this, {bar: true});
                return this.compose.uninfected.call(this, {bar: true});
            }));
            const infectedComposeCall = unit.compose.infected.lastCall;
            const composedUnit = unit.compose('dam');

            assert(infectedComposeCall.called);
            assert(infectedComposeCall.this === unit);
            assert(infectedComposeCall.args[0] === 'dam');
            assert(infectedComposeCall.return === composedUnit);
            assert(composedUnit.get('bar') === true);

            const purifiedUnit = composedUnit.cure().compose({
                name: 'dam'
            });
            assert(purifiedUnit.get('name') === 'dam');

            // it means you can do the following
            // dbQueue = compose().infect(function(db, queue) {
            //     return compose(this, {
            //         db: db,
            //         queue: queue
            //     });
            // });
            // myDBQueue = dbQueue.compose(
            //     {
            //         port: 3000
            //     },
            //     {
            //         port: 5000
            //     }
            // ).expose();
            // https://github.com/stampit-org/stamp-specification#stamp-arguments
        });

        this.add('unit constructor are called in serie', function() {
            // https://www.barbarianmeetscoding.com/blog/2016/01/18/javascript-ultra-flexible-object-oriented-programming-with-stamps/
            const firstUnit = compose({
                constructor: spy(function() {
                    return {};
                })
            });
            const secondUnit = compose({
                constructor: spy()
            });
            const unit = compose(firstUnit, secondUnit);

            const firstConstructorCall = firstUnit.get('constructor').lastCall;
            const secondConstructorCall = secondUnit.get('constructor').lastCall;
            const instance = unit.produce('foo', 'bar');

            assert(firstConstructorCall.called);
            // assert(firstConstructorCall.this === ); we cant' really know this because it's created internally by unit and ignored
            assert(firstConstructorCall.args[0] === 'foo');
            assert(secondConstructorCall.called);
            assert(secondConstructorCall.this === firstConstructorCall.return);
            assert(secondConstructorCall.args[0] === 'foo');
            assert(instance === secondConstructorCall.this);
        });

        this.add('Example with i18n api', function() {
            // Dictionnary -> Entries -> Entry -> Definition -> Trait,Context,Expression
        });

        this.add('Example with fetch api', function() {
            // request has uri, method, headers, body, how could unit implement this ?
            const Request = compose({
                constructor() {
                    // here we read method, url and we construct the right object
                }
            });
            const PostRequest = Request.compose({
                method: 'POST'
            });
            const githubRequest = Request.compoe({
                url: 'http://github.com'
            });
            const googlePostRequest = PostRequest.compose({
                url: 'http://google.com'
            });
            const githubPostRequest = PostRequest.compose(githubRequest);

            console.log(googlePostRequest, githubPostRequest);
        });
        */

        /*
        // should we call constructor once we know the object being created and the properties belonging to him
        // I also need something to be able to clone an object with the current state of it
        // It gives me the feeling even instance should be stamp
        // in other words we wouldn't use raw object anymore, even instance would use the implement keyword to add more property
        // we would have conflict and remember that stamp are immutable so every time an object would be mutated
        // all the structure must be updated as well to use the new immutable value

        et en utilisanet immutable.js ?
        finalement c'est "exactement" ce que fais immutable.js
        stampit() -> Map()
        compose() -> map.merge(), voir map.mergeWith() si on souhaite gérer le conflit autrement qu'en écrasant
        method() -> map.set()

        du coup on instancie pas un immutable, on continue de le modifier, à "aucun" moment on ne passe par un objet classique
        par contre toutes les méthodes dans immutable ne doivent pas être overrides mais on veut pouvoir en ajouter de nouvelles
        faut essayer de faire lab-immutable.js pour voir ce que ça donnerait
        */
    }
};

import Unit from './composable.js';

function composePure(...args) {
    let composable = this.createConstructor();

    mergeTwoComposable(composable, this);
    for (let arg of args) {
        let secondComposable;

        if (Object.getPrototypeOf(this) === Object.getPrototypeOf(arg)) {
            secondComposable = arg;
        } else {
            secondComposable = this.createConstructor();
            secondComposable.fill(arg);
        }

        mergeTwoComposable(composable, secondComposable);
    }

    return composable;
}

function mergeTwoComposable(firstComposable, secondComposable) {
    firstComposable.properties.merge(secondComposable.properties);
    return firstComposable;
}

// baseUnit is infected by composePure so that composePure is propaged amongst composed unit
const baseUnit = Unit.create().infect(composePure);
// prepare a bound version of baseUnit.compose for convenience
// it allows to write compose() instead of baseUnit.compose() all the time
const compose = baseUnit.compose.bind(baseUnit);

export {composePure};
export {compose};
