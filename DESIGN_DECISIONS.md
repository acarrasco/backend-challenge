# Design Decisions Record

## About Type Safety

A best effort has been done to improve type safety where possible, without undertaking a whole code rewrite.

Extra things that could be done:

- Strictly type the mapping from task types to jobs
- Add schema validation to workflow definition yaml
- Generic type signatures for Jobs, so inputs match with dependencies outputs

## About Design Patterns

The approach taken has been to improve things as they became an annoyance, rather than rewrite everything to make it perfect from the get-go.

For example:

- `TaskRunner` was implicitly couped to all the repositories, so adding unit tests for it would have been a nightmare. Using dependency inversion seemed a good way to make it cleaner.
- Some classes and functions that relied on hardcoded imports were also updated to use dependency injection.

Things that could be done, but did not feel like the right time to put effort into them:

- Decompose the business logic into smaller use cases.
- Separate handler logic from business logic.

## Job Dependencies

There were two clear approaches to implement job dependencies: normalized or denormalized representation.

### Normalized

With a normalized representation, we would explicitly model the relation between tasks with a join table.

This eliminates possible inconsistencies between the a given task state and its dependencies state, since it can be derived at any time.

The problem is that the query to fetch a ready task is complex and would need to deal with raw results in _TypeORM_, which is not desirable.

### Denormalized

With the denormalized approach, we simply store the dependencies step numbers for a task as a json column and add new `TaskState` values to track when a task is ready.

Whenever a job finishes, we go trough the all tasks in the workflow and update their status if necessary.

This is a potentially costly operation for big workflows, but it is probably offset by having simpler queries and less indices in the DB.

## Results Aggregation

There was nothing specified about how the results should be aggregated; so a simple text enumeration was chosen.

## Concurrency Issues

In our simple application where the task worker picks tasks at a very slow pace and in a single thread, it is very unlikely that we encounter any problems. But if we increase the worker frequency or add more workers, `TaskRunner` is a ticking time bomb.

There is no mechanism in place to prevent the same task to be run multiple times, or if two tasks that are a dependency for a third one finalize simultaneously the dependent task might not have its status properly updated by either task (in each worker it sees only one of its dependencies fulfilled).

Optimistic locking seems a good solution for a low volume of tasks, as it is simpler, not prone to deadlocks, and efficient when conflicts are rare (akin to a roundabout vs a set of traffic lights).

The requirements did not specify anything about concurrency, so we will leave this as an observation.
