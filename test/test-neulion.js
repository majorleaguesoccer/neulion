'use strict';

/*!
 * Dependencies
 */

var fs = require('fs')
  , path = require('path')
  , assert = require('assert')
  , ase = assert.strictEqual
  , mock
  
// Argv input
var argv = require('yargs')
  .describe('id', 'neulion video ID to test against')
  .describe('integration', 'run against the real API')
  .argv

if (!argv.integration) {
  mock = require('./mock')
}

var example = {
  name: 'some name'
, desc: 'some description'
, updateTime: new Date()
}

/** 
 * Config helpers
 *
 * @param {String} filepath
 * @return {Object|Null} config if found
 */

function getConfig(fpath) {
  var obj = null

  if (fs.existsSync(fpath)) {
    var str = fs.readFileSync(fpath, 'utf8')

    try {
      obj = JSON.parse(str)
    } catch(e) {
      console.error('Invalid JSON: fpath=`%s`', fpath)
    }
  }
  return obj
}

/*!
 * Check for local config file, or ~/.neulionrc
 */

var localPath = path.join(__dirname, '/../config.json')
  , home = process.env.HOME || process.env.USERPROFILE
  , homePath = path.join(home, '/.neulionrc')

/*!
 * Test
 */

describe('Neulion', function() {
  this.timeout(2000)

  var Neulion = require('../index')
    , config = getConfig(localPath) || getConfig(homePath) || {}

  config.autoAuth = false

  var api = new Neulion(config)

  // it('not connected error', function(done) {
  //   api
  //     .auth()
  //     .then(function() {
  //       done(new Error('Missing error'))
  //     })
  //     .catch(Neulion.NotConnectedError, function(err) {
  //       done()
  //     })
  //     .catch(done)
  // })

  it('connect', function(done) {
    this.timeout(5000)

    api
      .connect()
      .then(function() {
        done()
      })
      .catch(done)
  })

  // it('no auth error', function(done) {
  //   this.timeout(5000)

  //   api
  //     .details()
  //     .then(function() {
  //       done(new Error('Missing error'))
  //     })
  //     .catch(Neulion.AuthenticationError, function(err) {
  //       done()
  //     })
  //     .catch(done)
  // })

  it('authenticate', function(done) {
    this.timeout(5000)

    api
      .auth()
      .then(function(authCode) {
        done()
      })
      .catch(done)
  })

  it('details arg error', function(done) {
    api
      .details('foobar')
      .then(function(x) {
        if (!argv.integration) {
          return done()
        }
        done(new Error('Missing error'))
      })
      .catch(Neulion.Error, function(err) {
        // console.log(err)
        if (!mock) {
          ase(typeof err.message, 'string')
        }
        done()
      })
      .catch(done)
  })

  it('categories', function(done) {
    api
      .categories()
      .then(function(cats) {
        assert(Array.isArray(cats))
        done()
      })
      .catch(done)
  })

  it('details', function(done) {
    var programId = argv.id || 65041

    api
      .details(programId)
      .then(function(data) {
        // assert(typeof data, 'object')
        done()
      })
      .catch(done)
  })

  it('range', function(done) {
    var end = Date.now()
      , start = end - (3 * 24 * 60 * 60 * 1000)

    api
      .range(start, end)
      .then(function(videos) {
        assert(Array.isArray(videos))
        done()
      })
      .catch(done)
  })

  describe('list', function() {
    
    function dataCheck(data) {
      assert(Array.isArray(data))

      data.forEach(function(x) {
        ase(typeof x, 'number')
      })
    }

    it('progDate', function(done) {
      var params = {
        progDate: new Date(1446053613877) // Wed Oct 28 2015 10:33:33 GMT-0700 (PDT)
      }

      api
        .list(params)
        .then(function(data) {
          dataCheck(data)
          // assert(data.length)
          done()
        })
        .catch(done)
    })

    it('name', function(done) {
      var params = {
        name: example.name
      }

      api
        .list(params)
        .then(function(data) {
          dataCheck(data)
          // ase(data[0], example.programId)
          done()
        })
        .catch(done)
    })

    it('description', function(done) {
      var params = {
        description: example.desc
      }

      api
        .list(params)
        .then(function(data) {
          dataCheck(data)
          // ase(data[0], example.programId)
          done()
        })
        .catch(done)
    })

    it('updateTime', function(done) {
      var params = {
        updateTime: example.updateTime
      }

      api
        .list(params)
        .then(function(data) {
          dataCheck(data)
          // assert(data.length)
          done()
        })
        .catch(done)
    })
  })
})
