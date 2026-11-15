/**
 * An error that carries an HTTP status code. Throw it anywhere in a route and
 * the error handler turns it into a JSON response: { "error": "message" }.
 */
class HttpError extends Error {
    /**
     * @param {number} status  HTTP status code
     * @param {string} message Safe message shown to the client
     * @param {object} [options]
     * @param {string} [options.detail] Technical detail (only returned outside production)
     * @param {object} [options.extra]  Extra fields merged into the response (e.g. availableStock)
     */
    constructor(status, message, { detail, extra } = {}) {
        super(message);
        this.status = status;
        this.detail = detail;
        this.extra = extra;
    }
}

module.exports = HttpError;
