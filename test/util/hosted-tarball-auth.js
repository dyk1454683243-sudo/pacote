'use strict'

const t = require('tap')
const hostedTarballAuth = require('../../lib/util/hosted-tarball-auth.js')

const githubTarball = 'https://codeload.github.com/org/private/tar.gz/abc123'
const hosted = {
  domain: 'github.com',
  user: 'org',
  project: 'private',
}

t.test('no hosted object', t => {
  t.equal(hostedTarballAuth(null, githubTarball, {}), undefined)
  t.equal(hostedTarballAuth(undefined, githubTarball), undefined)
  t.end()
})

t.test('leaves explicit Authorization header alone', t => {
  t.equal(hostedTarballAuth({
    ...hosted,
    auth: 'oauth2:TOKEN',
  }, githubTarball, {
    headers: { authorization: 'Bearer already-set' },
  }), undefined)
  t.equal(hostedTarballAuth({
    ...hosted,
    auth: 'oauth2:TOKEN',
  }, githubTarball, {
    headers: { Authorization: 'Bearer already-set' },
  }), undefined)
  t.same(hostedTarballAuth({
    ...hosted,
    auth: 'oauth2:TOKEN',
  }, githubTarball, {
    headers: null,
  }), {
    _auth: Buffer.from('oauth2:TOKEN').toString('base64'),
  })
  t.end()
})

t.test('translates URL userinfo to basic forceAuth', t => {
  t.same(hostedTarballAuth({
    ...hosted,
    auth: 'oauth2:TOKEN',
  }, githubTarball, {}), {
    _auth: Buffer.from('oauth2:TOKEN').toString('base64'),
  })
  t.end()
})

t.test('decodes percent-encoded URL userinfo', t => {
  t.same(hostedTarballAuth({
    ...hosted,
    auth: 'oauth2:p%40ss',
  }, githubTarball, {}), {
    _auth: Buffer.from('oauth2:p@ss').toString('base64'),
  })
  t.end()
})

t.test('keeps raw userinfo when decodeURIComponent throws', t => {
  t.same(hostedTarballAuth({
    ...hosted,
    auth: 'oauth2:100%',
  }, githubTarball, {}), {
    _auth: Buffer.from('oauth2:100%').toString('base64'),
  })
  t.end()
})

t.test('does not override credentials already stored for the CDN host', t => {
  t.equal(hostedTarballAuth(hosted, githubTarball, {
    '//codeload.github.com/:_authToken': 'cdn-token',
    '//github.com/:_authToken': 'github-token',
  }), undefined)
  t.equal(hostedTarballAuth(hosted, githubTarball, {
    '//codeload.github.com/:_auth': Buffer.from('user:pass').toString('base64'),
  }), undefined)
  t.end()
})

t.test('no domain and no URL userinfo', t => {
  t.equal(hostedTarballAuth({ auth: null }, githubTarball, {
    '//github.com/:_authToken': 'github-token',
  }), undefined)
  t.end()
})

t.test('forwards //<git-host>/:_authToken from credential storage', t => {
  t.same(hostedTarballAuth(hosted, githubTarball, {
    '//github.com/:_authToken': 'ghp_sekrit',
  }), { token: 'ghp_sekrit' })
  t.end()
})

t.test('forwards //<git-host>/:_auth from credential storage', t => {
  const _auth = Buffer.from('oauth2:sekrit').toString('base64')
  t.same(hostedTarballAuth(hosted, githubTarball, {
    '//github.com/:_auth': _auth,
  }), { _auth })
  t.end()
})

t.test('forwards //<git-host>/:username and :_password', t => {
  t.same(hostedTarballAuth(hosted, githubTarball, {
    '//github.com/:username': 'oauth2',
    '//github.com/:_password': Buffer.from('sekrit').toString('base64'),
  }), {
    _auth: Buffer.from('oauth2:sekrit').toString('base64'),
  })
  t.end()
})

t.test('no credentials anywhere', t => {
  t.equal(hostedTarballAuth(hosted, githubTarball, {}), undefined)
  t.equal(hostedTarballAuth(hosted, githubTarball), undefined)
  t.end()
})

t.test('invalid tarball URL is ignored when looking up CDN auth', t => {
  t.same(hostedTarballAuth(hosted, 'not a url', {
    '//github.com/:_authToken': 'ghp_sekrit',
  }), { token: 'ghp_sekrit' })
  t.end()
})
