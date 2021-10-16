const express = require('express')
const got = require('got')
const morgan = require('morgan')
const yaml = require('yaml')
const fs = require('fs')
const nunjucks = require('nunjucks')

nunjucks.configure({ autoescape: true });

const app = express()
const port = 3000

app.use(express.json())
app.use(morgan('combined'))

const configFile = process.argv[2] || './config.yaml'

const config = yaml.parse(fs.readFileSync(configFile, 'utf8'))

for (let route of config.routes) {
  app[route.method](route.endpoint, async (req, res) => {
    const { query, body, params } = req
    const payload = nunjucks.renderString(yaml.stringify(route.proxy.payload), {
      ...(query && query),
      ...(params && params),
      ...(body && body),
    })

    console.log(yaml.parse(payload))

    let proxyOpts = route.proxy.options || {}
    // @TODO: add support for form data??
    switch (route.proxy.method) {
      case 'post':
        proxyOpts.json = yaml.parse(payload)
        break
      default:
        proxyOpts.searchParams = yaml.parse(payload)
        break
    }

    try {
      const response = await got[route.proxy.method](route.proxy.url, proxyOpts)
      res.statusCode = response.statusCode
      res.send(response.body)
    } catch (err) {
      res.statusCode = err.response.statusCode
      res.send(err.response.body)
    }
  })
}

app.listen(port, () => {
  console.log(`Starting...`)
})
