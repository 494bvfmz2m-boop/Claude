// Express 4 doesn't catch rejected promises from async route handlers — an
// unhandled rejection there crashes the whole process (Node treats unhandled
// rejections as fatal since v15). Wrapping every handler routes the error to
// Express's error middleware (a 500 response) instead of taking the process down.
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { asyncHandler };
