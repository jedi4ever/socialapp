//'use strict';

var expect = require('expect.js');
//var merge = require('merge');
var merge = require('../lib/utils/merge');

describe('Merge', function() {

  it('can deep merge partial settings', function(done) {

    var options = { log: { mute: true }};
    var defaults = { log: { level: 'debug', mute: false}};

    var settings = merge(defaults,options);
    expect(settings.log.level).to.be('debug');
    expect(settings.log.mute).to.be(true);
    done();
  });

  it('can deep merge non existing settings', function(done) {

    var options = { };
    var defaults = { log: { level: 'debug', mute: false}};

    var settings = merge(defaults,options);
    expect(settings.log.level).to.be('debug');
    expect(settings.log.mute).to.be(false);
    done();
  });

  it('can deep merge empty settings', function(done) {

    var options = { log: {} };
    var defaults = { log: { level: 'debug', mute: false}};

    var settings = merge(defaults,options);
    expect(settings.log.level).to.be('debug');
    expect(settings.log.mute).to.be(false);
    done();
  });

  it('can override duplicate settings', function(done) {

    var options = { log: {  test: {level: 'info' , mute: true } } };
    var defaults = { log: { test: {level: 'debug', mute: false}}};

    var settings = merge(defaults,options);
    expect(settings.log.test.level).to.be('info');
    expect(settings.log.test.mute).to.be(true);
    expect(defaults.log.test.level).to.be('debug');
    expect(options.log.test.level).to.be('info');
    done();
  });

  it('can deep merge different keys', function(done) {

    var options = { lb: { port: 7001 }};
    var defaults = { log: { level: 'debug', mute: false}};

    var settings = merge(defaults,options);
    expect(settings.log.level).to.be('debug');
    expect(settings.log.mute).to.be(false);
    expect(settings.lb.port).to.be(7001);
    done();
  });

  it('can deep merge arrays', function(done) {

    var options = { auth: {
      providers: [
        'twitter',
        'github'
      ]
    } };

    var defaults = {};
    var settings = merge(defaults,options);
    expect(settings.auth.providers).to.be.an('array');
    done();

  });

});
