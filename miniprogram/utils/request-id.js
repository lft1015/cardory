const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function createRequestId() {
  let id = Date.now().toString(36);
  while (id.length < 32) {
    id += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return id.slice(0, 32);
}

module.exports = { createRequestId };