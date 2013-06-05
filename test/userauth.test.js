/*!
 * userauth - test/userauth.test.js
 * Copyright(c) 2012 fengmk2 <fengmk2@gmail.com>
 * MIT Licensed
 */

"use strict";

/**
 * Module dependencies.
 */

var pedding = require('pedding');
var mm = require('mm');
var userauth = require('../');
var should = require('should');
var request = require('supertest');
var connect = require('connect');


describe('userauth.test.js', function () {
  var app = connect(
    connect.cookieParser(),
    connect.session({
      secret: 'i m secret'
    }),
    // connect.query(),
    userauth(/^\/user/i, {
      loginURLForamter: function (url) {
        return '/mocklogin?redirect=' + url;
      },
      getUser: function (req, callback) {
        process.nextTick(function () {
          if (req.headers.mockerror) {
            var err = new Error('mock getUser error');
            err.data = {url: req.url};
            return callback(err);
          }
          if (req.headers.mockempty) {
            return callback();
          }
          var user = req.session.user;
          if (req.headers.mocklogin) {
            user = {
              nick: 'mock user',
              userid: 1234
            };
          }

          if (req.headers.mocklogin_redirect) {
            user.loginRedirect = req.headers.mocklogin_redirect;
          }

          if (req.headers.mocklogin_callbackerror) {
            user.loginError = req.headers.mocklogin_callbackerror;
          }

          if (req.headers.mocklogout_redirect) {
            user.logoutRedirect = req.headers.mocklogout_redirect;
          }

          if (req.headers.mocklogout_callbackerror) {
            user.logoutError = req.headers.mocklogout_callbackerror;
          }

          return callback(null, user);
        });
      },
      loginCallback: function (req, user, callback) {
        process.nextTick(function () {
          if (user.loginError) {
            return callback(new Error(user.loginError));
          }
          callback(null, user, user.loginRedirect);
        });
      },
      logoutCallback: function (req, res, user, callback) {
        process.nextTick(function () {
          res.setHeader('X-Logout', 'logoutCallback header')
          if (user.logoutError) {
            return callback(new Error(user.logoutError));
          }
          callback(null, user.logoutRedirect);
        });
      },
      redirectHandler: function (req, res, next) {
        var accept = req.headers.accept;
        if (accept && accept.indexOf('/javascript') > 0) {
          // jsonp
          var jsonpCallback = 'jsonpCallback';
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/javascript');
          return res.end('jsonpCallback(' + JSON.stringify({ login: false, success: false, message: 'Login first.' }) + ')');
        }
        next();
      },
    })
  );

  app.use('/mocklogin', function (req, res, next) {
    var redirect = req.query.redirect;
    res.statusCode = 302;
    res.setHeader('Location', redirect);
    res.end();
  });

  app.use(function (req, res, next) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      user: req.session.user || null,
      message: req.method + ' ' + req.url
    }));
  });

  app.use(function (err, req, res, next) {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 500;
    res.end(JSON.stringify({
      error: err.message,
      message: req.method + ' ' + req.url
    }));
  });

  afterEach(function () {
    mm.restore();
  });

  it('should request /login redirect to /mocklogin', function (done) {
    done = pedding(5, done);

    request(app)
    .get('/login')
    .expect('Location', /^\/mocklogin\?redirect\=/)
    .expect('Location', /\/login\/callback$/)
    .expect('Set-Cookie', /^connect\.sid\=/)
    .expect('')
    .expect(302, function (err, res) {
      should.not.exist(err);
      var cookie = res.headers['set-cookie'];

      // should login redirect to /
      request(app)
      .get('/login/callback')
      .set('Cookie', cookie)
      .expect('Location', '/')
      .expect('')
      .expect(302, done);
    });

    request(app)
    .get('/login?foo=bar')
    .expect('Location', /^\/mocklogin\?redirect\=/)
    .expect('Location', /\/login\/callback$/)
    .expect('')
    .expect(302, done);

    request(app)
    .get('/login?foo=bar')
    .set('Accept', 'application/json')
    .expect('Location', /^\/mocklogin\?redirect\=/)
    .expect({ error: '401 Unauthorized' })
    .expect(401, done);

    request(app)
    .get('/login?redirect=user/index')
    .expect('Location', /^\/mocklogin\?redirect\=/)
    .expect('Set-Cookie', /^connect\.sid\=/)
    .expect('')
    .expect(302, function (err, res) {
      should.not.exist(err);
      var cookie = res.headers['set-cookie'];
      // should login redirect to /
      request(app)
      .get('/login/callback')
      .set('Cookie', cookie)
      .expect('Location', '/')
      .expect('')
      .expect(302, done);
    });

    request(app)
    .get('/login?redirect=/index2')
    .expect('Location', /^\/mocklogin\?redirect\=/)
    .expect('Set-Cookie', /^connect\.sid\=/)
    .expect('')
    .expect(302, function (err, res) {
      should.not.exist(err);
      var cookie = res.headers['set-cookie'];
      // should login redirect to /
      request(app)
      .get('/login/callback')
      .set('Cookie', cookie)
      .expect('Location', '/index2')
      .expect('')
      .expect(302, done);
    });
  });

  it('should login success and visit /user/foo status 200', function (done) {
    request(app)
    .get('/login/callback')
    .set('mocklogin', 1)
    .expect('Location', '/')
    .expect('Set-Cookie', /^connect\.sid\=/)
    .expect('')
    .expect(302, function (err, res) {
      var cookie = res.headers['set-cookie'][0];
      request(app)
      .get('/user/foo')
      .set('Cookie', cookie)
      .expect({"user":{"nick":"mock user","userid":1234},"message":"GET /user/foo"})
      .expect(200, done);
    });
  });

  it('should login callback redirect success with referer', function (done) {
    done = pedding(4, done);

    request(app)
    .get('/login?redirect=')
    .set('Referer', 'http://demo.com/foo')
    .expect('Location', /^\/mocklogin\?redirect\=/)
    .expect('Set-Cookie', /^connect\.sid\=/)
    .expect('')
    .expect(302, function (err, res) {
      should.not.exist(err);
      var cookie = res.headers['set-cookie'];
      // should login redirect to /
      request(app)
      .get('/login/callback')
      .set('Cookie', cookie)
      .set('mocklogin', 1)
      .expect('Location', '/')
      .expect('')
      .expect(302, done);
    });

    request(app)
    .get('/login')
    .set('Referer', 'foo/bar')
    .expect('Location', /^\/mocklogin\?redirect\=/)
    .expect('Set-Cookie', /^connect\.sid\=/)
    .expect('')
    .expect(302, function (err, res) {
      should.not.exist(err);
      var cookie = res.headers['set-cookie'][0];
      // should login redirect to /
      request(app)
      .get('/login/callback')
      .set('Cookie', cookie)
      .set('mocklogin', 1)
      .expect('Location', '/')
      .expect('')
      .expect(302, done);
    });

    request(app)
    .get('/login')
    .set('Referer', '/foo/bar')
    .expect('Location', /^\/mocklogin\?redirect\=/)
    .expect('Set-Cookie', /^connect\.sid\=/)
    .expect('')
    .expect(302, function (err, res) {
      should.not.exist(err);
      var cookie = res.headers['set-cookie'];
      // should login redirect to /
      request(app)
      .get('/login/callback')
      .set('Cookie', cookie)
      .set('mocklogin', 1)
      .expect('Location', '/foo/bar')
      .expect('')
      .expect(302, done);
    });

    request(app)
    .get('/login')
    .set('Referer', '/login')
    .expect('Location', /^\/mocklogin\?redirect\=/)
    .expect('Set-Cookie', /^connect\.sid\=/)
    .expect('')
    .expect(302, function (err, res) {
      should.not.exist(err);
      var cookie = res.headers['set-cookie'];
      // should login redirect to /
      request(app)
      .get('/login/callback?foo')
      .set('Cookie', cookie)
      .set('mocklogin', 1)
      .expect('Location', '/')
      .expect('')
      .expect(302, done);
    });
  });

  it('should redirect to /login when not auth user visit /user* ', function (done) {
    done = pedding(4, done);

    request(app)
    .get('/user')
    .expect('Location', '/login?redirect=%2Fuser')
    .expect('')
    .expect(302, done);

    // fixed: encodeURIComponent(url) error: URIError: URI malformed
    request(app)
    .get('/user/' + String.fromCharCode(0xDFFF))
    .expect('Location', '/login?redirect=/user/' + String.fromCharCode(0xDFFF))
    .expect('')
    .expect(302, done);

    request(app)
    .get('/user/foo')
    .set({ Cookie: 'cookie2=' })
    .expect('Location', '/login?redirect=%2Fuser%2Ffoo')
    .expect('')
    .expect(302, done);

    request(app)
    .get('/user/')
    .set({ Cookie: 'cookie2= ;foo=bar' })
    .expect('Location', '/login?redirect=%2Fuser%2F')
    .expect('')
    .expect(302, done);

    request(app)
    .get('/user?foo=bar')
    .set('Accept', 'application/json')
    .expect('Location', '/login?redirect=%2Fuser%3Ffoo%3Dbar')
    .expect({ error: '401 Unauthorized' })
    .expect(401, done);

    request(app)
    .get('/user?foo=bar')
    .set('Accept', 'text/javascript, application/javascript, application/ecmascript, application/x-ecmascript, */*; q=0.01')
    .expect('jsonpCallback({"login":false,"success":false,"message":"Login first."})')
    .expect(200, done);
  });

  it('should 200 status when request url no need to login', function (done) {
    done = pedding(3, done);

    request(app)
    .get('/')
    .expect({
      user: null,
      message: 'GET /'
    })
    .expect(200, done);

    request(app)
    .get('/use')
    .set({ Cookie: 'cookie2=' })
    .expect({
      user: null,
      message: 'GET /use'
    })
    .expect(200, done);

    request(app)
    .get('/use/foo/bar')
    .set({ Cookie: 'cookie2= ;foo=bar' })
    .expect({
      user: null,
      message: 'GET /use/foo/bar'
    })
    .expect(200, done);
  });

  it('should login directly when use contain logined token', function (done) {
    request(app)
    .get('/user/foo')
    .set('mocklogin', 1)
    .expect({"user":{"nick":"mock user","userid":1234},"message":"GET /user/foo"})
    .expect(200, done);
  });

  it('should return 302 when getUser directly', function (done) {
    request(app)
    .get('/user/foo')
    .set('mockerror', 1)
    .expect('Location', '/login?redirect=%2Fuser%2Ffoo')
    .expect(302, done);
  });

  it('should return 200 status and user info after user logined', function (done) {
    request(app)
    .get('/login/callback')
    .set('mocklogin', 1)
    .expect('Location', '/')
    .expect(302, function (err, res) {
      should.not.exist(err);
      var cookie = res.headers['set-cookie'];
      request(app)
      .get('/')
      .set({ Cookie: 'cookie2=1234; ' + cookie })
      .expect({
        user: {
          nick: 'mock user',
          userid: 1234
        },
        message: 'GET /'
      })
      .expect(200, function (err, res) {
        // logout
        should.not.exist(err);
        request(app)
        .get('/logout')
        .set({ Cookie: 'cookie2=1234; ' + cookie })
        .expect('Location', '/')
        .expect(302, function () {
          request(app)
          .get('/logout')
          .set({ referer: '/login' })
          .expect('Location', '/login')
          .expect(302, done);
        });
      });
    });
  });

  it('should return 302 to / what ever visit logincallback', function (done) {
    request(app)
    .get('/login/callback')
    .set('mocklogin', 1)
    .expect('Location', '/')
    .expect(302, function (err, res) {
      should.not.exist(err);
      var cookie = res.headers['set-cookie'];
      var times = 10;
      done = pedding(times, done);
      for (var i = 0; i < times; i++) {
        request(app)
        .get('/login/callback')
        .set('Cookie', cookie)
        .expect('Location', '/')
        .expect(302, done);
      }      
    });
  });

  it('should return error when /login/callback request session proxy error', function (done) {
    request(app)
    .get('/login/callback')
    .set({ mockerror: 'true' })
    .expect({
      error: 'mock getUser error',
      message: 'GET /login/callback'
    })
    .expect(500, done);
  });

  it('should user login fail when getUser return empty', function (done) {
    done = pedding(2, done);

    request(app)
    .get('/login/callback')
    .set({ mockempty: '1' })
    .expect('Location', '/')
    .expect(302, function (err, res) {
      var cookie = res.headers['set-cookie'];
      request(app)
      .get('/user/')
      .set({ Cookie: cookie })
      .expect('Location', '/login?redirect=%2Fuser%2F')
      .expect(302, done);
    });

    request(app)
    .get('/login/callback')
    .set({ Cookie: 'cookie2=wrong', mockempty: '1' })
    .set('Accept', 'application/json')
    .expect('Location', '/')
    .expect({ error: '401 Unauthorized' })
    .expect(401, function (err, res) {
      var cookie = res.headers['set-cookie'];
      request(app)
      .get('/user/')
      .set({ Cookie: cookie })
      .expect('Location', '/login?redirect=%2Fuser%2F')
      .expect(302, done);
    });
  });

  it('should logout success', function (done) {
    done = pedding(4, done);

    request(app)
    .get('/logout')
    .set({ Cookie: 'cookie2=1234' })
    .expect('Location', '/')
    .expect(302, done);

    request(app)
    .get('/logout?redirect=/foo')
    .set({ Cookie: 'cookie2=1234' })
    .expect('Location', '/foo')
    .expect(302, done);

    request(app)
    .get('/logout?redirect=foo')
    .set({ Cookie: 'cookie2=1234' })
    .expect('Location', '/')
    .expect(302, done);

    request(app)
    .get('/logout')
    .set('Referer', '/logout?foo=bar')
    .set({ Cookie: 'cookie2=1234' })
    .expect('Location', '/')
    .expect(302, done);
  });

  it('should logout redirect to login page when the referer require user auth', function (done) {
    request(app)
    .get('/logout')
    .set('Referer', '/user/article')
    .set({ Cookie: 'cookie2=1234' })
    .expect('Location', '/user/article')
    .expect(302, function (err, res) {
      var cookie = res.headers['set-cookie'];
      request(app)
      .get('/user/article')
      .set({ Cookie: cookie })
      .expect('Location', '/login?redirect=%2Fuser%2Farticle')
      .expect(302, done);
    });
  });

  it('should mock loginCallback error', function (done) {
    request(app)
    .get('/login/callback')
    .set('mocklogin', 1)
    .set('mocklogin_callbackerror', 'mock login callback error')
    .expect({
      error: 'mock login callback error',
      message: 'GET /login/callback'
    })
    .expect(500, done);
  });

  it('should mock loginCallback redirect to new url', function (done) {
    request(app)
    .get('/login/callback')
    .set('mocklogin', 1)
    .set('mocklogin_redirect', '/newurl')
    .expect('Location', '/newurl')
    .expect('')
    .expect(302, done);
  });

  it('should directly login with mock loginCallback redirect to new url', function (done) {
    request(app)
    .get('/user')
    .set('mocklogin', 1)
    .set('mocklogin_redirect', '/user/newurl')
    .expect('Location', '/user/newurl')
    .expect(302, done);
  });

  it('should mock logoutCallback error', function (done) {
    request(app)
    .get('/user/foo')
    .set('mocklogin', 1)
    .set('mocklogout_callbackerror', 'mock logout callback error')
    .expect('X-Logout', 'logoutCallback header')
    .expect(302, function (err, res) {
      var cookie = res.headers['set-cookie'][0];
      request(app)
      .get('/logout')
      .set('Cookie', cookie)
      .expect({
        error: 'mock logout callback error',
        message: 'GET /logout'
      })
      .expect(500, done);
    });
  });

  it('should mock loginCallback error', function (done) {
    request(app)
    .get('/user/foo')
    .set('mocklogin', 1)
    .set('mocklogin_callbackerror', 'mock login callback error')
    .expect({
      error: 'mock login callback error',
      message: 'GET /user/foo'
    })
    .expect(500, done);
  });

  it('should mock logoutCallback redirect to new url', function (done) {
    request(app)
    .get('/user/foo')
    .set('mocklogin', 1)
    .set('mocklogout_redirect', '/user/foo/newurl')
    .end(function (err, res) {
      should.not.exist(err);
      res.statusCode.should.equal(200);
      var cookie = res.headers['set-cookie'][0];
      request(app)
      .get('/logout')
      .set('Cookie', cookie)
      .expect('Location', '/user/foo/newurl')
      .expect(302, done);
    });
  });

  describe('with options.rootPath = "/hello/world"', function () {
    var app = connect(
      connect.cookieParser(),
      connect.session({
        secret: 'i m secret'
      }),
      userauth(/^\/user/i, {
        loginURLForamter: function (url, rootPath) {
          return rootPath + '/mocklogin?redirect=' + url;
        },
        rootPath: '/hello/world',
        getUser: function (req, callback) {
          process.nextTick(function () {
            var user = req.session.user;
            if (req.headers.mocklogin) {
              user = {
                nick: 'mock user',
                userid: 1234
              };
            }
            callback(null, user);
          });
        }
      })
    );

    app.use('/mocklogin', function (req, res, next) {
      var redirect = req.query.redirect;
      res.statusCode = 302;
      res.setHeader('Location', redirect);
      res.end();
    });

    app.use(function (req, res, next) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        user: req.session.user || null,
        message: req.method + ' ' + req.url
      }));
    });

    app.use(function (err, req, res, next) {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 500;
      res.end(JSON.stringify({
        error: err.message,
        message: req.method + ' ' + req.url
      }));
    });

    it('should 302 to mock login', function (done) {
      request(app)
      .get('/login')
      .expect('Location', /^\/hello\/world\/mocklogin\?redirect\=http\:\/\/127\.0\.0\.1\:\d+\/hello\/world\/login\/callback$/)
      .expect(302, done);
    });

    it('should return 200 status and user info after user logined', function (done) {
      request(app)
      .get('/login/callback')
      .set('mocklogin', 1)
      .expect('Location', '/hello/world')
      .expect(302, function (err, res) {
        should.not.exist(err);
        var cookie = res.headers['set-cookie'];
        request(app)
        .get('/')
        .set({ Cookie: 'cookie2=1234; ' + cookie })
        .expect({
          user: {
            nick: 'mock user',
            userid: 1234
          },
          message: 'GET /'
        })
        .expect(200, function (err, res) {
          // logout
          should.not.exist(err);
          request(app)
          .get('/logout')
          .set({ Cookie: 'cookie2=1234; ' + cookie })
          .expect('Location', '/hello/world')
          .expect(302, function () {
            request(app)
            .get('/logout?a=2')
            .set({ referer: '/hello/world/app' })
            .expect('Location', '/hello/world/app')
            .expect(302, done);
          });
        });
      });
    });

    it('should redirect to /login when not auth user visit /user* ', function (done) {
      done = pedding(4, done);

      request(app)
      .get('/user')
      .expect('Location', '/hello/world/login?redirect=%2Fuser')
      .expect('')
      .expect(302, done);

      request(app)
      .get('/user/foo')
      .set({ Cookie: 'cookie2=' })
      .expect('Location', '/hello/world/login?redirect=%2Fuser%2Ffoo')
      .expect('')
      .expect(302, done);

      request(app)
      .get('/user/')
      .set({ Cookie: 'cookie2= ;foo=bar' })
      .expect('Location', '/hello/world/login?redirect=%2Fuser%2F')
      .expect('')
      .expect(302, done);

      request(app)
      .get('/user?foo=bar')
      .set('Accept', 'application/json')
      .expect('Location', '/hello/world/login?redirect=%2Fuser%3Ffoo%3Dbar')
      .expect({ error: '401 Unauthorized' })
      .expect(401, done);
    });

  });

  describe('with default options', function () {
    var app = connect(
      connect.cookieParser(),
      connect.session({
        secret: 'i m secret'
      }),
      // connect.query(),
      userauth(/^\/user/i, {
        loginURLForamter: function (url) {
          return '/mocklogin?redirect=' + url;
        },
        getUser: function (req, callback) {
          process.nextTick(function () {
            var user = req.session.user;
            if (req.headers.mocklogin) {
              user = {
                nick: 'mock user',
                userid: 1234
              };
            }
            callback(null, user);
          });
        }
      })
    );

    app.use('/mocklogin', function (req, res, next) {
      var redirect = req.query.redirect;
      res.statusCode = 302;
      res.setHeader('Location', redirect);
      res.end();
    });

    app.use(function (req, res, next) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        user: req.session.user || null,
        message: req.method + ' ' + req.url
      }));
    });

    app.use(function (err, req, res, next) {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 500;
      res.end(JSON.stringify({
        error: err.message,
        message: req.method + ' ' + req.url
      }));
    });

    it('should 302 to mock login', function (done) {
      request(app)
      .get('/login')
      .expect('Location', /^\/mocklogin\?redirect/)
      .expect(302, done);
    });

    it('should return 200 status and user info after user logined', function (done) {
      request(app)
      .get('/login/callback')
      .set('mocklogin', 1)
      .expect('Location', '/')
      .expect(302, function (err, res) {
        should.not.exist(err);
        var cookie = res.headers['set-cookie'];
        request(app)
        .get('/')
        .set({ Cookie: 'cookie2=1234; ' + cookie })
        .expect({
          user: {
            nick: 'mock user',
            userid: 1234
          },
          message: 'GET /'
        })
        .expect(200, function (err, res) {
          // logout
          should.not.exist(err);
          request(app)
          .get('/logout')
          .set({ Cookie: 'cookie2=1234; ' + cookie })
          .expect('Location', '/')
          .expect(302, function () {
            request(app)
            .get('/logout')
            .set({ referer: '/login' })
            .expect('Location', '/login')
            .expect(302, done);
          });
        });
      });
    });

    it('should redirect to /login when not auth user visit /user* ', function (done) {
      done = pedding(4, done);

      request(app)
      .get('/user')
      .expect('Location', '/login?redirect=%2Fuser')
      .expect('')
      .expect(302, done);

      request(app)
      .get('/user/foo')
      .set({ Cookie: 'cookie2=' })
      .expect('Location', '/login?redirect=%2Fuser%2Ffoo')
      .expect('')
      .expect(302, done);

      request(app)
      .get('/user/')
      .set({ Cookie: 'cookie2= ;foo=bar' })
      .expect('Location', '/login?redirect=%2Fuser%2F')
      .expect('')
      .expect(302, done);

      request(app)
      .get('/user?foo=bar')
      .set('Accept', 'application/json')
      .expect('Location', '/login?redirect=%2Fuser%3Ffoo%3Dbar')
      .expect({ error: '401 Unauthorized' })
      .expect(401, done);
    });

  });

});