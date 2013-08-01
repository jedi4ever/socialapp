//'use strict';

var debug = true;
var zombieOptions = { silent: true, debug: false };

// Test frameworks
var zombie = require('zombie');
var sinon = require('sinon');
var expect = require('expect.js');

// Test helpers
var ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn;
var passportStub = require('passport-stub-js');

// Helper frameworks
var merge = require('hashmerge');
var util = require('util');
var path = require('path');

require('better-stack-traces').install({
  before: 2, // number of lines to show above the error
  after: 3, // number of lines to show below the error
  maxColumns: 80, // maximum number of columns to output in code snippets
  collapseLibraries: true // omit code snippets from node_modules
});

require('longjohn');
// longjohn.async_trace_limit = 5;   // defaults to 10
// longjohn.async_trace_limit = -1;  // unlimited

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

var testConfig = {
  session: { redis: { host: '127.0.0.1' }, key: 'socialapp.sid' },
  express: { port: 7000 },
  log: { mute: !debug, level: 'debug' },
  ssl: {
    key: path.join(__dirname,'..','conf','localhost.pem'),
    cert: path.join(__dirname,'..','conf','localhost-cert.pem'),
    ca: []
  }
};

var logger = require('../lib/utils/logger')(testConfig.log);
var lbConfig = merge(testConfig,{ lb: { port: 7001 }, terminated: true });

var SocialApp = require('../lib/socialapp.js');
var client = require('socket.io-client');

var socialApp;
var expressApp;
var socketioApp;

var apiBase = 'localhost';

describe('Let us say Hello via LB', function() {

  beforeEach(function(done) {
    socialApp = new SocialApp(lbConfig);
    expressApp = socialApp.express;
    socketioApp = socialApp.socketio;
    done();
  });

  afterEach(function(done) {
    // destroy socketio store
    var store = socialApp.socketio.get('store');
    store.destroy();
    socialApp.server.close(function() {
      done();
    });
  });

  it.skip('should receive an http(s) answer via bouncy LB', function testviaBouncyLB(done) {

    // Needs to initialize with lbConfig instead of testconfig
    var testPath = '/hello.txt';
    var content = 'Hello World';

    expressApp.get(testPath, function(req, res){
      //console.log(req.ip);
      //console.log(req.ips);
      //console.log(req.protocol);
      res.setHeader('Connection', 'close'); // Explicitely close the client
      res.send(req.ips);
    });

    var sslUtils = require('../lib/utils/ssl');
    var sslOptions = sslUtils.readFileSync(lbConfig.ssl);
    var bouncy = require('bouncy');

    // By default, "x-forwarded-for", "x-forwarded-port", and "x-forwarded-proto" are all automatically inserted into the outgoing 
    var lb = bouncy(sslOptions,function (req, res, bounce) {
      bounce({
        port: lbConfig.express.port,
        headers: {
          'x-forwarded-proto': 'https', // original protocol used from client
          'x-forwarded-port': lbConfig.lb.port, //original port used by client
          // first is client , than every proxy in between
          'x-forwarded-for': '172.3.3.4, 10.10.10.10'
        }
      });
    });
    lb.listen(lbConfig.lb.port);

    var url = util.format('http%s://%s:%d%s', (lbConfig.terminated?'s':''), apiBase, lbConfig.lb.port , testPath||'/');

    zombie.visit(url, zombieOptions, function (e, browser, status) {
      expect(browser.error).to.be(undefined); // no cert errors
      expect(browser.resources[0].response.headers).not.to.have.key('x-powered-by');
      expect(browser.resources[0].response.headers['set-cookie'][0]).to.contain(lbConfig.session.key);
      expect(browser.resources[0].response.headers['set-cookie'][0]).to.contain('HttpOnly');
      expect(browser.resources[0].response.headers['set-cookie'][0]).to.contain('Secure');
      lb.close();
      done();
    });
  });

  it.skip('npm haproxy should receive an output from haproxy', function testHaproxyOutput(done) {
    var HAProxy = require('haproxy');
    var configFile = path.join(__dirname,'..','haproxy.cfg' );
    var haproxy = new HAProxy('/tmp/haproxy.sock', { config: configFile , pidFile: path.join(__dirname,'..','haproxy.pid' )});
    haproxy.start(function(err) {
      console.log(err);
      haproxy.stat('-1', '-1', '-1', function (stats) {
        console.log(stats);
      });
      haproxy.info(function (err, info) {
          // do something with the info..
        console.log(info);
      });
    });

     haproxy.stop('all',function (err) {
       console.log(err);
        done();
      });

      /*
      haproxy.errors(function (err, errors) {
          console.log(err);
      });
      */

  });

  it.skip('should receive an output from haproxy', function testHaproxyOutput(done) {
    var haproxy = require('pty.js').spawn('haproxy', [ '-f' ,path.join(__dirname,'..','haproxy.cfg' ), '-d' ]);
    var testPath = '/hello.txt';

    var url = util.format('http%s://%s:%d%s', (lbConfig.terminated?'s':''), apiBase, lbConfig.lb.port , testPath||'/');
    zombie.visit(url, zombieOptions, function (e, browser, status) {
      /*
      expect(browser.error).to.be(undefined); // no cert errors
      expect(browser.resources[0].response.headers).not.to.have.key('x-powered-by');
      expect(browser.resources[0].response.headers['set-cookie'][0]).to.contain(lbConfig.session.key);
      expect(browser.resources[0].response.headers['set-cookie'][0]).to.contain('HttpOnly');
      expect(browser.resources[0].response.headers['set-cookie'][0]).to.contain('Secure');
      lb.close();
      done();
      */
    });

    haproxy.on('data', function (data) {
        console.log(data);
      if(data.indexOf('www_backend/server1') > 0) {
        haproxy.destroy();
      }
    });

    haproxy.on('close', function (code, signal) {
      console.log('child process terminated due to receipt of signal '+signal);
      done();
    });

  });

  it.skip('should receive an socketio answer via haproxy bla', function testviaLB3(done) {
    this.timeout(1000);
    //var spawn = require('child_process').spawn;
    var spawn = require('pty.js').spawn;
    //var haproxy = spawn('haproxy', [ '-f' ,path.join(__dirname,'..','haproxy.cfg' )]);
    var haproxy = spawn('haproxy',
                        [ '-f' ,path.join(__dirname,'..','haproxy.cfg' ), '-d'
                        ]
                       );
                       haproxy.on('data', function (data) {
                         if(data.indexOf('www_backend/server1') > 0) {
                           haproxy.destroy();
                         }
                       });

                       haproxy.on('close', function (code, signal) {
                         console.log('child process terminated due to receipt of signal '+signal);
                         done();
                       });

  });


  it.skip('should 222 receive an socketio answer via haproxy', function testviaLB2(done) {

    this.timeout(7000);
    var haproxy = require('pty.js').spawn('haproxy', [ '-f' ,path.join(__dirname,'..','haproxy.cfg' ) ]);
    var socialApp = new SocialApp(lbConfig);
    var app = socialApp.express;
    var io = socialApp.socketio;

    var connectString = 'https://'+'localhost'+':'+lbConfig.lb.port;
    console.log(connectString);
    var client = require('socket.io-client');

    var socketioOptions ={
      transports: ['websocket'],
      'force new connection': true,
      //port: lbConfig.express.port,
      port: lbConfig.lb.port,
      //host: settings.host,
      secure: true,
      'reconnect': true,
      'reconnection delay': 5,
      'max reconnection attempts': 100000,
      'connect timeout': 1
    };

    io.sockets.on('connection', function(socket) {
      socket.on('ping', function() {
        socket.emit('pong');
      });
    });

    var _socket = client.connect( connectString, socketioOptions );

    var bla = function() {

      _socket.on('pong', function() {
        console.log('client received pong');
        haproxy.destroy();
      });

      _socket.on('reconnecting', function() {
        console.log('reconnecting');
        _socket.emit('ping');
      });

      var t = 0;
      _socket.on('connect', function() {
        if (t === 0) {
          console.log('sending ping');
          _socket.emit('ping');
          t = 1;
        }
        console.log('connected');
      });

      _socket.on('error', function(error) {
        console.log('an error'+error);
      });

    };

    haproxy.on('close', function (code, signal) {
      var store = socialApp.socketio.get('store');
      store.destroy();
      _socket.disconnect(); // disconect the client so we can cleanly terminate the server
      socialApp.server.close(function() { //exit when all connections are closed
        done();
      });
      console.log('child process terminated due to receipt of signal '+signal);
    });

    haproxy.on('exit', function (code, signal) {
      console.log('exit');
    });

    haproxy.on('data', function (data) {
      console.log('@@@@@@@@@@@@stdout'+data+'§§§§§§§§§§§§');

      if (data.indexOf('Server websocket_backend/server1 is UP') > 0) {
        //done(new Error('bla'));
        console.log('we are up');
        bla();
        // we are up

      }

    });



  });



  it.skip('should receive an socketio answer via LB', function testviaLB7(done) {

    var socialApp = new SocialApp(lbConfig);
    var app = socialApp.express;
    var io = socialApp.socketio;

    io.sockets.on('connection', function(socket) {

      socket.on('ping', function() {
        socket.emit('pong');
      });

    });

    var sslUtils = require('../lib/utils/ssl');
    var sslOptions = sslUtils.readFileSync(lbConfig.ssl);
    var bouncy = require('bouncy');

    // By default, "x-forwarded-for", "x-forwarded-port", and "x-forwarded-proto" are all automatically inserted into the outgoing 
    var lb = bouncy(sslOptions,function (req, res, bounce) {
      //console.log(req.headers);
      bounce({
        port: lbConfig.express.port,
        headers: {
          'x-forwarded-proto': 'https', // original protocol used from client
          'x-forwarded-port': lbConfig.lb.port, //original port used by client
          // first is client , than every proxy in between
          'x-forwarded-for': '172.3.3.4, 10.10.10.10'
        }
      });
    });
    lb.listen(lbConfig.lb.port);

    var socketioOptions ={
      transports: ['websocket'],
      'force new connection': true,
      port: lbConfig.lb.port,
      secure: true,
      'reconnect': true,
      'reconnection delay': 1,
      //'max reconnection attempts': 10
      'connect timeout': 1
    };

    var connectString = 'https://'+'localhost'+':'+lbConfig.lb.port;
    var _socket = client.connect( connectString, socketioOptions );

    _socket.on('pong', function() {
      var store = socialApp.socketio.get('store');
      store.destroy();
      socialApp.server.close(function() { //exit when all connections are closed
        done();
      });
    });

    _socket.on('connect', function() {
      _socket.emit('ping');
    });

    _socket.on('error', function(err) {
      console.log(err);
    });

  });


});
