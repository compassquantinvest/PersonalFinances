/**
 * @param {import('node:http').IncomingMessage} request
 * @param {import('node:http').ServerResponse} response
 * @param {number} startTime - performance.now() at request start
 */
export function logRequest(request, response, startTime) {
  response.on('finish', () => {
    const duration = Math.round(Date.now() - startTime)
    console.log(`${request.method} ${new URL(request.url || '/', `http://${request.headers.host}`).pathname} ${response.statusCode} ${duration}ms`)
  })
}
