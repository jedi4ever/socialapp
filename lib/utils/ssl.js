'use strict';

var logger = require('./logger')();

var fs = require('fs');

var readFileSync = function readFileSync(settings) {
  var key;
  var cert;
  var ca = [];

  try {
    key  = fs.readFileSync(settings.key);
    cert = fs.readFileSync(settings.cert);

    // We add CA certs to the ca , as the clients needs to verify the full certificate chain
    settings.ca.forEach(function(caPath) {
      ca.push(fs.readFileSync(caPath));
    });

  } catch (e) {
    logger.error('error reading certificates: '+e);
  }

  // handshakeTimeout 120seconds
  // honorCipherOrder
  // passphrase
  // honorCipherOrder
  // ciphers
  // secureProtocol: SSL Method to use
  var sslOptions = {
    key: key,
    cert: cert,
    ca: ca,
    honorCipherOrder: true
  };

  return sslOptions;
};

module.exports = {
  readFileSync: readFileSync
};
