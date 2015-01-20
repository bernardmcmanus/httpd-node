module.exports = (function() {


  var replacer = require( './replacer' );
  

  function Rewrite( regexp , replacement , gzip ) {
    var that = this;
    that.regexp = regexp;
    that.replacement = replacement;
    that.gzip = !!gzip;
  }


  Rewrite.prototype = {

    match: function( endpoint ) {
      var that = this;
      return that.regexp.test( endpoint );
    },

    handle: function( match ) {
      var that = this;
      var replacement = that.replacement;
      if (typeof replacement == 'function') {
        return that.replacement( match );
      }
      else {
        match = that.regexp.exec( match )[0];
        return replacer( replacement , { match: match });
      }
    }
  };


  Rewrite.match = function( path , rules ) {
    for (var i = 0; i < rules.length; i++) {
      if (rules[i].match( path )) {
        return rules[i];
      }
    }
  };


  return Rewrite;


}());



















