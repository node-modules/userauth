/*!
 * userauth - lib/userauth.js
 * Copyright(c) 2012 - 2013 fengmk2 <fengmk2@gmail.com>
 * MIT Licensed
 */

"use strict";

/**
 * Module dependencies.
 */

var debug = require('debug')('userauth');
var path = require('path');
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

function formatReferer(req, pathname, rootPath) {
  var query = req.query;
  if (!query) {
    query = urlparse(req.originalUrl || req.url, true).query;
  }
  var referer = query.redirect || req.headers.referer || rootPath;
  referer = typeof referer === 'string' ? referer : rootPath;
  if (referer[0] !== '/') {
    // ignore protocol://xxx/abc
    referer = rootPath;
  } else if (referer.indexOf(pathname) >= 0) {
    referer = rootPath;
  }
  return referer;
}

function login(options) {
  var protocol = options.protocol || 'http';
  var defaultHost = options.host;
  return function (req, res, next) {
    var loginCallbackPath = options.loginCallbackPath;
    var loginPath = options.loginPath;
    // req.session should be exists
    if (req.session) {
      req.session._loginReferer = formatReferer(req, loginPath, options.rootPath);
    }

    var host = defaultHost || req.headers.host;
    var currentURL = protocol + '://' + host + loginCallbackPath;
    var loginURL = options.loginURLForamter(currentURL, options.rootPath);
    redirect(res, loginURL);
  };
}

function loginCallback(options) {
  return function (req, res, next) {
    var referer = req.session._loginReferer || options.rootPath;
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

      if (!user) {
        if (req.headers.referer) {
          // login callback, still not got user, should show error
          err = new Error('Login callback, but still can\'t get the user');
          err.status = 401;
          err.referer = referer;
          debug('loginCallback user not exists error: %s', err);
          return next(err);
        }
        return redirect(res, referer);
      }

      options.loginCallback(req, user, function (err, loginUser, redirectURL) {
        if (err) {
          return next(err);
        }

        req.session[options.userField] = loginUser;
        if (redirectURL) {
          referer = redirectURL;
        }
        redirect(res, referer);
      });
    });
  };
}

function logout(options) {
  return function (req, res, next) {
    var referer = formatReferer(req, options.logoutPath, options.rootPath);
    var user = req.session[options.userField];
    if (!user) {
      return redirect(res, referer);
    }

    options.logoutCallback(req, res, user, function (err, redirectURL) {
      if (err) {
        debug('logoutCallback error: %s', err);
        return next(err);
      }

      req.session[options.userField] = null;
      if (redirectURL) {
        referer = redirectURL;
      }
      redirect(res, referer);
    });
  };
}

/**
 * User auth middleware.
 *
 * @param {Regex|Function(pathname, req)} match, detect which url need to check user auth.
 * @param {Object} [options]
 *  - {Function(url, rootPath)} loginURLForamter, format the login url.
 *  - {String} [rootPath], custom app url root path, default is '/'.
 *  - {String} [loginPath], default is '/login'.
 *  - {String} [loginCallbackPath], default is `options.loginPath + '/callback'`.
 *  - {String} [logoutPath], default is '/logout'.
 *  - {String} [userField], logined user field name on `req.session`, default is 'user', `req.session.user`.
 *  - {String} [protocol] http or https, default is 'http'.
 *  - {String} [host] application hostname and port, default is `req.headers.host`.
 *  - {Function(req, callback)} getUser, get user function, must get user info with `req`.
 *  - {Function(req, user, callback)} [loginCallback], you can handle user login logic here.
 *    - {Function(err, user, redirectURL)} callback
 *  - {Function(req)} [loginCheck], return true meaning logined. default is `true`.
 *  - {Function(req, res, user, callback)} [logoutCallback], you can handle user logout logic here.
 *    - {Function(err, redirectURL)} callback
 * @return {Function(req, res, next)} userauth middleware
 * @public
 */
module.exports = function userauth(match, options) {
  options = options || {};
  options.userField = options.userField || 'user';
  options.rootPath = options.rootPath || '/';
  options.loginPath = options.loginPath || '/login';
  options.loginCallbackPath = options.loginCallbackPath || options.loginPath + '/callback';
  options.logoutPath = options.logoutPath || '/logout';
  if (options.rootPath !== '/') {
    options.loginPath = path.join(options.rootPath, options.loginPath);
    options.logoutPath = path.join(options.rootPath, options.logoutPath);
    options.loginCallbackPath = path.join(options.rootPath, options.loginCallbackPath);
  }
  options.loginURLForamter = options.loginURLForamter;
  options.getUser = options.getUser;

  var defaultRedirectHandler = function (req, res, nextHandler) {
    nextHandler();
  };
  options.redirectHandler = options.redirectHandler || defaultRedirectHandler;

  var needLogin = match;

  if (typeof match === 'string') {
    match = new RegExp('^' + match);
  }

  if (match instanceof RegExp) {
    needLogin = function (pathname, req) {
      return match.test(pathname);
    };
  } else if (typeof match !== 'function') {
    needLogin = function () {};
  }

  var defaultLoginCallback = function (req, user, callback) {
    return callback(null, user, null);
  };
  var defaultLogoutCallback = function (req, res, user, callback) {
    return callback(null, null);
  };

  options.loginCallback = options.loginCallback || defaultLoginCallback;
  options.logoutCallback = options.logoutCallback || defaultLogoutCallback;
  // options.loginCheck = options.loginCheck;

  var loginHandler = login(options);
  var loginCallbackHandler = loginCallback(options);
  var logoutHandler = logout(options);

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

  return function authMiddleware(req, res, next) {
    if (!res.req) {
      res.req = req;
    }

    var url = req.originalUrl || req.url;
    var urlinfo = urlparse(url);
    var pathname = urlinfo.pathname;

    debug('pathname: %s, loginPath: %s, session exists: %s',
      pathname, options.loginPath, !!req.session);

    // 2. GET $loginPath
    if (pathname === options.loginPath) {
      return loginHandler(req, res, next);
    }

    // 3. GET $loginCallbackPath
    if (pathname === options.loginCallbackPath) {
      return loginCallbackHandler(req, res, next);
    }

    // 6. GET $logoutPath
    if (pathname === options.logoutPath) {
      return logoutHandler(req, res, next);
    }

    // not match login required url, next
    if (!needLogin(pathname, req)) {
      return next();
    }

    // req.session not exists
    if (!req.session) {
      return loginHandler(req, res, next);
    }

    if (req.session[options.userField] && (!options.loginCheck || options.loginCheck(req))) {
      // 4. user logined, next() handler
      return next();
    }

    // check user logined or not
    // If user auth token vaild, just getUser() directly
    options.getUser(req, function (err, user) {
      if (err) {
        // ignore this error, because current url is not login callback url
        console.error(err);
        // return next(err);
      }

      if (!user) {
        // 1. redirect to $loginPath
        var nextHandler = function () {
          var redirectURL = url;
          try {
            redirectURL = encodeURIComponent(redirectURL);
          } catch (e) {
            // URIError: URI malformed
            // use source url
          }
          var loginURL = options.loginPath + '?redirect=' + redirectURL;
          redirect(res, loginURL);
        };
        return options.redirectHandler(req, res, nextHandler);
      }

      options.loginCallback(req, user, function (err, loginUser, redirectURL) {
        if (err) {
          return next(err);
        }

        req.session[options.userField] = loginUser;
        if (redirectURL) {
          return redirect(res, redirectURL);
        }
        next();
      });
    });

  };
};
