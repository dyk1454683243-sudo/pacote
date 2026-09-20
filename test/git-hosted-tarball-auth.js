'use strict'

const t = require('tap')
const fs = require('node:fs')
const { join, resolve } = require('node:path')
const Arborist = require('@npmcli/arborist')
const GitFetcher = require('../lib/git.js')
const tnock = require('./fixtures/tnock')

const abbrevTGZ = fs.readFileSync(resolve(__dirname, 'fixtures/abbrev-1.1.1.tgz'))
const hash = '0'.repeat(40)
const tarballPath = `/foo/private/tar.gz/${hash}`

const headerValue = (value) => Array.isArray(value) ? value[0] : value

const extractWithAuth = async (t, spec, extraOpts) => {
  const testdir = t.testdir()
  const captured = []
  tnock(t, 'https://codeload.github.com')
    .get(tarballPath)
    .reply(function () {
      captured.push(this.req.headers)
      return [200, abbrevTGZ]
    })

  const fetcher = new GitFetcher(spec, {
    cache: join(testdir, 'cache'),
    Arborist,
    replaceRegistryHost: 'never',
    ...extraOpts,
  })
  await fetcher.extract(join(testdir, 'extract'))
  t.ok(
    fs.existsSync(join(testdir, 'extract', 'package.json')),
    'hosted tarball was extracted'
  )
  return captured
}

t.test('codeload fetch sends Authorization from git+https URL credentials', async t => {
  const spec = `git+https://oauth2:sekrit@github.com/foo/private.git#${hash}`
  const expected = `Basic ${Buffer.from('oauth2:sekrit').toString('base64')}`
  const captured = await extractWithAuth(t, spec)
  t.equal(captured.length, 1, 'codeload was requested once')
  t.equal(headerValue(captured[0].authorization), expected,
    'Authorization is basic auth from URL userinfo')
})

t.test('codeload fetch decodes percent-encoded URL credentials', async t => {
  const spec = `git+https://oauth2:p%40ss@github.com/foo/private.git#${hash}`
  const expected = `Basic ${Buffer.from('oauth2:p@ss').toString('base64')}`
  const captured = await extractWithAuth(t, spec)
  t.equal(headerValue(captured[0].authorization), expected)
})

t.test('codeload fetch sends Authorization from credential storage', async t => {
  const spec = `git+https://github.com/foo/private.git#${hash}`
  const captured = await extractWithAuth(t, spec, {
    '//github.com/:_authToken': 'ghp_sekrit',
  })
  t.equal(headerValue(captured[0].authorization), 'Bearer ghp_sekrit',
    'Authorization is Bearer token from //github.com/:_authToken')
})

t.test('codeload-specific credential storage is used as-is', async t => {
  const spec = `git+https://github.com/foo/private.git#${hash}`
  const captured = await extractWithAuth(t, spec, {
    '//github.com/:_authToken': 'github-token',
    '//codeload.github.com/:_authToken': 'cdn-token',
  })
  t.equal(headerValue(captured[0].authorization), 'Bearer cdn-token',
    'more-specific CDN host token wins over github.com token')
})

t.test('public hosted tarball fetch has no Authorization header', async t => {
  const spec = `git+https://github.com/foo/private.git#${hash}`
  const captured = await extractWithAuth(t, spec)
  t.equal(headerValue(captured[0].authorization), undefined)
})
