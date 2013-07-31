## Description
__note alpha state  use as code inspiration currently__

simple project that will take care of:

- setting up an express server
  - with csrf
  - with helmet
  - using redis session store
  - with passportjs for github and twitter login

- setting up an socket io
  - redis session store
  - can reuse sessions from express for login
  - works behind proxy

- work behind a loadbalancer (haproxy)
  - ssl termination is correct
  - good ciphers check enabled

- has metrics integrated (statsd)
- has integrated loggers (winston)

- all errors are handled
- works with socket.io-client & websockets

## Usage

Intended use is like this (not 100% accurate code now)

    var SocialApp = require('socialapp');
    var socialApp = new SocialApp(options);
    var socialExpress = sociallApp.express;
    var socialSocketio = sociallApp.socketIO;

Now you can extend it by adding your routes or socket handlers to both socialExpress & socialSocketio

emits events 'error','started','stopped'

## Future/Todo

- integrate with cluster
