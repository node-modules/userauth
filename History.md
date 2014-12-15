
1.0.1 / 2014-12-15
==================

 * make sure session key dont start with '_'
 * add logout with redirect param test case

1.0.0 / 2014-08-13
==================

 * fix deadlock redirect when getUser return empty user

0.3.0 / 2014-02-21 
==================

  * fix rootPath !== "/" bug
  * add npm image
  * fixed test cases

0.2.5 / 2013-07-08 
==================

  * add custom host

0.2.4 / 2013-07-05 
==================

  * support custom protocol
  * support coveralls

0.2.3 / 2013-06-05 
==================

  * ignore err when current url is not login callback url

0.2.2 / 2013-06-04 
==================

  * use blanket instead of jscover
  * only modified response Location when using custom rootPath
  * support custom rootPath fixed #4
  * not support 0.6

0.2.1 / 2013-04-23 
==================

  * fixed #3 `req.session` missing

0.2.0 / 2013-04-17 
==================

  * fixed: encodeURIComponent(url) error: URIError: URI malformed

0.1.5 / 2013-01-16 
==================

  * add custom logined check

0.1.4 / 2013-01-08 
==================

  * add custom redirect handler

0.1.3 / 2013-01-08 
==================

  * Merge pull request #2 from coolme200/fix-needLogin-notfun-err
  * 修复needLogin非function错误

0.1.2 / 2013-01-05 
==================

  * fixed urlparse().query

0.1.1 / 2013-01-05 
==================

  * fixed test cases
  * fixed #1 remove connet.query() dependency.

0.1.0 / 2012-12-20 
==================

  * change logoutCallback: function (req, res, user, callback)
  * update readme

0.0.8 / 2012-11-23 
==================

  * match support function

0.0.7 / 2012-11-23 
==================

  * login directly also need loginCallback()

0.0.6 / 2012-11-23 
==================

  * change loginCallback(user, callback) to loginCallback(req, user, callback)

0.0.5 / 2012-11-22 
==================

  * support loginCallback and logoutCallback

0.0.4 / 2012-11-22 
==================

  * add user login directly when login token vaild.
  * fixed ut

0.0.3 / 2012-11-22 
==================

  * fixed login redirect bug

0.0.2 / 2012-11-22 
==================

  * fixed logincallback twice bug

0.0.1 / 2012-11-21 
==================

  * first release
