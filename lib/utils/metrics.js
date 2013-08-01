'use strict';

var Statsd = require('node-statsd').StatsD;
var merge = require('hashmerge');
var logger = require('./logger')().loggers.get('metrics');

var sharedMetrics;

var metrics = function(options) {

  // If we have already been initialized
  if (sharedMetrics) {
    return sharedMetrics;
  }

  // If not yet initialized we continue
  var defaults = {
  };

  var settings = merge(defaults,options);

  //console.log(module.parent);
  var statsd = new Statsd(settings);
  //check for network errors
  statsd.socket.on('error', function(error) {
    logger.error('Error in statsd socket: ', error);
  });

  sharedMetrics = statsd;

  return sharedMetrics;

};


module.exports = metrics;
