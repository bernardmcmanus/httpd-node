module.exports = function( grunt ) {


  var cp = require( 'child_process' );
  var exec = cp.exec;
  var util = require( 'util' );


  grunt.initConfig({

    pkg: grunt.file.readJSON( 'package.json' ),

    jshint: {
      all: [ '*.js' , 'lib/*.js' , 'models/*.js' ]
    },

    watch: {
      default: {
        files: [ '*.js' , 'lib/*.js' , 'models/*.js' ],
        tasks: [ 'startServer' ]
      },
      debug: {
        files: [ '*.js' , 'test/*.js' , 'lib/*.js' , 'models/*.js' ],
        tasks: [ 'test' ]
      }
    }
  });

  
  [
    'grunt-contrib-jshint',
    'grunt-contrib-watch'
  ]
  .forEach( grunt.loadNpmTasks );


  grunt.registerTask( 'runTests' , function() {
    var done = this.async();
    exec( 'npm test' , function( err , stdout , stderr ) {
      util.puts( err ? err : stdout );
      done();
    });
  });


  grunt.registerTask( 'startServer' , function() {
    var child = cp.fork( './standalone.js' );
    grunt.event.on( 'watch' , function() {
      child.send({ event: 'exit' });
      child.kill();
    });
  });


  grunt.registerTask( 'default' , [
    'startServer',
    'watch:default'
  ]);


  grunt.registerTask( 'test' , [
    'jshint',
    'runTests'
  ]);


  grunt.registerTask( 'debug' , [
    'test',
    'watch:debug'
  ]);
};









