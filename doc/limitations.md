# Not Supported / Known Limitations

This page collects current gaps and behavior that users should know before depending on a workflow.

## Known Limitations

- Companion lookup columns such as `owneridname`, `owneridtype`, or custom lookup `...name` / `...type` fields may require the base lookup column to also be present in the `SELECT` list. For example, `select ownerid, owneridname from account` is currently more reliable than `select owneridname from account`.
- FetchXML preview tabs are intentionally not connection-bound.
- `BypassBusinessLogicExecutionStepIds` is surfaced as not implemented yet.
- The schema explorer currently relies on its own selected connection and is intentionally decoupled from query-tab connection state.

## Not Supported

- A single global active connection shared across tabs.
- Full support for every Dataverse special-case table workflow.
- A completed implementation of every Dataverse request-parameter header exposed by the underlying client library.
- General-purpose SQL coverage outside the QueryVerse SQL-to-Fetch feature set.

## Why This Page Exists

It is better to state product edges directly than to let users infer support from UI affordances that only partially overlap with Dataverse behavior.
