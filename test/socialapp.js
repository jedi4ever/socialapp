//'use strict';

var debug = false;
var zombieOptions = { silent: true, debug: debug };

// Test frameworks
var zombie = require('zombie');
var sinon = require('sinon');
var expect = require('expect.js');

// Test helpers
var ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn;
var passportStub = require('passport-stub-js');

// Helper frameworks
var merge = require('../lib/utils/merge');
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

describe('Let us say Hello', function() {

  beforeEach(function(done) {
    socialApp = new SocialApp(testConfig);
    socialApp.on('error', function(err) {
      console.log('do we error?');
      return done(err);
    });

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


  it('does http hello world', function testHttpHelloWorld(done) {

    var testPath = '/hello.txt';
    var content = 'Hello World';

    passportStub.install(expressApp);

    expressApp.get(testPath, function(req, res){
      res.send(content);
    });

    var url = util.format('http%s://%s:%d%s', (testConfig.secure?'s':''), apiBase, testConfig.express.port , testPath||'/');

    zombie.visit(url,zombieOptions, function (e, browser, status) {
      expect(browser.error).to.be(undefined);
      expect(browser.text()).to.contain(content);
      done();
    });
  });


  it('does socketio hello world without LB', function testSocketIoHelloWorld(done) {

    socketioApp.sockets.on('connection', function(socket) {
      socket.on('ping', function() {
        socket.emit('pong');
      });
    });

    var socketioOptions ={
      //transports: ['xhr-polling'],
      transports: ['websocket'],
      //transports: ['xhr-polling','websocket'],
      'force new connection': true,
      port: testConfig.express.port,
      //port: lbConfig.lb.port,
      //host: settings.host,
      //secure: true,
      'reconnect': true
      //'reconnection delay': 500,
      //'max reconnection attempts': 10
      //'connect timeout': 100,
    };

    var connectString = 'http://'+'localhost'+':'+testConfig.express.port;
    var _socket = client.connect( connectString, socketioOptions );

    _socket.on('pong', function() {
      _socket.disconnect();
      done();
    });

    _socket.on('connect', function() {
      _socket.emit('ping');
    });

  });

  it('should redirect to /login for a proctected hello world', function testProtectedSocialApp(done) {

    var testPath = '/hello2';
    var content = 'Hello World';

    // Example protected resource
    expressApp.get(testPath,  ensureLoggedIn('/login'), function(req, res){
      res.send(content);
    });

    expressApp.get('/login', function(req, res){
      res.send('Please login');
    });

    var url = util.format('http%s://%s:%d%s', (testConfig.secure?'s':''), apiBase, testConfig.express.port , testPath||'/');

    zombie.visit(url, function (e,browser,status) {
      expect(browser.redirected).to.be(true);
      expect(browser.success).to.be(true);
      expect(browser.location.pathname).to.be('/login');
      done();
    });
  });

  it('should not redirect to /login for a proctected hello world when already logged in', function testProtectedSocialApp(done) {

    passportStub.install(expressApp);

    var testPath = '/protected/hello.txt';
    var content = 'Hello World';

    var username = 'john.doe';
    passportStub.login({username: username});

    // Example protected resource
    expressApp.get(testPath,  ensureLoggedIn('/login'), function(req, res){
      res.send(content + ':' + req.user.username);
    });

    expressApp.get('/login', function(req, res){
      res.send('Please login');
    });

    var url = util.format('http%s://%s:%d%s', (testConfig.secure?'s':''), apiBase, testConfig.express.port , testPath||'/');

    zombie.visit(url, function (e,browser,status) {
      expect(browser.redirected).to.be(false);
      expect(browser.success).to.be(true);
      expect(browser.location.pathname).to.be(testPath);
      expect(browser.text()).to.contain(content);
      expect(browser.text()).to.contain(username);
      done();
    });
  });


  it('should not expose the express version header', function testVersionHeader(done) {
    var testPath = '/hello.txt';
    var content = 'Hello World';

    expressApp.get(testPath, function(req, res){
      res.send(content);
    });

    var url = util.format('http%s://%s:%d%s', (testConfig.secure?'s':''), apiBase, testConfig.express.port , testPath||'/');

    zombie.visit(url, function (e, browser, status) {
      expect(browser.resources[0].response.headers).not.to.have.key('x-powered-by');
      done();
    });
  });

  it('should be csrf protected and fail if no csrftoken', function testVersionHeader(done) {

    var formPath = '/form.html';
    var actionPath = '/action.html';
    var content = 'success';

    expressApp.get(formPath, function(req, res){
      var form = [
        '<form action="'+actionPath+'" method="post">',
        '<input type="text" name="user" />',
        '<input type="submit" name="submit" />',
        '</form>'
      ];
      res.send(form.join('\n'));
    });

    expressApp.post(actionPath, function(req, res){
      res.send(content);
    });

    expressApp.get('*', function(req, res) {
    });

    var url = util.format('http%s://%s:%d%s', (testConfig.secure?'s':''), apiBase, testConfig.express.port , formPath||'/');

    // We dummy visit it
    var token ;
    // By default zombie will write output on errors, so we silence it
    zombie.visit(url, { silent: true} ,function (e, browser, status) {
      browser.pressButton('submit', function() {
        expect(browser.success).to.be(false);
        done();
      });
    });

  });

  it('should be csrf protected and successif correct csrftoken', function testVersionHeader(done) {

    var formPath = '/form';
    var actionPath = '/action';
    var content = 'success';

    expressApp.get(formPath, function(req, res){
      var form = [
        '<form action="'+actionPath+'" method="post">',
        '<input type="text" name="user" />',
        '<input type="hidden" name="_csrf" value="'+req.session._csrf+'" />',
        '<input type="submit" name="submit" />',
        '</form>'
      ];
      res.send(form.join('\n'));
    });

    expressApp.post(actionPath, function(req, res){
      res.send(content);
    });

    var url = util.format('http%s://%s:%d%s', (testConfig.secure?'s':''), apiBase, testConfig.express.port , formPath||'/');

    // We dummy visit it
    var token ;
    zombie.visit(url, function (e, browser, status) {
      browser.pressButton('submit', function() {
        expect(browser.text()).to.contain('success');
        expect(browser.success).to.be(true);
        done();
      });
    });

  });

  it('should be have (secure) session cookies', function testVersionHeader(done) {
    var testPath = '/hello.txt';
    var content = 'Hello World';

    expressApp.get(testPath, function(req, res){
      res.send(content);
    });

    var url = util.format('http%s://%s:%d%s', (testConfig.secure?'s':''), apiBase, testConfig.express.port , testPath||'/');

    zombie.visit(url, function (e, browser, status) {
      expect(browser.resources[0].response.headers['set-cookie'][0]).to.contain(testConfig.session.key);
      expect(browser.resources[0].response.headers['set-cookie'][0]).to.contain('HttpOnly');
      if (testConfig.secure) {
        expect(browser.resources[0].response.headers['set-cookie'][0]).to.contain('Secure');
      }
      done();
    });
  });

  it.skip('should receive an output from haproxy', function testHaproxyOutput(done) {
    this.timeout(7000);
    var haproxy = require('pty.js').spawn('haproxy', [ '-f' ,path.join(__dirname,'..','haproxy.cfg' ), '-d' ]);

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


});
