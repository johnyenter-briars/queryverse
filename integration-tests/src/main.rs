mod config;
mod query;
mod scenarios;

use std::collections::HashSet;
use std::future::Future;
use std::pin::Pin;

use powerplatform_dataverse_client::dataverse::serviceclient::ServiceClient;

type ScenarioFn =
    for<'a> fn(&'a ServiceClient) -> Pin<Box<dyn Future<Output = Result<(), String>> + 'a>>;

struct Scenario {
    id: &'static str,
    name: &'static str,
    run: ScenarioFn,
}

#[derive(Default)]
struct CliArgs {
    selected_scenarios: Vec<String>,
    list_scenarios: bool,
}

#[tokio::main]
async fn main() -> Result<(), String> {
    let scenarios = [
        Scenario {
            id: "basic-select",
            name: "basic select",
            run: scenarios::basic_select::run,
        },
        Scenario {
            id: "where-filter",
            name: "where filter",
            run: scenarios::where_filter::run,
        },
        Scenario {
            id: "aggregate-count",
            name: "aggregate count",
            run: scenarios::aggregate_count::run,
        },
        Scenario {
            id: "aggregate-group-by",
            name: "aggregate group by",
            run: scenarios::aggregate_group_by::run,
        },
        Scenario {
            id: "group-by-having",
            name: "group by having",
            run: scenarios::group_by_having::run,
        },
        Scenario {
            id: "join-basic",
            name: "join basic",
            run: scenarios::join_basic::run,
        },
        Scenario {
            id: "join-group-by",
            name: "join group by",
            run: scenarios::join_group_by::run,
        },
        Scenario {
            id: "left-join",
            name: "left join",
            run: scenarios::left_join::run,
        },
        Scenario {
            id: "lookup-companion",
            name: "lookup companion",
            run: scenarios::lookup_companion::run,
        },
    ];

    let cli = parse_cli_args()?;
    if cli.list_scenarios {
        print_scenarios(&scenarios);
        return Ok(());
    }

    let selected = validate_selected_scenarios(&scenarios, &cli.selected_scenarios)?;
    let client = query::create_client().await?;
    let mut attempted = false;

    for scenario in scenarios {
        if !selected.is_empty() && !selected.contains(scenario.id) {
            continue;
        }

        attempted = true;
        run_scenario(scenario.name, &client, scenario.run).await?;
    }

    if !attempted {
        return Err("No selected scenarios were run.".to_string());
    }

    Ok(())
}

fn parse_cli_args() -> Result<CliArgs, String> {
    let mut cli = CliArgs::default();
    let mut args = std::env::args().skip(1);

    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--scenario" => {
                let value = args
                    .next()
                    .ok_or_else(|| "--scenario requires a value".to_string())?;
                cli.selected_scenarios.extend(split_scenario_values(&value));
            }
            "--list-scenarios" => cli.list_scenarios = true,
            "--help" | "-h" => {
                print_usage();
                std::process::exit(0);
            }
            _ => {
                if let Some(value) = arg.strip_prefix("--scenario=") {
                    cli.selected_scenarios.extend(split_scenario_values(value));
                } else {
                    return Err(format!("Unknown argument: {arg}"));
                }
            }
        }
    }

    Ok(cli)
}

fn split_scenario_values(value: &str) -> Vec<String> {
    value
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.to_string())
        .collect()
}

fn validate_selected_scenarios(
    scenarios: &[Scenario],
    selected: &[String],
) -> Result<HashSet<&'static str>, String> {
    let valid_ids: HashSet<&'static str> = scenarios.iter().map(|scenario| scenario.id).collect();
    let mut validated = HashSet::new();

    for scenario in selected {
        if !valid_ids.contains(scenario.as_str()) {
            return Err(format!(
                "Unknown scenario '{scenario}'. Use --list-scenarios to see valid values."
            ));
        }

        validated.insert(
            scenarios
                .iter()
                .find(|candidate| candidate.id == scenario)
                .map(|candidate| candidate.id)
                .expect("validated scenario id should exist"),
        );
    }

    Ok(validated)
}

fn print_scenarios(scenarios: &[Scenario]) {
    println!("Available scenarios:");
    for scenario in scenarios {
        println!("  {} ({})", scenario.id, scenario.name);
    }
}

fn print_usage() {
    println!("Usage: cargo run -- [--scenario <id>[,<id>...]] [--list-scenarios]");
    println!();
    println!("Options:");
    println!("  --scenario <id>         Run one or more specific scenarios.");
    println!("                          Repeat the flag or pass a comma-separated list.");
    println!("  --list-scenarios        Print the available scenario ids and exit.");
    println!("  --help, -h              Show this help text.");
}

async fn run_scenario(
    name: &str,
    client: &ServiceClient,
    scenario: ScenarioFn,
) -> Result<(), String> {
    println!("Running scenario: {name}");
    scenario(client).await?;
    println!("Completed scenario: {name}");
    Ok(())
}
