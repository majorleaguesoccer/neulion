'use strict';

/*!
 * Dependencies
 */

var mock = require('mock-require')
  , tick = process.nextTick

/**
 * Mock soap client
 */

var Client = {
  authenticate: function(opts, next) {
    var resp = {
      authenticateReturn: {
        '$value': 'such auth'
      }
    }
    tick(function() { next(null, resp) })
  }

, searchVodPrograms: function(xml, next) {
    var resp = {
      ArrayOfInteger: {
        ArrayOfInteger: []
      }
    }
    tick(function() { next(null, resp) })
  }

, getCategories: function(opts, next) {
    var resp = {
      ArrayOfCategory: {
        ArrayOfCategory: []
      }
    }
    tick(function() { next(null, resp) })
  }

, getProgramDetail: function(opts, next) {
    var resp = {
      ProgramDetail: {
        categoryIdArray: {
          categoryIdArray: []
        }
      }
    }
    tick(function() { next(null, resp) })
  }
  
, wsdl: {
    schema: '<xml></xml>'
  }
}

/**
 * Mock soap wrapper
 */

var Soap = {
  createClient: function(conf, next) {
    tick(function() { next(null, Client) })
  }
}


mock('soap', Soap)