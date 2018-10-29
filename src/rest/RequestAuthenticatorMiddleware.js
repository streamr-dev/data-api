const HttpError = require('../errors/HttpError')

/**
 * Middleware used to authenticate REST API requests
 */
module.exports = function (streamFetcher, permission = 'read') {
    return function (req, res, next) {
        let authKey
        let sessionToken

        // Try to parse authorization header if defined
        if (req.headers.authorization !== undefined) {
            const apiKeyHeaderMalformed = !req.headers.authorization.toLowerCase().startsWith('token ')
            const sessionTokenHeaderMalformed = !req.headers.authorization.startsWith('Bearer ')
            if (apiKeyHeaderMalformed && sessionTokenHeaderMalformed) {
                res.status(400).send({
                    error: 'Authorization header malformed. Should be of form "[Bearer|token] authKey".',
                })
                return
            }
            if (!apiKeyHeaderMalformed) {
                authKey = req.headers.authorization
                    .substring(6)
                    .trim()
            } else {
                sessionToken = req.headers.authorization
                    .substring(7)
                    .trim()
            }
        }

        streamFetcher.authenticate(req.params.id, authKey, sessionToken, permission)
            .then((streamJson) => {
                req.stream = streamJson
                next()
            })
            .catch((err) => {
                let errorMsg
                if (err instanceof HttpError && err.code === 403) {
                    errorMsg = 'Authentication failed.'
                } else if (err instanceof HttpError && err.code === 404) {
                    errorMsg = `Stream ${req.params.id} not found.`
                } else {
                    errorMsg = 'Request failed.'
                }

                res.status(err.code || 403).send({
                    error: errorMsg,
                })
            })
    }
}
