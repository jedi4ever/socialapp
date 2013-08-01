'use strict';

var logger = require('../utils/logger')().loggers.get('express');
var metrics = require('../utils/metrics')();

// Module dependencies
var path    = require('path');
var util    = require('util');
var events  = require('events');

// For express/ejs partials
var express      = require('express');
var ejslocals    = require('ejs-locals');
var flash        = require('connect-flash');
var connectredis = require('connect-redis');
var connect      =  require('connect');
var cookie       =  require('cookie');

var toobusy      = require('toobusy');
var helmet       = require('helmet');

var merge        = require('../utils/merge');

// Main configuration
var SocialExpress = function(settings,callback) {

  // Initialize constructor
  events.EventEmitter.call(this);

  var self = this;

  // Initialize express v3.x style
  var expressApp = express();

  // User and authentication
  var SocialPassport = require('./passport');
  var passportSetup = new SocialPassport(settings);
  var passport = passportSetup.passport;

  passportSetup.on('error', function(err) {
    logger.log('error','Passport error detected %s',err.message);
    self.emit('error',err);
    return callback(err);
  });

  // Session store
  // Initializing redis session store
  var RedisStore = connectredis(express);

  // We create our own session object
  var sessionRedis = new require('./session-redis')(settings.session.redis);

  if (sessionRedis === undefined) {
    self.emit('error',new Error('Error creating session Redis'));
    logger.error('Error creating session Redis');
    return callback(new Error('Error creating session Redis'));
  }

  // Session store reusing our own redis object
  var sessionStore = new RedisStore( { client: sessionRedis });

  sessionRedis.on('disconnect', function() {
    self.emit('error',new Error('Session redis disconnected'));
    logger.error('Session redis disconnected');
    return callback(new Error('Session redis disconnected'));
  });

  // Listen on store evens
  sessionStore.on('disconnect', function() {
    self.emit('error',new Error('Session store disconnected'));
    logger.error('Session store disconnected');
    return callback(new Error('Session store disconnected'));
  });

  sessionStore.on('connect', function() {
    logger.debug('Session store connected');
  });

  // You can also use cookiesessions / Provides cookie-based sessions, and populates req.session

  expressApp.configure(function(){

    expressApp.engine('ejs', ejslocals);

    expressApp.set('port', process.env.PORT || settings.express.port );
    expressApp.set('views', path.join(__dirname ,'..','views'));
    expressApp.set('view engine', 'ejs');

    // Remove the powered-by header
    expressApp.disable('x-powered-by');

    // req.ip , req.ips , req.protocol (http,https)
    if (settings.terminated) {
      expressApp.enable('trust proxy');
    }

    // http://expressjs.com/api.html
    // trust proxy Enables reverse proxy support, disabled by default
    // jsonp callback name Changes the default callback name of ?callback=
    // json replacer JSON replacer callback, null by default
    // json spaces JSON response spaces for formatting, defaults to 2 in development, 0 in production
    // case sensitive routing Enable case sensitivity, disabled by default, treating "/Foo" and "/foo" as the same
    // strict routing Enable strict routing, by default "/foo" and "/foo/" are treated the same by the router
    // view cache Enables view template compilation caching, enabled in production by default
    // view engine The default engine extension to use when omitted
    // views The view directory path, defaulting to "./views"

    // Respond with too busy if the internal loop gets too slow
    expressApp.use( function(req, res, next) {
      // check if we're toobusy() - note, this call is extremely fast, and returns
      // state that is cached at a fixed interval
      if (toobusy())  {
        var busyMessage = 'I\'m busy right now, sorry.';
        res.send(503, busyMessage); // Service temporary unavailable
        logger.warning(busyMessage); //remove newline
        // no next() here as we we now give up
      } else {
        next();
      }
    });

    // enable web server logging; pipe those log messages through winston
    // http://stackoverflow.com/questions/9141358/how-do-i-output-connect-expresss-logger-output-to-winston
    var winstonStream = {
      write: function(message, encoding){
        logger.info(message.slice(0,-1)); //remove newline
      }
    };

    // A lot of other modules: 
    // http://www.senchalabs.org/connect/

    // Just a logger
    // we can disable request logs here
    //expressApp.use(express.logger({format: 'dev'}));
    // http://www.senchalabs.org/connect/logger.html
    // instead we pass it to a winston stream
    expressApp.use(express.logger({stream: winstonStream}));

    // https://github.com/sansmischevia/connect-logger-statsd
    var logger_statsd = require('connect-logger-statsd');
    // we pass in our own metrics
    expressApp.use(logger_statsd({ statsd: metrics} ));

    // http://blog.liftsecurity.io/post/37388272578/writing-secure-express-js-apps
    // Enable helmet do it before the router
    // Sets security headers
    expressApp.use(helmet.csp());
    expressApp.use(helmet.xframe());
    expressApp.use(helmet.contentTypeOptions());

    // Ability to parse the body
    // is equivalent to:
    // app.use(express.json());
    // app.use(express.urlencoded());
    // app.use(express.multipart());

    // Needs to be before csrf
    expressApp.use(express.bodyParser());

    expressApp.use(express.compress());

    // Parse the cookies + populates req.cookies
    expressApp.use(express.cookieParser());

    // cookieSession()
    // Provides cookie-based sessions, and populates req.session. This middleware takes the following options:
    //
    // key cookie name defaulting to connect.sess
    // secret prevents cookie tampering
    // cookie session cookie settings, defaulting to { path: '/', httpOnly: true, maxAge: null }
    // proxy trust the reverse proxy when setting secure cookies (via "x-forwarded-proto")
    // app.use(express.cookieSession());

    // cookieSession != express.Session
    // One is simpler and cookies-only (cookieSession()), the other uses a backing store and a cookie for the session id. 
    // So we use  session and not cookiesession
    // http://www.senchalabs.org/connect/session.html
    // proxy trust the reverse proxy when setting secure cookies (via "x-forwarded-proto")
    logger.log('debug','Are we terminated? %s',settings.terminated);
    expressApp.use(express.session({
      key: settings.session.key,
      store: sessionStore ,
      cookie: {
        httpOnly: true, // inform browser to use it for http request, but don't expose it otherwise
        secure: settings.terminated || settings.secure // only for secure connections
      },
      secret: settings.express.session.secret,
      proxy: settings.terminated // we trust the reverse proxy protocol
    }));

    // no session when we hit robots.txt
    //expressApp.session.ignore.push('/robots.txt');

    logger.debug('lading favicon middleware');
    expressApp.use(express.favicon());
    //expressAppp.use(connect.favicon('public/favicon.icon)')
    expressApp.use(flash());

    logger.debug('initializing passport middleware');
    expressApp.use(passport.initialize());
    expressApp.use(passport.session());

    // Allow to specify _POST or so in a form
    expressApp.use(express.methodOverride());

    // https://github.com/senchalabs/connect/blob/master/lib/middleware/csrf.js
    // through uid2 is creates a psuedo random token that is added to the session
    // every post,put request requires it to have it included

    // By default it throws an exception on console
    // https://groups.google.com/forum/#!msg/express-js/XHscpMtevZk/dj4ZIuseeJIJ
    expressApp.use(express.csrf()); // Must stay after the session

    //TODO: use app.locals to set locals for all requests?
    // Express helper to pass the csrftoken it as a local to the a webpage
    expressApp.use(function (req, res, next) {
      res.locals.csrftoken = req.session ? req.session._csrf : '';
      next();
    });

    // This handles all the app.get etc... requests
    // Nice way of handling them in separate files: http://shtylman.com/post/expressjs-re-routing/ 
    expressApp.use(expressApp.router);

    // Maps static files
    expressApp.use(express.static(path.join(__dirname, '..','public')));
    //expressApp.use(express.static('node_modules/terminal.js/dist'));

    // http://expressjs.com/guide.html#error-handling
    // Error handler as final handler!
    //http://www.senchalabs.org/connect/middleware-errorHandler.html
    // Error handling in node: http://machadogj.com/2013/4/error-handling-in-nodejs.html
    // The default errorhandler doesn't seem to handler our csrf exception, so we need to take some action
    //expressApp.use(express.errorHandler({ dumpExceptions: false, showStack: false , showMessge: false }));
    expressApp.use( function (err, req, res, next) {
      logger.log('error','Possible csrf attack: %s %s',err.message,req.url);
      res.send((err.status || 500), 'oeps');
    });

  });

  // Hookin authProviders
  logger.debug('hooking in auth providers');
  var authProviders = settings.auth.providers;
  authProviders.forEach(function(provider) {
    expressApp.get('/auth/'+provider, passport.authenticate(provider));
    expressApp.get('/auth/'+provider+'/callback',
                   passport.authenticate(provider,
                                         {failureMessage: true,
                                           failureRedirect: '/auth/failure',
                                           successRedirect: '/'}
                                        )
                  );
  });
  // Make sure when going to login we are authenticated
  // Extra middleware - https://github.com/jaredhanson/connect-ensure-login
  // npm install connect-ensure-login

  // app.all('/api/*', requireAuthentication);

  return expressApp;

};

util.inherits(SocialExpress, events.EventEmitter);
module.exports = SocialExpress;
