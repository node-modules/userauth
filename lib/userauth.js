/*!
 * userauth - lib/userauth.js
 * Copyright(c) 2012 fengmk2 <fengmk2@gmail.com>
 * MIT Licensed
 */

"use strict";

/**
 * Module dependencies.
 */

var urlparse = require('url').parse;

/**
 * Send redirect response.
 * 
 * @param  {Response} res, http.Response instance
 * @param  {String} url, redirect URL
 * @param  {Number|String} status, response status code, default is `302`
 * @api public
 */
var redirect = function (res, url, status) {
  status = status === 301 ? 301 : 302;
  res.setHeader('Location', url);

  var body = '';
  var accept = (res.req.headers && res.req.headers.accept) || '';
  if (accept.indexOf('json') >= 0) {
    status = 401;
    res.setHeader('Content-Type', 'application/json');
    body = JSON.stringify({ error: '401 Unauthorized' });
  }
  res.statusCode = status;
  res.end(body);
};

function formatReferer(req, pathname) {
  var referer = (req.query && req.query.redirect) || req.headers.referer || '/';
  referer = typeof referer === 'string' ? referer : '/';
  if (referer[0] !== '/') {
    // ignore http://xxx/abc
    referer = '/';
  } else if (referer.indexOf(pathname) >= 0) {
    referer = '/';
  }
  return referer;
}

function login(options) {
  return function (req, res, next) {
    req.session._loginReferer = formatReferer(req, options.loginPath);
    var currentURL = 'http://' + req.headers.host + options.loginCallbackPath;    
    var loginURL = options.loginURLForamter(currentURL);
    redirect(res, loginURL);
  };
}

function loginCallback(options) {
  return function (req, res, next) {
    var referer = req.session._loginReferer || '/';
    var user = req.session[options.userField];
    if (user) {
      // already login
      return redirect(res, referer);
    }
    options.getUser(req, function (err, user) {
      if (err) {
        // 5. get user error, next(err)
        return next(err);
      }
      req.session[options.userField] = user;
      redirect(res, referer);
    });
  };
}

function logout(options) {
  return function (req, res, next) {
    req.session[options.userField] = null;
    var referer = formatReferer(req, options.logoutPath);
    return redirect(res, referer);
  };
}

/**
 * User auth middleware.
 *
 * @param {Regex} match, detect which url need to check user auth.
 * @param {Object} [options]
 *  - {String} [loginPath], default is '/login'.
 *  - {String} [logoutPath], default is '/logout'.
 *  - {Function(url)} loginURLForamter, format the login url.
 *  - {String} [userField], logined user field name on `req.session`, default is 'user', `req.session.user`.
 *  - {Function(req, callback)} getUser, get user function, must get user info with `req`.
 * @return {Function(req, res, next)}
 * @public
 */
module.exports = function userauth(match, options) {
  options = options || {};
  options.userField = options.userField || 'user';
  options.loginPath = options.loginPath || '/login';
  options.loginCallbackPath = options.loginCallbackPath || options.loginPath + '/callback';
  options.logoutPath = options.logoutPath || '/logout';
  options.loginURLForamter = options.loginURLForamter;
  options.getUser = options.getUser;
  options.match = match;

  var loginHandler = login(options);
  var loginCallbackHandler = loginCallback(options);
  var logoutHandler = logout(options);

  /**
   * 登录流程:
   *
   * 1. 用户未登录，自动跳转到 $loginPath?redirect=$currentURL
   * 2. 请求 $loginPath，跳转到登录页面
   * 3. 请求 $loginCallbackPath，处理登录后跳转
   * 4. 用户登录成功，设置 req.session[userField]，next()
   * 5. 登录异常，next(err)
   * 6. 登出 $logoutPath
   * 7. 如果登出的referer也是需要登录的，那么直接跳到登录页面
   */

  return function authMiddleware(req, res, next) {
    if (!res.req) {
      res.req = req;
    }

    var url = req.originalUrl || req.url;
    var urlinfo = urlparse(url);

    // 2. GET $loginPath
    if (urlinfo.pathname === options.loginPath) {
      return loginHandler(req, res, next);
    }

    // 3. GET $loginCallbackPath
    if (urlinfo.pathname === options.loginCallbackPath) {
      return loginCallbackHandler(req, res, next);
    }

    // 6. GET $logoutPath
    if (urlinfo.pathname === options.logoutPath) {
      return logoutHandler(req, res, next);
    }

    if (!match.test(urlinfo.pathname)) {
      return next();
    }

    if (req.session[options.userField]) {
      // 4. user logined, next() handler
      return next();
    }

    // 1. redirect to $loginPath
    redirect(res, options.loginPath);
  };
};
