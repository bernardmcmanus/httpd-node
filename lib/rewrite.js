module.exports = (function() {
  

  function Rewrite( regexp , handle , preserve ) {
    var that = this;
    that.regexp = regexp;
    that.handle = handle;
    that.preserve = preserve;
  }


  Rewrite.prototype = {
    match: function( endpoint ) {
      var that = this;
      return that.regexp.test( endpoint );
    }
  };


  Rewrite.match = function( reqPath , rules , callback ) {
    for (var i = 0; i < rules.length; i++) {
      if (rules[i].match( reqPath.relative )) {
        return rules[i];
      }
    }
  };


  return Rewrite;


}());



















