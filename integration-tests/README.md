# integration-tests

The `integration-tests` crate runs QueryVerse SQL scenarios against a real Dataverse environment.

## Requirements

- `secrets.json` in this folder
- a working Dataverse `connection_string`

See `secrets.example.json` for the expected shape.

## CLI

By default, the crate runs every configured scenario.

### Options

- `--scenario <id>`: Run only the named scenario or scenarios.
- `--list-scenarios`: Print the available scenario ids and exit.
- `--help`, `-h`: Print usage information.

You can pass multiple scenario ids in either of these forms:

```bash
cargo run -- --scenario basic-select --scenario join-basic
```

```bash
cargo run -- --scenario basic-select,join-basic
```

### Available scenario ids

- `basic-select`
- `where-filter`
- `aggregate-count`
- `aggregate-group-by`
- `group-by-having`
- `join-basic`
- `join-group-by`
- `left-join`
- `lookup-companion`
