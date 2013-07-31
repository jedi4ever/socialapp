'use strict';

var logger = require('../utils/logger')().loggers.get('socketio');

// Module dependencies
var connectredis = require('connect-redis');
var connect =  require('connect');
var cookie =  require('cookie');
var socketIO = require('socket.io');

// We installed hiredis for performance
var redis = require('redis');

var merge = require('../utils/merge');

// Main configuration
var SocketIOServer = function(webServer,settings,callback) {

  // Enable socketio redis store
  // http://www.ranu.com.ar/2011/11/redisstore-and-rooms-with-socketio.html
  // https://github.com/LearnBoost/socket.io/wiki/Configuring-Socket.IO
  // http://stackoverflow.com/questions/8563401/node-js-multi-threading-and-socket-io
  // http://stackoverflow.com/questions/5944714/how-can-i-scale-socket-io
  //var ioRedis = require('socket.io/node_modules/redis');
  logger.log('info','redis pub,sub,store settings:',settings.socketio.redis);
  var ioPub = redis.createClient(settings.socketio.redis);
  var ioSub = redis.createClient(settings.socketio.redis);
  var ioStore = redis.createClient(settings.socketio.redis);

  // TODO set Retry delay, max attempts
  // TODO Detect buffers, use buffers
  // TODO enable_offline_queue
  // Watch the errors
  ioPub.on('error',function(err) {
    logger.error(err.message);
    //TODO we should probably exit.
  });

  ioPub.on('connect',function(err) {
    logger.info('Socketio Pub Redis connected');
  });

  ioSub.on('error',function(err) {
    logger.error(err.message);
    //TODO we should probably exit.
  });

  ioSub.on('connect',function(err) {
    logger.info('Socketio Sub Redis connected');
  });

  ioStore.on('error',function(err) {
    logger.error(err.message);
    //TODO we should probably exit.
  });

  ioStore.on('connect',function(err) {
    logger.info('Socketio store Redis connected');
  });

  var ioDb = settings.socketio.redis.db;
  /*
  if (ioDb) {
    logger.info('Switching to redis db'+ioDb);
    ioPub.select(ioDb);
    ioSub.select(ioDb);
    ioStore.select(ioDb);
  }
 */

  // This is to store socket IO sessions
  var IORedisStore = require('socket.io/lib/stores/redis');

  // Session store
  // Initializing redis session store
  var express = require('express');
  var sessionRedis = new require('./session-redis')(settings.session.redis) ;
  logger.log('info','redis sessionstore settings:',settings.session.redis);

  var RedisStore = connectredis(express);
  var sessionStore = new RedisStore( { client: sessionRedis} );

  // access session info in socket.io - http://iamtherockstar.com/blog/2012/02/14/nodejs-and-socketio-authentication-all-way-down/
  // Hm but might not be secure http://stackoverflow.com/questions/4641053/socket-io-and-session
  // http://www.danielbaulig.de/socket-ioexpress/ seems to work

  // Listen on the same port as express (https) server
  // log: false remove these error message  info  - socket.io started
  //{ log: !settings.log.mute }); // disable logging
  // the mute is handled by our logger so we enable log:true here
  var ioServer = socketIO.listen(webServer, { logger: logger , log:true});

  ioServer.set('store', new IORedisStore({
    redis: redis, // pass constructor as we're using hiredis
    redisPub:ioPub,
    redisSub:ioSub,
    redisClient:ioStore
  }));

  ioServer.configure(function() {

    var ioConfig = settings.socketio.config;
    Object.keys(ioConfig).forEach(function(key) {
      var val = ioConfig[key];
      logger.log('debug','config settings: %s:%s',key,val);
      ioServer.set(key, val);
    });
  });


  // https://github.com/LearnBoost/socket.io/wiki/Authorizing
  // Handshake form
  /*
     {
headers: req.headers       // <Object> the headers of the request
, time: (new Date) +''       // <String> date time of the connection
, address: socket.address()  // <Object> remoteAddress and remotePort object
, xdomain: !!headers.origin  // <Boolean> was it a cross domain request?
, secure: socket.secure      // <Boolean> https connection
, issued: +date              // <Number> EPOCH of when the handshake was created
, url: request.url          // <String> the entrance path of the request
, query: data.query          // <Object> the result of url.parse().query or a empty object
}
*/

  // http://www.danielbaulig.de/socket-ioexpress/
  // https://github.com/functioncallback/session.socket.io
  ioServer.set('authorization', function(handshakeData, callback) {
    var handshakeCookie = handshakeData.headers.cookie;

    /*
    // TODO : check X-FORWARDED-PROTO to if request was secure
    // we don't serve insecure sessions
    if (!handshakeData.secure) {
    return callback('We don\'t serve insecure session',null);
    }
    */

    if (handshakeCookie) {
      var sid = null;

      // Almost there but connect.id still to be parsed
      // connect.sid s%3A4VOmcVYOyHkQzxgo4gnseuLl.SACoc0Jn%2F89LgvGgLArY8lYpnssiUCJTk6Cs1bdCILY
      // This solved it !
      // http://stackoverflow.com/questions/11828354/merge-socket-io-and-express-js-sessions
      // https://github.com/vortec/lolbr/blob/master/lib/lolbr.js

      // Note 26/07/2013: Seems to be integrated 
      // https://github.com/camarao/session.socket.io/blob/master/session.socket.io.js
      // Parse the cookie from and decode it with 'the secret'
      try {
        var _signed_cookies = cookie.parse(decodeURIComponent(handshakeCookie));

        // Parse and Store the cookie in our socket
        // We only allow for signed cookies
        handshakeData.cookie = connect.utils.parseSignedCookies(_signed_cookies, settings.express.session.secret);

        // Store the session ID
        sid = handshakeData.cookie[settings.session.key];
        handshakeData.SessionId = sid;
      } catch (err) {
        logger.warn('Malformed cookie transmitted:'+ err.message);
        return callback('Malformed cookie transmitted', false);
      }

      // Now fetch the session
      sessionStore.get(sid, function(err, session) {
        if (err || !session) {
          logger.warn('Failed to get session');
          callback('Failed to get session', false);
        } else {
          logger.debug('Existing session:'+session);
          handshakeData.session = session;
          return callback(null, true);
        }
      });
    } else {
      // this is a client connecting
      logger.warn('No session cookie found');
      return callback(null, true);
      //return callback('No session cookie found', true);
    }
  });
  return ioServer;

};

module.exports = SocketIOServer;
