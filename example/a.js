var path = require('path');
var SocialApp = require('./lib/socialapp.js');
var testConfig = {
  log: {
    mute: false,
    level: 'debug'
  },

  ssl: {
    //key: path.join(__dirname,'..','conf','server_key.pem'),
    //cert: path.join(__dirname,'..','conf','server_cert.pem')
    key: path.join(__dirname,'conf','localhost.pem'),
    cert: path.join(__dirname,'conf','localhost-cert.pem'),
    ca: []
  }
}

var socialApp = new SocialApp(testConfig);


var app = socialApp.express;

var io = socialApp.socketio;
var testPath = '/hello.txt';
var content = 'Hello World';

app.get(testPath, function(req, res){
  res.send(content);
});
