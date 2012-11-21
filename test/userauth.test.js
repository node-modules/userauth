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
    connect.query(),
    userauth(/^\/user/i, {
      loginURLForamter: function (url) {
        return '/mocklogin?redirect=' + url;
      },
      getUser: function (req, callback) {
        process.nextTick(function () {
          if (req.headers.mockerror) {
            return callback(new Error('mock getUser error'));
          }
          if (req.headers.mockempty) {
            return callback();
          }
          callback(null, {
            nick: 'mock user',
            userid: 1234
          });
        });
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
    .expect(undefined)
    .expect(302, function (err, res) {
      should.not.exist(err);
      var cookie = res.headers['set-cookie'];

      // should login redirect to /
      request(app)
      .get('/login/callback')
      .set('Cookie', cookie)
      .expect('Location', '/')
      .expect(undefined)
      .expect(302, done);
    });

    request(app)
    .get('/login?foo=bar')
    .expect('Location', /^\/mocklogin\?redirect\=/)
    .expect('Location', /\/login\/callback$/)
    .expect(undefined)
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
    .expect(undefined)
    .expect(302, function (err, res) {
      should.not.exist(err);
      var cookie = res.headers['set-cookie'];
      // should login redirect to /
      request(app)
      .get('/login/callback')
      .set('Cookie', cookie)
      .expect('Location', '/')
      .expect(undefined)
      .expect(302, done);
    });

    request(app)
    .get('/login?redirect=/index2')
    .expect('Location', /^\/mocklogin\?redirect\=/)
    .expect('Set-Cookie', /^connect\.sid\=/)
    .expect(undefined)
    .expect(302, function (err, res) {
      should.not.exist(err);
      var cookie = res.headers['set-cookie'];
      // should login redirect to /
      request(app)
      .get('/login/callback')
      .set('Cookie', cookie)
      .expect('Location', '/index2')
      .expect(undefined)
      .expect(302, done);
    });
  });

  it('should login success and visit /user/foo status 200', function (done) {
    request(app)
    .get('/login/callback')
    .expect('Location', '/')
    .expect('Set-Cookie', /^connect\.sid\=/)
    .expect(undefined)
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
    .expect(undefined)
    .expect(302, function (err, res) {
      should.not.exist(err);
      var cookie = res.headers['set-cookie'];
      // should login redirect to /
      request(app)
      .get('/login/callback')
      .set('Cookie', cookie)
      .expect('Location', '/')
      .expect(undefined)
      .expect(302, done);
    });

    request(app)
    .get('/login')
    .set('Referer', 'foo/bar')
    .expect('Location', /^\/mocklogin\?redirect\=/)
    .expect('Set-Cookie', /^connect\.sid\=/)
    .expect(undefined)
    .expect(302, function (err, res) {
      should.not.exist(err);
      var cookie = res.headers['set-cookie'][0];
      // should login redirect to /
      request(app)
      .get('/login/callback')
      .set('Cookie', cookie)
      .expect('Location', '/')
      .expect(undefined)
      .expect(302, done);
    });

    request(app)
    .get('/login')
    .set('Referer', '/foo/bar')
    .expect('Location', /^\/mocklogin\?redirect\=/)
    .expect('Set-Cookie', /^connect\.sid\=/)
    .expect(undefined)
    .expect(302, function (err, res) {
      should.not.exist(err);
      var cookie = res.headers['set-cookie'];
      // should login redirect to /
      request(app)
      .get('/login/callback')
      .set('Cookie', cookie)
      .expect('Location', '/foo/bar')
      .expect(undefined)
      .expect(302, done);
    });

    request(app)
    .get('/login')
    .set('Referer', '/login')
    .expect('Location', /^\/mocklogin\?redirect\=/)
    .expect('Set-Cookie', /^connect\.sid\=/)
    .expect(undefined)
    .expect(302, function (err, res) {
      should.not.exist(err);
      var cookie = res.headers['set-cookie'];
      // should login redirect to /
      request(app)
      .get('/login/callback?foo')
      .set('Cookie', cookie)
      .expect('Location', '/')
      .expect(undefined)
      .expect(302, done);
    });
  });

  it('should redirect to /login when not auth user visit /user* ', function (done) {
    done = pedding(4, done);

    request(app)
    .get('/user')
    .expect('Location', '/login')
    .expect(undefined)
    .expect(302, done);

    request(app)
    .get('/user/foo')
    .set({ Cookie: 'cookie2=' })
    .expect('Location', '/login')
    .expect(undefined)
    .expect(302, done);

    request(app)
    .get('/user/')
    .set({ Cookie: 'cookie2= ;foo=bar' })
    .expect('Location', '/login')
    .expect(undefined)
    .expect(302, done);

    request(app)
    .get('/user?foo=bar')
    .set('Accept', 'application/json')
    .expect('Location', '/login')
    .expect({ error: '401 Unauthorized' })
    .expect(401, done);
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

  it('should return 200 status and user info after user logined', function (done) {
    request(app)
    .get('/login/callback')
    .set({ Cookie: 'cookie2=1234' })
    .expect('Location', '/')
    .expect(302, function (err, res) {
      mm.restore();
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
      .expect('Location', '/login')
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
      .expect('Location', '/login')
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
      .expect('Location', '/login')
      .expect(302, done);
    });
  });

});