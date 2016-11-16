import Lab from './lab.js';
import './primitive.js';
import './composite.js';

// ça commence à ressembler à kk chose
// on va pouvoir tester que les primitives sont bien overides
// puis que les array sont bien concatené et les propriété des array bien combinés
// une fois qu'on auras fait ça faudrais mettre en place un moyen de modifier la conf par défaut
// mais bon c'est pas forcément primordial actuellement
// ce qu'on veut c'est surtout un comportement par défaut, la possibilité de l'override c'est du bonus

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('object composition', function() {
            const dam = {name: 'dam', item: {name: 'sword'}};
            const seb = {name: 'seb', item: {price: 10}, age: 10};
            const expectedComposite = {name: 'seb', item: {name: 'sword', price: 10}, age: 10};

            const damElement = Lab.scan(dam);
            const sebElement = Lab.scan(seb);
            const compositeElement = damElement.compose(sebElement);

            assert(damElement.value === dam);
            assert(sebElement.value === seb);
            assert.deepEqual(compositeElement.value, expectedComposite);
            assert.deepEqual(dam, {name: 'dam', item: {name: 'sword'}});
        });

        // this.add('array concatenation', function() {
        //     const damFriends = ['seb', 'clément'];
        //     const sandraFriends = ['sumaya'];
        //     const expectedHybrid = ['seb', 'clément', 'sumaya'];
        //     // set some sparse properties on array to ensure they are composed as well
        //     damFriends.foo = 'foo';
        //     sandraFriends.bar = 'bar';
        //     expectedHybrid.foo = damFriends.foo;
        //     expectedHybrid.bar = sandraFriends.bar;

        //     const damFriendsElement = Lab.scan(damFriends);
        //     const sandraFriendsElement = Lab.scan(sandraFriends);
        //     const hybridFriendsElement = damFriendsElement.compose(sandraFriendsElement);

        //     assert.deepEqual(hybridFriendsElement.value, expectedHybrid);
        // });

        // this.add('element construct', function() {
        //     const dam = {name: 'dam', item: {name: 'sword'}};
        //     const damElement = Lab.scan(dam);
        //     const damInstanceA = damElement.compile();
        //     const damInstanceB = damElement.compile();

        //     // compile does the job but we want
        //     // element.construct that will call any .constructor method
        //     // and maybe do more

        //     assert.deepEqual(damInstanceA.item, dam.item);
        //     assert.deepEqual(damInstanceB.item, dam.item);
        //     assert(damInstanceA.item !== dam.item);
        //     assert(damInstanceB.item !== dam.item);
        // });
    }
};
