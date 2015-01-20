module.exports = (function() {

  
  var REGEXP_TEMPLATE = '\\{\\{[key]\\}\\}';


  return function( str , obj ) {
    
    Object.keys( obj ).forEach(function( key ) {
      var tpl = REGEXP_TEMPLATE.replace( '[key]' , key );
      var re = new RegExp( tpl , 'gi' );
      var val = obj[key];
      str = str.replace( re , val );
    });

    return str;
  };


}());



















