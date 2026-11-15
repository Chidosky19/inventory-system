const HttpError = require("./httpError");

/**
 * Return the data of a Supabase response, or throw an HttpError if it failed.
 * The technical database message is logged, not sent to the client.
 */
function unwrap({ data, error }, publicMessage, status = 500) {
    if (error) {
        console.error(`${publicMessage}:`, error.message);
        throw new HttpError(status, publicMessage, { detail: error.message });
    }

    return data;
}

module.exports = { unwrap };
