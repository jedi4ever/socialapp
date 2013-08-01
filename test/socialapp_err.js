//'use strict';

var debug = true;

var expect = require('expect.js');

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

var errorConfig = {
  session: { redis: { host: '127.0.0.1' }, key: 'socialapp.sid' },
  express: { port: 7000 },
  log: { mute: !debug, level: 'debug' },
  ssl: {
    key: path.join(__dirname,'..','conf','localhost2.pem'),
    cert: path.join(__dirname,'..','conf','localhost-cert.pem'),
    ca: []
  }
};

var logger = require('../lib/utils/logger')(errorConfig.log);

var SocialApp = require('../lib/socialapp.js');

describe('Errors to find', function() {

  beforeEach(function(done) {
    done();
  });

  afterEach(function(done) {
    socialApp.stop(function() {
      done();
    });
  });


  it('invalid ssl options', function invalidSSlOptions(done) {

    socialApp = new SocialApp(errorConfig);

    // We catch the errors to avoid an exit
    socialApp.on('error', function() { });

    socialApp.start(function(err) {
      expect(err).not.to.be(null);
      done();
    });

  });

});
