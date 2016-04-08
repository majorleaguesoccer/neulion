Neulion
=======

[![Build Status](https://secure.travis-ci.org/majorleaguesoccer/neulion.png)](http://travis-ci.org/majorleaguesoccer/neulion) 
[![NPM version](https://badge.fury.io/js/neulion.png)](http://badge.fury.io/js/neulion)

Neulion API wrapper for node.js. Currently this is a read-only API.


Install
-------

With [npm](https://npmjs.org)

```
npm install neulion
```


Debug
-----

This module uses the [debug](https://github.com/visionmedia/debug) module with a 
key of `neulion`

```sh
DEBUG=neulion node my-app.js
```


Usage
-----

Node.js

```js
var Neulion = require('neulion')

var config = {
  endpoint: 'http://mydomain.neulion.com/iptv-admin-mlsws/services/ContentWS?wsdl'
, username: 'username'
, password: 'such password'
, group: 101
, autoAuth: true
}

var api = new Neulion(config)

api
  .connect()
  .then(function() {
    return api.list({
      progDate: new Date()
    })
  })
  .then(function(videos) {
    return Promise.map(videos, function(id) {
      return api.details(id)
    })
  })
  .then(function(videos) {
    // ...
  })
  .catch(function(err) {
    console.error('error', err)
  })
```


API
---

### new Neulion(config)

Create a new Neulion API wrapper

* `config` - Object -  api options
  - `endpoint` - String - Neulion HTTP endpoint
  - `username` - String - Username
  - `password` - String - Password
  - `group` - Number - Neulion group code
  - `autoAuth` - Boolean - Authenticate after connect (optional, default `true`)

```js
var api = new Neulion({
  // ...
})
```


### Neulion.Error

Custom `Error` class for extracting API response errors. Currently the SOAP calls
return `Error: undefined undefined` and require further inspection.

```js
api
  .details(200)
  .then(function(video) {

  })
  .catch(Neulion.NotConnectedError, function(err) {
    // API not currently connected or authenticated
  })
  .catch(Neulion.AuthenticationError, function(err) {
    // API not currently authenticated, either missing or invalid credentials
    // or the `auth` method was never called in the first place.
  })
  .catch(Neulion.SoapError, function(err) {
    // Error during API SOAP call
  })
  .catch(Neulion.Error, function(err) {
    // General catch-all for errors above
  })
  .catch(function(err) {
    // Something else went wrong
  })
```


### api.connect()

Connect to the Neulion API and authenticate.

```js
api
  .connect()
  .then(function() {
    // Arguments can be omitted if set in config
    // Method call can be omitted if `autoAuth` is set in config
    return api.auth(username, password)
  })
  .then(function(authCode) {
    // The actual soap client is stored as `api.client`
    console.log('SOAP client: ', api.client)
    
    // The WSDL XML schema is also saved for inspection
    console.log('SOAP schema: ', api.schema)
  })
  .catch(function(err) {
    // ...
  })
```


### api.auth(username, password)

**Alias**: [`authenticate`]

Authenticate against the Neulion API and store the code for future requests. This 
is automatically called from `connect` by default since the auth code is required.

If arguments are sent, the internal config will be updated.

* `username` - String - neulion login id (optional, uses config value)
* `password` - String - neulion password (optional, uses config value)

```js
api
  .auth('joe', 'asdf123')
  .then(function(authCode) {
    // `authCode` is saved internally
  })
  .catch(function(err) {
    // ...
  })
```


### api.details(id)

Get the full video details from Neulion

* `id` - Number - neulion video id

```js
api
  .details(322301)
  .then(function(videos) {
    /*!
      [
        {
          altDesc:         String
        , altName:         String
        , archiveTime:     String
        , bigImage:        String
        , bigImageUrl:     String
        , categoryIdArray: Array
        , data1:           String
        , data2:           String
        , desc:            String
        , endTime:         Date
        , eventId:         String
        , extUrl:          String
        , gameId:          String
        , gameTime:        String
        , groupId:         Number
        , highlightType:   String
        , name:            String
        , progDate:        Date
        , programId:       Number
        , programType:     String
        , regRequired:     Boolean
        , shareInPlayer:   Boolean
        , smallImage:      String
        , smallImageUrl:   String
        , startTime:       Date
        , tagArray:        Array
        , updateTime:      String
        , videoName:       String
        , videoTime:       Date
        , videoUrl:        String
        }
      ]
     */
  })
  .catch(function(err) {
    // ...
  })
```


### api.search(params)

**Alias**: [`list`]

Search for videos. Returns a list of found Neulion IDs. The `details` method must 
be called to get the full video object. Not entirely sure yet how the `progDate`
and `updateTime` are matched in the API, they seem to return videos for the *day* 
of the day sent. Further investigation required.

* `params` - api search parameters
  - `groupId` - Number - neulion group ID (optional, uses config value from constructor if set)
  - `progDate` - Date|String - limit to given day of date (String format: `YYYY-MM-DDTHH:mm:ss.sssZ`, `date.toISOString()`)
  - `name` - String - search by name
  - `description` - String - search by description
  - `updateTime` - Date|String - search by last updated (String format: `yyyyMMddhhmmss`)

```js
api
  .list({
    name: 'my awesome video'
  })
  .then(function(videos) {
    /*!
      [Number, Number, ...]
     */
  })
  .catch(Neulion.Error, function(err) {
    // ...
  })
```


### api.range(start, end)

Search Neulion for videos within the given date range. The API currently only uses a 
given date to represent that entire day. This is a shortcut to running `list` multiple 
times with different dates. Returns a list of found Neulion IDs.

* `start` - Date - starting day
* `end` - Date - ending day

```js
// Find videos from 5 days ago up to today
var end = Date.now()
  , start = end - (5 * 24 * 60 * 60 * 1000)

api
  .range(start, end)
  .then(function(videos) {
    /*!
      [Number, Number, ...]
     */
  })
  .catch(function(err) {
    // ...
  })
```


### api.categories()

Find all video categories from Neulion. This is done to get the full details of 
a given category, since the API only returns category IDs on the video object.

This method can be slow depending on how many categories there are.

```js
api
  .categories()
  .then(function(cats) {
    /*!
      [
        {
          categoryId: Number
        , categoryKey: String
        , name: String
        , parentId: Number
        }
      ]
     */
  })
  .catch(function(err) {
    // ...
  })
```



License
-------

[MIT](license)
