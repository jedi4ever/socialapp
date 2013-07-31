'use strict';

var logger = require('../utils/logger')().loggers.get('user');
var metrics = require('../utils/metrics')();

var passportSetup = function passportSetup(options,callback) {

  var passport = require('passport');

  // Set defaults first
  var settings = options;

  // Functions to manage SocialUsers
  var users = require('../users');

  // We use redis to store/create the users
  var redis = require('redis');
  var rc = redis.createClient(settings.users.redis);

  // TODO set Retry delay, max attempts
  // TODO Detect buffers, use buffers
  // TODO enable_offline_queue
  // Watch the errors
  rc.on('error',function(err) {
    logger.error(err.message);
    //TODO we should probably exit 
  });

  var db = settings.users.redis.db;

  // Select a separate dbspace
  //
  if (db) {
    logger.debug('Selecting dbspace %s for passport', db);
    rc.select(db, function() { /* ... */ });
    // Not needed anymore
    // https://github.com/visionmedia/connect-redis/pull/28
    // https://github.com/mranney/node_redis/pull/142
    rc.on('connect', function() {
         rc.send_anyway = true;
         rc.select(db);
         rc.send_anyway = false;
    });
  }


  // other events ready, connect , error , end , drain , idle
  rc.on('error', function (err) {
    logger.log('error','Error with redis for passport %s', err);
    return callback(err);
  });

  // Passport session setup.
  //   To support persistent login sessions, Passport needs to be able to
  //   serialize users into and deserialize users out of the session.  Typically,
  //   this will be as simple as storing the user ID when serializing, and finding
  //   the user by ID when deserializing.
  passport.serializeUser(function(user, done) {
    done(null, user.id);
  });

  passport.deserializeUser(function(id, done) {
    users.findOne(rc, id, function (err,user) {
      if (err) {
        logger.log('error','Error retrieving user via passport %s', err);
        return done(err, null);
      } else {
        if (user === false) {
          // user not found
          return done(null, false);
        } else {
          // user found
          return done(null, user);
        }
      }
    });
  });


  // Two known stragies
  var strategyTypes = [] ;

  // We get the matching options
  var strategyOptions = { };

  var strategyUserFindFunctions = {};

  if (settings.twitter) {
    strategyTypes.push('twitter');
    strategyOptions.twitter = {
      consumerKey: settings.twitter.consumerKey,
      consumerSecret: settings.twitter.consumerSecret,
      callbackURL: settings.twitter.callback
    };
  }

  if (settings.github) {
    strategyTypes.push('github');
    strategyOptions.github = {
      clientID: settings.github.clientId,
      clientSecret: settings.github.clientSecret,
      callbackURL: settings.github.callback
    };
  }

  // Strategies error handling
  // callback(null, user) if user is found
  // callback(null, false, {message: 'reason not found'} if user not found
  // callback(err , ...) if there is a db error etc..


  // Twitter strategy
  strategyUserFindFunctions.twitter = function(req, token, tokenSecret, profile, done) {
    users.findOrCreate(rc, 'twitter', {
      twitterId: profile.id,
      image: profile.photos ? profile.photos[0].value : '',
      username: profile.username
    }, function (err, user) {
      if (err) {
        return done(err);
      } else {
        return done(null, user);
      }
    });

  };

  // Github strategy
  strategyUserFindFunctions.github = function(accessToken, refreshToken, profile, done) {

    users.findOrCreate(rc, 'github', {
      githubId: profile.id,
      username: profile.username,
      image: profile._json ? profile._json.avatar_url : ''
    }, function (err, user) {

      if (err) {
        return done(err);
      } else {
        return done(null, user);
      }
    });
  };

  // For all strategies defined
  strategyTypes.forEach(function(strategyType) {

    // Load the matching passport Type
    var Strategy = require('passport-'+strategyType);
    // Create a new strategy
    var strategy = new Strategy(
      strategyOptions[strategyType],
      strategyUserFindFunctions[strategyType]
    );

    // Add it to passport to be used
    passport.use(strategy);
  });

  // Return the passport (now with the added handlers)
  return passport;

};

module.exports = passportSetup;
