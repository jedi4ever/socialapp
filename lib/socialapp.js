'use strict';

// Module dependencies
var http    = require('http');
var https   = require('https');
var fs      = require('fs');
var path    = require('path');
var util    = require('util');
var events  = require('events');

var merge = require('./utils/merge');

// Main configuration
var SocialApp = function(config, callback) {

  // Initialize constructor
  events.EventEmitter.call(this);

  //console.log(module.parent);
  var self = this;


  // Read the config
  var defaults = require('./socialapp/defaults');
  var settings = merge(defaults,config);

  // Initialize the 'global/singleton' logger
  // We need to read the settings first
  var Logger = require('./utils/logger');
  var logger = new Logger(settings.log);

  // Setup metrics
  var Metrics = require('./utils/metrics');
  var metrics = new Metrics(settings.metrics);

  var metricsLogger = logger.loggers.get('metrics');
  metrics.increment('socialapp.initialize',null,null,function(error, bytes){
    if(error){
      metricsLogger.error('Oh noes! There was an error:', error);
    } else {
      metricsLogger.log('debug','Successfully sent %s bytes',bytes);
    }
  });

  this.start = function() {

    // Configure express
    var SocialExpress = require('./socialapp/express');

    var expressApp = new SocialExpress(settings);

    expressApp.on('error', function(err) {
      self.emit('error', err);
      logger.error(err.message);
      return callback(err);
    });

    // Certificate & Keys
    var sslUtil = require('./utils/ssl');
    var sslOptions = sslUtil.readFileSync(settings.ssl);

    // Setup a http/https webserver
    // NOte: server.listen(port, [hostname], [backlog], [callback])#
    // backlog is the maximum length of the queue of pending connections. 
    // The actual length will be determined by your OS through sysctl settings such as tcp_max_syn_backlog 
    // and somaxconn on linux. The default value of this parameter is 511 (not 512).

    var webServer;
    if (settings.secure) {
      logger.debug('Starting an https webserver');
      webServer = https.createServer(sslOptions,expressApp).listen(expressApp.get('port'));
    } else {
      logger.debug('Starting an http webserver');
      webServer = http.createServer(expressApp).listen(expressApp.get('port'));
    }

    // http://nodejs.org/api/net.html#net_server_listen_port_host_backlog_callback
    webServer.on('error', function(err) {
      self.emit('error', err);
      logger.error(err.message);
      return callback(err);
    });

    //LIMIT: server.maxConnections
    //LIMIT: webserver.maxHeadersCount
    //LIMIT: webserver.timeout (defaults to 2min)
    // socket.setNoDelay([noDelay])

    // server.close([callback]) Stops the server from accepting new connections

    var expressLogger = logger.loggers.get('express');
    expressLogger.debug('Express server listening on port ' + expressApp.get('port'));

    // Setup a socketIO Server
    var socketIOServer = new require('./socialapp/socketio')(webServer,settings);
    socketIOServer.on('error', function(err) {
      self.emit('error', err);
      logger.error(err.message);
      return callback(err);
    });

    self.socketio = socketIOServer;
    self.express = expressApp;
    self.server = webServer;

  };

  this.stop = function(callback) {
    self.server.close(function() {
      var store = self.socketio.get('store');
      if (store) {
        store.destroy();
      }
      self.socketio = null;
      self.express = null;
      self.server = null;
      callback();
    });
  };

  this.metrics = metrics;
  this.logger = logger;
  this.settings = settings;

  return this;


};

util.inherits(SocialApp, events.EventEmitter);
module.exports = SocialApp;
