# Interpretation orchestration

One chart job constructs one `SchemaClient` instance. The client lazily creates one OpenAI conversation and every bounded call must retain that exact conversation ID. A changed or missing ID fails the job. A later chart job receives a new client and must therefore receive a different conversation.

Each `InterpretationCall` owns one strict schema, one cohesive responsibility, its permitted deterministic references, input projection and field-level audit. Failed audit retries only that call. The OpenAI wrapper's broad parse retry is disabled here so astral-charts remains responsible for semantic validation and retry scope.

Big calls use `OPENAI_BIG_MODEL`. Explicit utility calls use `OPENAI_SMALL_MODEL`. Call hooks feed weighted progress without counting retries as completed units. Ordinary tests use a fake `SchemaClient`; no OpenAI request is made.
