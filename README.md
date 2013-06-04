userauth [![Build Status](https://secure.travis-ci.org/fengmk2/userauth.png)](http://travis-ci.org/fengmk2/userauth)
=======

![logo](https://raw.github.com/fengmk2/userauth/master/logo.png)

`connect` user auth abstraction layer middleware.

* jscoverage: [97%](http://fengmk2.github.com/coverage/userauth.html)

## Install

```bash
$ npm install userauth
```

## Usage

`userauth` is dependent on `connect.session()` and `connect.query()`.

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

### Arguments

```js
/**
 * User auth middleware.
 *
 * @param {Regex|Function(pathname, req)} match, detect which url need to check user auth.
 * @param {Object} [options]
 *  - {Function(url)} loginURLForamter, format the login url.
 *  - {String} [loginPath], default is '/login'.
 *  - {String} [loginCallbackPath], default is `options.loginPath + '/callback'`.
 *  - {String} [logoutPath], default is '/logout'.
 *  - {String} [userField], logined user field name on `req.session`, default is 'user', `req.session.user`.
 *  - {Function(req, callback)} getUser, get user function, must get user info with `req`.
 *  - {Function(req, user, callback)} [loginCallback], you can handle user login logic here.
 *   - {Function(err, user, redirectURL)} callback
 *  - {Function(req, user, callback)} [logoutCallback], you can handle user logout logic here.
 *   - {Function(err, redirectURL)} callback
 * @return {Function(req, res, next)} userauth middleware
 * @public
 */
function userauth(match, options);
```

## Login flow

```js
/**
 * login flow:
 *
 * 1. unauth user, redirect to `$loginPath?redirect=$currentURL`
 * 2. user visit `$loginPath`, redirect to `options.loginURLForamter()` return login url.
 * 3. user visit $loginCallbackPath, handler login callback logic.
 * 4. If user login callback check success, will set `req.session[userField]`, 
 *    and redirect to `$currentURL`.
 * 5. If login check callback error, next(err).
 * 6. user visit `$logoutPath`, set `req.session[userField] = null`, and redirect back.
 */
```

## Authors

```bash
$ git summary 

 project  : userauth
 repo age : 5 months
 active   : 10 days
 commits  : 33
 files    : 12
 authors  : 
    32  fengmk2                 97.0%
     1  tangyao                 3.0%
```

## License 

(The MIT License)

Copyright (c) 2012 - 2013 fengmk2 &lt;fengmk2@gmail.com&gt;

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