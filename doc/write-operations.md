# Write Operations

QueryVerse supports controlled Dataverse write workflows for `UPDATE` and `DELETE` statements.

<SCREENSHOT / GIF HERE>

## Supported Workflows

- Parse supported SQL `UPDATE` statements.
- Parse supported SQL `DELETE` statements.
- Preview affected rows before sending the final write request.
- Show affected row counts in the confirmation flow.
- Apply Dataverse request parameters from settings to update and delete operations.
- Show current request-parameter state in the confirmation dialogs.

## Safety Model

- Writes are intentionally previewed before execution.
- The preview/confirm split is there to reduce accidental mutation from raw SQL text.
- The dialogs make the selected request-parameter state visible before execution.

## Request Parameters

The current settings surface includes:

- `BypassBusinessLogicExecution`
- `BypassCustomPluginExecution`
- `SuppressCallbackRegistrationExpanderJob`

`BypassBusinessLogicExecutionStepIds` is shown as not implemented yet.

## Why This Matters

Write support is useful only if users can see what will happen before it happens. QueryVerse treats mutation as a deliberate follow-up step, not something hidden behind the same path as a read query.

<SCREENSHOT / GIF HERE>
