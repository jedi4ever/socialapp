//'use strict';

// We initialize logger before anything else
var logger = require('../lib/utils/logger')({ mute: true, level: 'debug'});

var user = require('../lib/users.js');
var expect = require('expect.js');

// Initialize a redis client in its own dbspace
var redis = require('redis');
var rc = redis.createClient();
var db = 10;
rc.select(db);
rc.flushdb();

var prefix = 'socialApp';
var idField = prefix +  'Id';
var secretField = prefix +  'Secret';

describe('SocialApp User', function() {

  it('can create a user', function(done) {
    user.create(rc,'github', { githubId: '123445' , username: 'jedi4ever'},function(err,user) {
      expect(err).to.be(null);
      expect(user.githubId).to.be('123445');
      done();
    });
  });

  var socialAppId = null;
  var socialAppSecret = null;

  it('can find a user', function(done) {
    user.findOne(rc,'github', { githubId: '123445'},function(err,user) {

      var socialAppId = user[idField];
      var socialAppSecret = user[secretField];

      expect(err).to.be(null); // no errors
      expect(socialAppId).not.to.be.empty(); // we should always have an ID
      expect(user.socialAppSecret).not.to.be.empty(); // and the secret can't be empty
      expect(user.socialAppSecret).to.have.length(60); // and the secret needs to be salted
      expect(user.username).to.be('jedi4ever'); // and the username should be the same as created

      done();
    });
  });

  it('can remove a user', function(done) {
    user.remove(rc,'github', { githubId: '123445'},function(err,userData) {

      expect(err).to.be(null); // no errors
      expect(userData.username).to.be('jedi4ever'); // and the username should be the same as created
      user.findOne(rc,'github', { githubId: '123445'},function(err,userData) {
        expect(err).to.be(null); // no errors
        expect(userData).to.be(false); // no user found
        done();
      });
    });
  });

  it('will create a user if it can\'t one', function(done) {
    user.findOrCreate(rc,'github', { githubId: '123445', username: 'jedi4ever'},function(err,user) {

      var socialAppId = user.socialAppId;
      var socialAppSecret = user.socialAppSecret;

      expect(err).to.be(null); // no errors
      expect(socialAppId).not.to.be.empty(); // we should always have an ID
      expect(user.id).to.be.a('number'); // and the id must be a number
      expect(user.socialAppSecret).not.to.be.empty(); // and the secret can't be empty
      expect(user.socialAppSecret).to.have.length(60); // and the secret needs to be salted
      expect(user.username).to.be('jedi4ever'); // and the username should be the same as created

      done();
    });
  });

});
