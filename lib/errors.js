'use strict';

/*!
 * Dependencies
 */

var varType = require('var-type')

/*!
 * Custom error handlers
 */

exports.Error = 
exports.NeulionError = class extends Error {
  constructor(message) {
    super('NeulionError')
    this.name = 'NeulionError'
    this.message = message
  }
}

/*!
 * Not connected to the SOAP endpoint
 */

exports.NotConnectedError = class extends exports.Error {
  constructor(message) {
    super()
    this.name = 'NeulionNotConnectedError'
  }
}

/*!
 * Custom error handler since the default SOAP error handling
 * returns as `Error: undefined undefined`.
 *
 * @param {Error} original SOAP error
 *
 * Example:
 *
 * { 
 *   Fault: { 
 *     faultcode: 'soapenv:Server.userException'
 *   , faultstring: 'java.lang.NumberFormatException: For input string: "4f279ef0-9b85-3de0-db8f-fe42d05c2476"'
 *   , detail: { hostname: 'fnycweb01' }
 *   } 
 * }
 */

exports.SoapError = class extends exports.Error {
  constructor(err) {
    super()
    var self = this
    this.name = 'NeulionSoapError'

    // Make sure this wasnt called with a string message
    if (varType(err, 'String')) {
      this.message = err
      return
    }
    if (!err) return
      
    this.originalError = err

    // Extract relevant error information
    if (err.root) {
      var body = err.root.Envelope.Body
      this.message = err.message = body.Fault.faultstring
    }
    
    // Inherit from the original error
    Object.getOwnPropertyNames(err).forEach(function(key) {
      self[key] = err[key]
    })
  }
}

/*!
 * Missing or invalid credentials, or missing auth call. If `message`
 * is of type `Error`, then the authentication call failed.
 */

exports.AuthenticationError = class extends exports.SoapError {
  constructor(message) {
    super(message)
    this.name = 'NeulionAuthenticationError'
  }
}