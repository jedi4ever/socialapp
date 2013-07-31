var defaults = {
  auth: {
    providers: [
      'twitter',
      'github'
    ],
  },
  lb: {
    port: 7001
  },
  terminated: false,
  secure: false, // Enable https on the socialapp listener
  users: {
    redis: {
      host: '127.0.0.1',
      port: 6379,
      db: 0
    }
  },
  express: {
    session: {
      secret: 'the secret'
    },
    port: 4000
  },
  session: { //connect-redis sessionstore
    key: 'socialapp.sid',
    redis: {
      host: '127.0.0.1',
      port: 6379,
      // ttl: 60*60 // session timeout seconds
      // pass: your pass //pass
      db: 1 //Database index to use

    }
  },
  socketio: {
    config: {
      'browser client minification': true,  // send minificationified client
      'browser client etag': true,          // apply etag  caching logic based on version number
      'browser client gzip': true,          // gzip the file
      'log level': 1,                       // reduce logging
      'transports': [                       // enable all transports (optional if you want flashsocket)
        //'xhr-polling',
        'websocket'
        //, 'flashsocket'
        //, 'htmlfile'
        //, 'jsonp-polling' 
      ],
      //'origins': '*:*', //defaults to *:*'
      'match origin protocol': true        // match origin protocol defaults to false (proxy used?) settings.terminated?
      // Meant to be used when running socket.io behind a proxy. 
      // Should be set to true when you want the location handshake to match the protocol of the origin. 
      // This fixes issues with terminating the SSL in front of Node and forcing location to think it's wss instead of ws.
    },
    redis: {
      host: '127.0.0.1',
      port: 6379,
      db: 2
    }
  },
  ssl: {
    ca: []
  },
  log: {
    level: 'debug',
    mute: true
  },
  metrics: {
    mock: false
  }
};

module.exports = defaults;
