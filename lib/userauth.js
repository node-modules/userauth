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

      if (!user) {
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
    var referer = formatReferer(req, options.logoutPath);
    var user = req.session[options.userField];
    if (!user) {
      return redirect(res, referer);
    }

    options.logoutCallback(req, res, user, function (err, redirectURL) {
      if (err) {
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
 *  - {Function(url)} loginURLForamter, format the login url.
 *  - {String} [loginPath], default is '/login'.
 *  - {String} [loginCallbackPath], default is `options.loginPath + '/callback'`.
 *  - {String} [logoutPath], default is '/logout'.
 *  - {String} [userField], logined user field name on `req.session`, default is 'user', `req.session.user`.
 *  - {Function(req, callback)} getUser, get user function, must get user info with `req`.
 *  - {Function(req, user, callback)} [loginCallback], you can handle user login logic here.
 *   - {Function(err, user, redirectURL)} callback
 *  - {Function(req, res, user, callback)} [logoutCallback], you can handle user logout logic here.
 *   - {Function(err, redirectURL)} callback
 * @return {Function(req, res, next)} userauth middleware
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

  var needLogin = match;

  if (match instanceof RegExp) {
    needLogin = function (pathname, req) {
      return match.test(pathname);
    };
  }

  var defaultLoginCallback = function (req, user, callback) {
    return callback(null, user, null);
  };
  var defaultLogoutCallback = function (req, res, user, callback) {
    return callback(null, null);
  };
  options.loginCallback = options.loginCallback || defaultLoginCallback;
  options.logoutCallback = options.logoutCallback || defaultLogoutCallback;

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

    if (!needLogin(urlinfo.pathname, req)) {
      return next();
    }

    if (req.session[options.userField]) {
      // 4. user logined, next() handler
      return next();
    }

    // check user logined or not
    // If user auth token vaild, just getUser() directly
    options.getUser(req, function (err, user) {
      if (err) {
        return next(err);
      }

      if (!user) {
        // 1. redirect to $loginPath
        return redirect(res, options.loginPath + '?redirect=' + encodeURIComponent(url));
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
