'use strict'

const { getAuth } = require('npm-registry-fetch')

// hosted-git-info stores URL userinfo as-is (still percent-encoded).
const decodeUserinfo = (auth) => {
  try {
    return decodeURIComponent(auth)
  } catch {
    return auth
  }
}

const tryGetAuth = (uri, opts) => {
  try {
    return getAuth(uri, opts)
  } catch {
    return null
  }
}

const hasAuth = (auth) => auth && (auth.token || auth.auth)

const headersHaveAuthorization = (opts) => {
  const headers = opts.headers || {}
  return !!(headers.authorization || headers.Authorization)
}

// Build a forceAuth object for npm-registry-fetch so hosted CDN tarball
// downloads (e.g. https://codeload.github.com/...) use the same credentials
// as the git remote: URL userinfo or //<git-host>/:_authToken storage.
const hostedTarballAuth = (hosted, tarballUrl, opts = {}) => {
  if (!hosted || headersHaveAuthorization(opts)) {
    return undefined
  }

  if (hosted.auth) {
    return {
      _auth: Buffer.from(decodeUserinfo(hosted.auth)).toString('base64'),
    }
  }

  if (tarballUrl && hasAuth(tryGetAuth(tarballUrl, opts))) {
    return undefined
  }

  if (!hosted.domain) {
    return undefined
  }

  const path = [hosted.user, hosted.project].filter(Boolean).join('/')
  const gitAuth = tryGetAuth(`https://${hosted.domain}/${path}`, opts)
  if (!hasAuth(gitAuth)) {
    return undefined
  }
  if (gitAuth.token) {
    return { token: gitAuth.token }
  }
  return { _auth: gitAuth.auth }
}

module.exports = hostedTarballAuth
