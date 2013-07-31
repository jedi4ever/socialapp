'use strict';

var winston = require('winston');
var merge = require('./merge');
var sharedLogger ;

var logger = function (options) {

  // If we have already been initialized
  if (sharedLogger) {
    return sharedLogger;
  }

  // If not yet initialized we continue
  var defaults = {
    level: 'info',
    mute: true,
    colorize: true,
    timestamp: true,
    prettyPrint: false
  };

  // -> we don't want winston to handle our uncaught exceptions and no exit
  // exitOnError: false 
  // handleExceptions: true
  var settings = merge(defaults,options);

  var mainSettings = {
      level: settings.level,
      colorize: settings.colorize,
      timestamp: settings.timestamp,
      prettyPrint: settings.prettyPrint,
      silent: settings.mute,
      label: 'main'
   };

   var mainLogger = new (winston.Logger)({
       transports: [
         new (winston.transports.Console)(mainSettings)
     ]
   });

  mainLogger.setLevels(winston.config.npm.levels);

  // Add subdomain containers
  mainLogger.loggers = new winston.Container();

  mainLogger.loggers.add('sessionstore', {
    console: {
      level: settings.level,
      colorize: settings.colorize,
      timestamp: settings.timestamp,
      prettyPrint: settings.prettyPrint,
      silent: settings.mute,
      label: 'session'
    }
    /*,
    file: {
      filename: '/path/to/some/file'
    }*/
  });

  mainLogger.loggers.add('socketio', {
    console: {
      level: settings.level,
      colorize: settings.colorize,
      timestamp: settings.timestamp,
      prettyPrint: settings.prettyPrint,
      silent: settings.mute,
      label: 'socketio'
    }
    /*,
    file: {
      filename: '/path/to/some/file'
    }*/
  });

  mainLogger.loggers.add('express', {
    console: {
      level: settings.level,
      colorize: settings.colorize,
      timestamp: settings.timestamp,
      prettyPrint: settings.prettyPrint,
      silent: settings.mute,
      label: 'express'
    }
    /*,
    file: {
      filename: '/path/to/some/file'
    }*/
  });

  mainLogger.loggers.add('users', {
    console: {
      level: settings.level,
      colorize: settings.colorize,
      timestamp: settings.timestamp,
      prettyPrint: settings.prettyPrint,
      silent: settings.mute,
      label: 'user'
    }
  });

  mainLogger.loggers.add('metrics', {
    console: {
      level: settings.level,
      colorize: settings.colorize,
      timestamp: settings.timestamp,
      prettyPrint: settings.prettyPrint,
      silent: settings.mute,
      label: 'metrics'
    }
    /*,
    file: {
      filename: '/path/to/some/file'
    }*/
  });

  sharedLogger = mainLogger;
  return sharedLogger;
};


module.exports = logger;
