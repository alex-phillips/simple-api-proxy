# Simple API Proxy
This project provides a simple configurable endpoint where you can alter a payload and send it off to another backend. An example is to be able to send alerts or notifications to a service even if the origin service doesn't support it as an integratoin.

In the config.yaml.sample file, there is an `/uptime-kuma` endpoint that alters the payload provided by uptime-kuma's webhook integration and formats it in a way that [GoAlert](https://github.com/target/goalert) can interpret.

## Configuration
Copy config.yaml.sample to config.yaml. Specify a route and method. The `proxy` property is the endpoint and payload to send to the backend service. Here you define the `url` and `method` for the backend as well as a `payload`. The payload is automatically sent as query parameters if `get` is specified or a JSON payload if `post` is specified.

The following example provides the `/uptime-kuma` endpoint and proxies the request to a GoAlert backend:
```yaml
routes:
  - endpoint: /uptime-kuma
    method: get
    proxy:
      url: https://my-goalert-endpoint.com/api/v2/generic/incoming
      method: get
      payload:
        token: my-secret-token
        summary: "{{ monitor.name }}"
        details: "{{ msg }} \n\n https://my-uptime-kuma.com/dashboard/{{ monitor.id }}"
        action: "{{ 'close' if heartbeat.status else '' }}"
        dedup: "monitor-{{ monitor.id }}"
      options: {}
```
