import express from "express";
import got from "got";
import morgan from "morgan";
import yaml from "yaml";
import fs from "fs";
import nunjucks from "nunjucks";
import { request } from "http";

// got
//   .post("https://ot.w00t.cloud/pub")
//   .then((res) => console.log(res.https))
//   .catch((err) => console.log(err.message));

nunjucks.configure({ autoescape: true });

const app = express();
const port = process.env.API_PROXY_PORT || 3000;

app.use(express.json());
app.use(morgan("combined"));

const configFile = process.argv[2] || "./config.yaml";
const config = yaml.parse(fs.readFileSync(configFile, "utf8"));

async function proxy(proxy, proxyOpts) {

}

for (let route of config.routes) {
  if (route.stream && Array.isArray(route.proxy) && route.proxy.length > 1) {
    console.error(`Invalid route: ${route.endpoint}: cannot stream a route with multiple proxies.`)
    process.exit(1)
  }

  app[route.method.toLowerCase()](route.endpoint, async (req, res) => {
    const { query, body, params } = req;

    const payloadVariables = {
      ...(query && query),
      ...(params && params),
      ...(body && body),
      ...process.env,
    };

    if (route.debug) {
      console.log(`  Available variables: ${JSON.stringify(payloadVariables)}`);
    }

    if (!Array.isArray(route.proxy)) {
      route.proxy = [route.proxy]
    }

    let proxies = []
    for (const proxy of route.proxy) {
      let payload;
      if (proxy.passPayload) {
        payload = body;
      } else {
        payload = yaml.parse(
          nunjucks.renderString(
            yaml.stringify(proxy.payload || {}),
            payloadVariables
          )
        );
      }

      if (route.debug) {
        console.log(`Processing proxy ${proxy.url}`)
        console.log(`  Rendered payload: ${JSON.stringify(payload)}`);
      }

      let proxyOpts = proxy.options || {};
      if (proxy.passHeaders) {
        proxyOpts.headers = req.headers;

        // Can't set 'host' header as it'll interfere with the request
        delete proxyOpts.headers.host
        delete proxyOpts.headers["x-forwarded-for"]
        delete proxyOpts.headers["x-forwarded-host"]
        delete proxyOpts.headers["x-forwarded-port"]
        delete proxyOpts.headers["x-forwarded-proto"]
        delete proxyOpts.headers["x-forwarded-server"]
        console.log(`Using headers: ${JSON.stringify(req.headers)}`)
      }
      // @TODO: add support for form data??
      switch ((proxy.method || "get").toLowerCase()) {
        case "post":
          proxyOpts.json = payload;
          break;
        default:
          proxyOpts.searchParams = payload;
          break;
      }

      proxies.push({
        url: proxy.url,
        method: proxy.method,
        proxyOpts,
      })
    }

    if (route.stream) {
      const proxiestream = got.stream[proxies[0].method.toLowerCase()](
        proxies[0].url,
        proxies[0].proxyOpts
      );
      proxiestream.on("response", (response) => {
        for (const header in response.headers) {
          res.set(header, response.headers[header]);
        }

        res.statusCode = response.statusCode;
      });
      proxiestream.on("data", (chunk) => {
        res.write(chunk);
      });
      proxiestream.on("end", () => {
        res.end();
      });
    } else {
      const responses = await Promise.all(proxies.map(async proxy => {
        let response = null;
        try {
          response = await got[proxy.method.toLowerCase()](
            proxy.url,
            proxy.proxyOpts,
          );
        } catch (err) {
          console.log(err.message)
          response = err.response;
        }

        console.log(`Response from ${proxy.url}: ${response.body}`)
        return response
      }))

      // For now, we're going to return the FIRST headers and body, we can configure this later.
      for (const header in responses[0].headers) {
        res.set(header, responses[0].headers[header]);
      }
      res.statusCode = responses[0].statusCode;
      res.send(responses[0].body);
    }
  });
}

app.listen(port, () => {
  console.log(`Starting...`);
});
