//'use strict';

var keys = require('../lib/keys.js');
var sinon = require('sinon');
var expect = require('expect.js');

describe('Social Key', function() {
   it('generates a valid key', function testKeyGeneration(done) {
     var newKey = keys.genKeySync();
     expect(newKey).not.to.be.empty();
     expect(newKey).to.have.length(36);
     done();
   });

   it('hashes a valid key', function testKeyGeneration(done) {
     var newKey = keys.genKeySync();
     var hash = keys.hashSync(newKey);
     expect(hash).not.to.be.empty();
     done();
   });

   it('correctly compares a key', function testKeyComparison(done) {
     var newKey = keys.genKeySync();
     var hash = keys.hashSync(newKey);
     expect(keys.compareSync(newKey, hash)).to.be(true);
     expect(keys.compareSync(newKey + 'tamper', hash)).to.be(false);
     done();
   });
});
