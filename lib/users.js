'use strict';

var validProviders = ['github', 'twitter'];

var users = function() {

  var logger = require('./utils/logger')().loggers.get('users');
  var metrics = require('./utils/metrics')();
  // Helper function to calculate the correct redis regex based on the QueryParams
  // If there is an id in the queryParams, this takes precedence over providerParams
  var redisKeyRegexFromQuery = function(provider, queryParams) {

    var identifierField = provider + 'Id'; // twitterId , githubId, ...
    var providerId = queryParams[identifierField];
    var key;

    // If a specific internal Id was specified we use this
    if (queryParams.id) {
      key = 'user:' + queryParams.id + ':*';
    } else {
      // Otherwise we use the provider id
      key = 'user:*:' + provider + ':' + providerId +':*';
    }

    return key;
  };

  // Retrieve the User specified by a key( = Regexp query)
  var retrieveUser = function(rc, key, callback) {

    logger.debug('retrieveUser[%s]', key);

    rc.keys(key, function(err, result) {

      // In case of error, we pass the error higher
      if (err) {
        logger.debug('error retriveUser[%s]', key);
        return callback(err, null);
      }

      if (result.length === 1) {
        var matchingKey = result[0];
        rc.hgetall(matchingKey, function(err, userData) {
          userData.key = matchingKey;  // add the matching key to the userData
          return callback(null, userData);
        });
      }

      // If we get multiple matches, we consider this an error
      if (result.length > 1) {
        return callback(new Error('Multiple users match key query: '+key), false);
      }

      // If no results, we return not found
      if (result.length === 0) {
        return callback(null, false);
      }
    });
  };

  /* ------------------------ findOne user --------------------------- */
  var findOne = function(rc, provider, queryParams, callback) {
    // Calculate the Redis Regex to find the user
    var queryRegex = redisKeyRegexFromQuery(provider, queryParams);

    // Retrieve user
    return retrieveUser(rc, queryRegex, callback);
  };

  /* ------------------------ findOne user --------------------------- */
  // Twitter create function
  var twitterCreate = function(rc, id, provider, userParams, callback) {
    var redisData = {
      id: id,
      twitterId: userParams.twitterId,
      username: userParams.username,
      image: userParams.image
    };

    return _redisCreate(rc,id,provider,redisData, callback);

  };

  // Github create function
  var githubCreate = function(rc, id, provider, userParams, callback) {
    var redisData = {
      id: id,
      githubId: userParams.githubId,
      username: userParams.username,
      image: userParams.image
    };

    return _redisCreate(rc,id,provider,redisData, callback);

  };

  // Creates a provider User in Redis
  // rc: the redis connection
  // id: the internal Generic Id
  // redisParams: a hash containing the fields to store for this povider
  // callback: function to call when done or error
  var _redisCreate = function(rc, id, provider, redisParams, callback) {
    var keys = require('./keys');

    var socialAppId = require('node-uuid').v4();
    var socialAppSecret = keys.genKeySync();
    var socialAppSecretHash = keys.hashSync(socialAppSecret);

    var prefix = 'socialApp';

    // We explicitely silence jshint here
    /*jshint -W069 */
    // Add the socialApp Id & Secret to It
    redisParams[prefix+'Id'] = socialAppId;
    // We store the hash
    redisParams[prefix+'Secret'] = socialAppSecretHash;
    /*jshint +W069 */

    // Include the provider
    redisParams.provider = provider;
    // Calculate the Id field based on the provider ('twitter'+'Id' , 'github'+Id)
    var providerIdField = provider + 'Id';

    // The key to store the user
    // user:<genericId>:<provider>:<providerId>:socialAppId
    var redisUserKey = 'user:' + id + ':' + provider + ':' + redisParams[providerIdField] + ':' + socialAppId ;

    rc.hmset(redisUserKey, redisParams, function(err, user) {
      callback(err,  redisParams);
    });
  };

  // Generate the next userID
  var nextId = function(rc,callback) {
    rc.incr('counters:user:ids', function(err, id) {
      if (err) {
        return callback(err, null);
      } else {
        return callback(null,id);
      }
    });
  };

  var create = function(rc, provider, userParams, callback) {

    // validate the provider
    if (validProviders.indexOf(provider) < 0) {
      return callback(new Error('invalid provider ' + provider));
    }

    //Id = http://developer.github.com/v3/users/
    //validate userName & id
    //twitter regexp - /^[A-Za-z0-9_]{1,15}$/
    //validate params

    nextId(rc, function(err, id) {
      if (err) {
        return callback(err, null);
      } else {
        switch (provider) {
          case 'github':
            return githubCreate(rc, id, provider, userParams, callback);
          case 'twitter':
            return twitterCreate(rc, id, provider, userParams, callback);
          default:
            break;
        }
      }
    });
  };

  // Find one or if it doesn't exit, create one
  var findOrCreate = function(rc, provider, options, callback) {

    findOne(rc, provider, options, function(err, user) {
      if (user) {
        return callback(null, user);
      } else {
        return create(rc, provider, options, callback);
      }
    });

  };

  var remove = function(rc, provider, queryParams, callback) {
    findOne(rc, provider, queryParams, function(err, user) {
      if (user) {
        // Calculate the Redis Regex to find the user
        rc.del(user.key,function(err,count) {
          if (err) {
            return callback(new Error('User not found'));
          }

          if (count !== 1 ) {
            return callback(new Error('Remove count was not 1 but '+count));
          } else {
            return callback(null, user);
          }
        });
      } else {
        return callback(new Error('User not found'));
      }
    });
  };

  //Exportable public functions
  return {
    findOne: findOne,
    findOrCreate: findOrCreate,
    create: create,
    remove: remove,
    nextId: nextId
  };
}();

module.exports = users;
