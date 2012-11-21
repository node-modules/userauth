userauth [![Build Status](https://secure.travis-ci.org/fengmk2/userauth.png)](http://travis-ci.org/fengmk2/userauth)
=======

![logo](https://raw.github.com/fengmk2/userauth/master/logo.png)

user auth abstraction layer middleware.

* jscoverage: [100%](http://fengmk2.github.com/coverage/userauth.html)

## Install

```bash
$ npm install userauth
```

## Usage

```js
var connect = require('connect');
var userauth = require('userauth');

var app = connect(
  connect.cookieParser(),
  connect.session({
    secret: 'i m secret'
  }),
  connect.query(),
  // /user* all these urls must login first
  userauth(/^\/user/i, {
    // auth system login url
    loginURLForamter: function (url) {
      return 'http://login.demo.com/login?redirect=' + url;
    },
    // login callback and getUser info handler
    getUser: function (req, callback) {
      var token = req.query.token;
      proxy.checkToken(token, function (err, info) {
        if (err) {
          return callback(err);
        }
        callback(null, info);
      });
    },
  })
);
```

## License 

(The MIT License)

Copyright (c) 2012 fengmk2 &lt;fengmk2@gmail.com&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.