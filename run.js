const express = require('express')
const got = require('got')
const morgan = require('morgan')
const yaml = require('yaml')
const fs = require('fs')
const nunjucks = require('nunjucks')

nunjucks.configure({ autoescape: true })

const app = express()
const port = 3000

app.use(express.json())
app.use(morgan('combined'))

const configFile = process.argv[2] || './config.yaml'
const config = yaml.parse(fs.readFileSync(configFile, 'utf8'))

for (let route of config.routes) {
  app[route.method.toLowerCase()](route.endpoint, async (req, res) => {
    const { query, body, params } = req

    const payloadVariables = {
      ...(query && query),
      ...(params && params),
      ...(body && body),
      ...process.env,
    }

    const payload = yaml.parse(
      nunjucks.renderString(yaml.stringify(route.proxy.payload), payloadVariables)
    )

    if (route.debug) {
      console.log(`Available variables: ${JSON.stringify(payloadVariables)}`)
      console.log(`Rendered payload: ${JSON.stringify(payload)}`)
    }

    let proxyOpts = route.proxy.options || {}
    // @TODO: add support for form data??
    switch (route.proxy.method.toLowerCase()) {
      case 'post':
        proxyOpts.json = payload
        break
      default:
        proxyOpts.searchParams = payload
        break
    }

    let response = null
    try {
      response = await got[route.proxy.method.toLowerCase()](route.proxy.url, proxyOpts)
    } catch (err) {
      response = err.response
    }

    res.statusCode = response.statusCode
    res.send(response.body)
  })
}

app.listen(port, () => {
  console.log(`Starting...`)
})
