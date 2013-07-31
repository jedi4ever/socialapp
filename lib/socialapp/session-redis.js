'use strict';

var logger = require('../utils/logger')().loggers.get('sessionstore');

// Module dependencies
var path    = require('path');

var connectredis = require('connect-redis');
var connect      =  require('connect');

// We installed hiredis for performance
var redis        = require('redis');

var merge        = require('../utils/merge');

// Main configuration
var SessionRedis = function(settings) {

  // more options https://github.com/visionmedia/connect-redis
  // client, host, port, ttl, db , prefix
  // Usually you would initialize your session store just with redis config
  // And it will create it's own client
  //var sessionStore = new RedisStore( settings.session.redis );

  // To select the db is uses
  // uses self.send_anyway = true //secret flag to send_command to send something even if not "ready"
  // No more needed https://github.com/mranney/node_redis/pull/142

  // Now we can handle all redis errors ourself
  var sessionRedis = redis.createClient(settings);

  var sessionRedisDb = settings.db;
  if (sessionRedisDb) {
    sessionRedis.select(sessionRedisDb, function() {});
  }

  sessionRedis.on('ready',function(err) {
    logger.info('Session Store Connection Ready');
  });
  sessionRedis.on('connect',function(err) {
    logger.info('Session Store Connection Connecting');
  });
  sessionRedis.on('drain',function(err) {
    logger.info('Session Store Connection Draining');
  });
  sessionRedis.on('end',function(err) {
    logger.info('Session Store Connection Ending');
  });
  sessionRedis.on('idle',function(err) {
    logger.info('Session Store Connection Idle');
  });

  sessionRedis.on('error',function(err) {
    // TODO exit?
    logger.error(err);
  });

  return sessionRedis;

};

module.exports = SessionRedis;
