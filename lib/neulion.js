'use strict';

/*!
 * Dependencies
 */

var soap = require('soap')
  , Promise = require('bluebird')
  , _ = require('underscore')
  , varType = require('var-type')
  , debug = require('debug')('neulion')
  , Errors = require('./errors')

/*!
 * Misc
 */

var concat = Array.prototype.concat
  , DAY = 24 * 60 * 60 * 1000

/**
 * Convert an object into simple XML
 *
 * @param {Object} input
 * @return {String} xml output
 */

function toXML(obj) {
  var xml = ''
  for (var prop in obj) {
    xml += `<${prop}>${obj[prop]}</${prop}>`
  }
  return xml
}

/**
 * Neulion API constructor
 *
 * @param {Object} config
 *   - `endpoint` {String}
 *   - `username` {String}
 *   - `password` {String}
 *   - `group` {Number}
 *   - `autoAuth` {Boolean} default `true`
 * @return {Promise} promise
 */

function Neulion(config) {
  debug('[init] using config: `%j`', config)

  this.config = config

  // If set, the `connect` method will auth automatically
  this.autoAuth = config.hasOwnProperty('autoAuth')
    ? config.autoAuth
    : true
}

/*!
 * Add all Error classes
 */

_.extend(Neulion, Errors)

/**
 * Connect to the SOAP endpoint and authenticate
 *
 * @param {String} endpoint (optional, uses config)
 * @return {Promise} promise
 */

Neulion.prototype.connect = function(endpoint) {
  var self = this
    , uri = endpoint || this.config.endpoint

  debug('[connect] endpoint=`%s`', uri)

  return new Promise(function(res, rej) {
    soap.createClient(uri, function(err, client) {
      if (err) {
        debug('[connect] error: `%s`', err)
        return rej(new Neulion.Error(err))
      }
      // Use this to inspect the API schema
      self.schema = client.wsdl && client.wsdl.xml

      debug('[connect] connected')
      res(client)
    })
  }).then(function(client) {
    self.client = client

    if (self.autoAuth) return self.auth()
    return client
  })
}

/**
 * Verify that we are connected and authenticated before attempting requests
 *
 * @return {Promise|Null} rejection error
 */

Neulion.prototype.preCheck = function() {
  var err
  if (!this.client) err = new Neulion.NotConnectedError()
  if (!this.authCode) err = new Neulion.AuthenticationError()
  if (err) return Promise.reject(err)
  return null
}

/**
 * Authenticate against the Neulion API and cache
 * the resulting token
 *
 * @param {String} username (optional, uses config)
 * @param {String} password (optional, uses config)
 * @return {Promise} promise
 *
 * SOAP Definition:

   <element name="authenticate">
    <complexType>
     <sequence>
      <element name="loginId" type="xsd:string"/>
      <element name="password" type="xsd:string"/>
     </sequence>
    </complexType>
   </element>

   <element name="authenticateResponse">
    <complexType>
     <sequence>
      <element name="authenticateReturn" type="xsd:string"/>
     </sequence>
    </complexType>
   </element>
 */

Neulion.prototype.auth = 
Neulion.prototype.authenticate = function(username, password) {
  var self = this

  if (!this.client) return Promise.reject(new Neulion.NotConnectedError())
  
  if (username) this.config.username = username
  if (password) this.config.password = password

  var opts = {
    loginId: this.config.username
  , password: this.config.password
  }
  debug('[auth] authenticating: opts=`%j`', opts)

  return new Promise(function(res, rej) {
    self.client.authenticate(opts, function(err, resp) {
      // debug('[auth] req=`%s`', self.client.lastRequest)

      if (err) {
        debug('[auth] err=`%s`', err)
        return rej(new Neulion.AuthenticationError(err))
      }
      
      self.authCode = resp && resp.authenticateReturn.$value
      debug('[auth] code=`%s`', self.authCode)

      return res(self.authCode)
    })
  })
}

/**
 * List all known Neulion IDs since a given time interval
 *
 * @param {Object} API params (see below)
 *   - `groupId` {Number} uses config for default
 *   - `progDate` {Date}
 *   - `name` {String}
 *   - `description` {String}
 *   - `updateTime` {String} `yyyyMMddhhmmss` format
 * @return {Promise} promise
 *
 * SOAP Definition:
 
   <element name="searchVodPrograms">
    <complexType>
     <sequence>
      <element name="authCode" type="xsd:string"/>
      <element name="groupId" nillable="true" type="xsd:int"/>
      <element name="progDate" nillable="true" type="xsd:dateTime"/>
      <element name="name" nillable="true" type="xsd:string"/>
      <element name="description" nillable="true" type="xsd:string"/>
      <element name="updateTime" nillable="true" type="xsd:string"/>
     </sequence>
    </complexType>
   </element>

   <element name="searchVodProgramsResponse">
    <complexType>
     <sequence>
      <element name="ArrayOfInteger" type="impl:ArrayOfInteger"/>
     </sequence>
    </complexType>
   </element>

   <complexType name="ArrayOfInteger">
    <sequence>
     <element maxOccurs="unbounded" minOccurs="0" name="item" type="xsd:int"/>
    </sequence>
   </complexType>
 */

Neulion.prototype.list = 
Neulion.prototype.search = function(params) {
  var rej = this.preCheck()
  if (rej) return rej

  var self = this

  // Merge sent params  
  var opts = _.extend({}, {
    authCode: this.authCode
  , groupId: this.config.group
  }, params || {})

  // Normalize the `progDate` param if sent as date
  if (varType(opts.progDate, 'Date')) {
    opts.progDate = opts.progDate.toISOString()
  }

  // Format to `yyyyMMddhhmmss` if `updateTime` sent as date
  var ut = opts.updateTime
  if (varType(ut, 'Date')) {
    opts.updateTime = [
      ut.getFullYear()     // yyyy
    , (ut.getMonth() + 1)  // MM
    , ut.getDate()         // dd
    , ut.getHours()        // hh
    , ut.getMinutes()      // mm
    , ut.getSeconds()      // ss
    ].map(function(x) {
      var s = x.toString()
      if (s.length < 2) s = '0' + s
      return s
    }).join('')
  }

  debug('[list] options=`%j`', opts)

  // Hack to get around SOAP putting <impl:parameter>
  var xml = toXML({
    'impl:searchVodPrograms': toXML(opts)
  })

  return new Promise(function(res, rej) {
    self.client.searchVodPrograms(xml, function(err, resp) {
      // debug('[list] req=`%s`', self.client.lastRequest)

      if (err) {
        debug('[list] err=`%s`', err)
        return rej(new Neulion.Error(err))
      }
      var ids = (resp && resp.ArrayOfInteger && resp.ArrayOfInteger.ArrayOfInteger) || []

      // If searching by `name` or `description`, a single object will be returned
      if (!Array.isArray(ids)) ids = [ids]

      ids = ids.map(function(x) {
        return +x.$value
      })
      
      debug('[list] ids=`%s`', ids)
      return res(ids)
    })
  })
}

/**
 * Shortcut method for searching the Neulion API for a given date range.
 *
 * @param {Date|String|Number} start date
 * @param {Date|String|Number} end date
 * @param {Promise} promise
 */

Neulion.prototype.range = function(start, end) {
  var rej = this.preCheck()
  if (rej) return rej

  var self = this
    , dates = []

  // Recast dates to prevent modification by reference
  start = new Date(start)
  end = new Date(end)

  debug('[range] start=`%s` end=`%s`', start, end)

  // Increment start 24 hours via timestamp to prevent edge cases
  while (start < end) {
    dates.push(start)
    start = new Date(+start + DAY)
  }

  return Promise
    .mapSeries(dates, function(x) {
      return self.list({
        progDate: x
      })
    })
    .then(function(results) {
      var flat = concat.apply([], results || [])
      debug('[range] found=`%s`', flat.length)
      return flat
    })
}

/**
 * Load all available categories for the group
 *
 * @param {Promise} promise
 *
 * SOAP Definition:
 
   <element name="getCategories">
    <complexType>
     <sequence>
      <element name="authCode" type="xsd:string"/>
      <element name="groupId" type="xsd:int"/>
     </sequence>
    </complexType>
   </element>

   <complexType name="ArrayOfCategory">
    <sequence>
     <element maxOccurs="unbounded" name="ArrayOfCategory" type="impl:Category"/>
    </sequence>
   </complexType>

   <element name="getCategoriesResponse">
    <complexType>
     <sequence>
      <element name="ArrayOfCategory" type="impl:ArrayOfCategory"/>
     </sequence>
    </complexType>
   </element>

   <complexType name="Category">
    <sequence>
     <element name="categoryId" nillable="true" type="xsd:int"/>
     <element name="categoryKey" nillable="true" type="xsd:string"/>
     <element name="name" nillable="true" type="xsd:string"/>
     <element name="parentId" nillable="true" type="xsd:int"/>
    </sequence>
   </complexType>
 */

Neulion.prototype.categories = function() {
  var rej = this.preCheck()
  if (rej) return rej

  var self = this

  var opts = {
    authCode: this.authCode
  , groupId: this.config.group
  }

  // Hack to get around SOAP putting <impl:parameter>
  // var xml = toXML({
  //   'impl:getCategories': toXML(opts)
  // })

  debug('[categories] options=`%j`', opts)

  return new Promise(function(res, rej) {
    self.client.getCategories(opts, function(err, resp) {
      // debug('[categories] req=`%s`', self.client.lastRequest)

      if (err) {
        debug('[categories] err=`%s`', err)
        return rej(new Neulion.Error(err))
      }
    
      var cats = resp && resp.ArrayOfCategory.ArrayOfCategory
      
      cats = cats.map(function(x) {
        var cat = {}
        for (var prop in x) {
          cat[prop] = x[prop].$value
        }
        return cat
      })

      debug('[categories] found=`%s`', cats.length)
      return res(cats)
    })
  })
}

/**
 * Find the video details for a given ID
 *
 * @param {Number} neulion id
 * @param {Promise} promise
 *
 * SOAP Definition:

   <element name="getProgramDetail">
    <complexType>
     <sequence>
      <element name="authCode" type="xsd:string"/>
      <element name="programId" type="xsd:int"/>
     </sequence>
    </complexType>
   </element>

   <element name="getProgramDetailResponse">
    <complexType>
     <sequence>
      <element name="ProgramDetail" type="impl:ProgramDetail"/>
     </sequence>
    </complexType>
   </element>

   <complexType name="ProgramDetail">
    <sequence>
     <element name="altDesc" nillable="true" type="xsd:string"/>
     <element name="altName" nillable="true" type="xsd:string"/>
     <element name="archiveTime" nillable="true" type="xsd:string"/>
     <element name="bigImage" nillable="true" type="xsd:string"/>
     <element name="bigImageUrl" nillable="true" type="xsd:string"/>
     <element name="categoryIdArray" nillable="true" type="impl:ArrayOfInteger"/>
     <element name="data1" nillable="true" type="xsd:string"/>
     <element name="data2" nillable="true" type="xsd:string"/>
     <element name="desc" nillable="true" type="xsd:string"/>
     <element name="endTime" nillable="true" type="xsd:dateTime"/>
     <element name="eventId" nillable="true" type="xsd:string"/>
     <element name="extUrl" nillable="true" type="xsd:string"/>
     <element name="gameId" nillable="true" type="xsd:string"/>
     <element name="gameTime" nillable="true" type="xsd:string"/>
     <element name="groupId" nillable="true" type="xsd:int"/>
     <element name="highlightType" nillable="true" type="xsd:string"/>
     <element name="name" nillable="true" type="xsd:string"/>
     <element name="progDate" nillable="true" type="xsd:dateTime"/>
     <element name="programId" nillable="true" type="xsd:int"/>
     <element name="programType" nillable="true" type="xsd:string"/>
     <element name="regRequired" type="xsd:boolean"/>
     <element name="shareInPlayer" type="xsd:boolean"/>
     <element name="smallImage" nillable="true" type="xsd:string"/>
     <element name="smallImageUrl" nillable="true" type="xsd:string"/>
     <element name="startTime" nillable="true" type="xsd:dateTime"/>
     <element name="tagArray" nillable="true" type="impl:ArrayOfString"/>
     <element name="updateTime" nillable="true" type="xsd:string"/>
     <element name="videoName" nillable="true" type="xsd:string"/>
     <element name="videoTime" nillable="true" type="xsd:dateTime"/>
     <element name="videoUrl" nillable="true" type="xsd:string"/>
    </sequence>
   </complexType>
 */

Neulion.prototype.details = function(id) {
  var rej = this.preCheck()
  if (rej) return rej

  var self = this

  var opts = {
    authCode: this.authCode
  , programId: id
  }

  // TODO: Not sure what this was for anymore
  //
  // Hack to get around SOAP putting <impl:parameter>
  // var xml = toXML({
  //   'impl:getProgramDetail': toXML(opts)
  // })

  debug('[details] options=`%j`', opts)

  return new Promise(function(res, rej) {
    self.client.getProgramDetail(opts, function(err, resp) {
      if (err) {
        debug('[details] err=`%s`', err)
        return rej(new Neulion.Error(err))
      }
      var details = resp && resp.ProgramDetail
        , video = {}

      // Map all basic properties with a $value
      for (var prop in details) {
        video[prop] = details[prop].$value
      }

      // Map the category array as numbers if present
      var cats = details.categoryIdArray && details.categoryIdArray.categoryIdArray
      if (cats) {
        if (!Array.isArray(cats)) cats = [cats]

        video.categoryIdArray = cats.map(function(x) {
          return +x.$value
        })
      }

      // Map the tag array if present
      var tags = details.tagArray && details.tagArray.tagArray
      if (tags) {
        if (!Array.isArray(tags)) tags = [tags]
          
        video.tagArray = tags.map(function(x) {
          return x.$value
        })
      }

      debug('[details] video=`%j`', video)
      return res(video)
    })
  })
}

/*!
 * Exports
 */

module.exports = Neulion
