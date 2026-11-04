# Application logs

The API and worker can export events to the same Typesense
`application_logs_v1` collection as authserver-go. In Log Tracker, select
`vefacaglar-site-api` or `vefacaglar-site-worker` in the **Service** filter.

The API exports startup events, server errors and HTTP 400, 401, 403 and 429
responses. HTTP events include the matched route template when available and
the generated request ID returned in `X-Request-Id`. The worker exports
lifecycle, job failure and infrastructure events. Job progress and detailed
errors remain in the existing local logs and the job dashboard.

Set `LOG_TYPESENSE_URL` and `LOG_TYPESENSE_API_KEY` in the runtime environment
of both services. For GitHub deployment, add them as GitHub secrets (both
workflows pass them through) or put them inside `API_ENV` (`api-production`) and
`WORKER_ENV` (also `api-production`). On the shared Docker network, use
`http://typesense:8108`. Use HTTPS for remote endpoints. `LOG_ENVIRONMENT`
can override the default environment label.

Use a key scoped to `application_logs_v1` with `documents:create`. If the
collection is missing, either provision it with the
[collection schema](../apps/api/src/shared/application-logs/application_logs_v1.json)
or give the writer `collections:create` so it can create the collection on its
first write. Use a separate `documents:search` key for Log Tracker.

Export uses a bounded background queue. During an outage or queue overflow,
events remain in the local logs. Typesense receives fixed messages and selected
metadata. Request bodies, raw URLs, credentials, job payloads and raw exception
messages stay out of the exported collection.
