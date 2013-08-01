'use strict';

// http://codetheory.in/using-the-node-js-bcrypt-module-to-hash-and-safely-store-passwords/
var uuid = require('node-uuid');
var bcrypt = require('bcrypt');

var rounds = 5;

var keys = function() {

  var genKeySync = function genKeySync() {
    var secret = uuid.v4();
    return secret;
  };

  var hashSync = function hashSync(key) {
    var hash = bcrypt.hashSync(key, rounds);
    return hash;
  };

  var compareSync = function compareSync(key,hash) {
    var result = bcrypt.compareSync(key, hash);
    return result;
  };

  //Exportable public functions
  return {
    genKeySync: genKeySync,
    hashSync: hashSync,
    compareSync: compareSync
  } ;
}() ;

module.exports = keys;
