module.exports = (function() {
  
  
  function ResponseModel( subdomain , httpRoot , reqPath , routeModel ) {
    var that = this;
    that.subdomain = subdomain;
    that.httpRoot = httpRoot;
    that.statusCode = routeModel.statusCode;
    that.requestPath = reqPath.original;
    that.responsePath = reqPath.current.rel;
    that.get = reqPath.get;
    that.rewrite = !!reqPath.rewritten;
    that.headers = routeModel.headers;
  }


  return ResponseModel;

  
}());



















