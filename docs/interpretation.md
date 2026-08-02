# Interpretation orchestration

`kitty-crow/openai-schema` is the sole OpenAI runtime. `astral-charts` does not construct Conversations API or Responses API requests and does not depend on a second OpenAI SDK.

The runtime path is:

```text
fixed interpretation plan
  -> astral-charts sequencing and local audit
  -> OpenAISchema.run(...)
  -> OpenAI Conversations and Responses APIs
```

## One conversation per chart

One chart job constructs one `OpenAISchema` instance through the local `SchemaClient` adapter. The library lazily creates one OpenAI conversation and attaches every subsequent schema call to that exact conversation.

After each call, `astral-charts` verifies that a conversation ID exists and has not changed. A missing or changed ID fails the chart. A later chart job constructs a new client, so conversations cannot be shared between charts.

Calls remain ordered and serial within that conversation. This preserves deterministic field order, lets every accepted field participate in later duplicate checks and avoids concurrent writes racing against shared conversation state.

The conversation ID is runtime state. It is not written into the calculation, interpreted chart or `.astral` file.

## Interrupted runs

Interpretation can emit an `InterpretationCheckpoint` before and after remote calls and after each accepted field. It contains:

- the established conversation ID
- accepted field results
- total call and retry counts
- the active field, attempt and narrow audit correction

Recovery must contain a completed prefix of the fixed plan. Every recovered field is re-audited in its original order, rebuilding cross-field duplicate context before generation continues. The `SchemaClientFactory` then reopens the stored conversation ID and starts at the active attempt or first unfinished field.

`ChartGenerationCheckpoint` combines this state with the deterministic calculation, calculation fingerprint and exact runtime version. See [Temporary job recovery](recovery.md) for storage and lifecycle rules.

## Responsibility split

`openai-schema` owns:

- conversation creation
- Responses API transport
- attaching calls to the active conversation
- changing the strict JSON schema between fields
- extracting and parsing structured JSON output
- serialising queued calls on the same client
- reopening an explicitly supplied conversation ID

`astral-charts` owns:

- the fixed interpretation plan
- one cohesive schema field per call
- deterministic input projection
- model, reasoning and token-budget routing
- source-reference permissions
- local deterministic NLP audit
- safe mechanical repair
- narrow field retry
- checkpoint validation and resume order
- progress and final chart assembly

There is no duplicate Responses API implementation in `astral-charts`.

## Field calls

Every `InterpretationCall` has:

- one stable ID and label
- one strict output schema
- one cohesive chart responsibility
- only the relevant deterministic source objects
- an explicit set of permitted local JSON references
- one recursive field audit
- a bounded model, reasoning and output-token route

The LLM never selects fields, availability, placements, house systems, aspects, dignity, compatibility scores or ranks.

Routing follows `astral-model-routing/1.0.1`:

- narrow leaf fields begin on `OPENAI_SMALL_MODEL`, no reasoning and at most 1,800 output tokens
- an audited retry for a narrow field escalates to `OPENAI_BIG_MODEL` with low reasoning while keeping the same field schema, correction and conversation
- chart overviews, compatibility overviews and life sections use `OPENAI_BIG_MODEL`, low reasoning and at most 3,200 output tokens
- zodiac, cross-system and final syntheses use `OPENAI_BIG_MODEL`, configured reasoning and at most 6,000 output tokens
- the generated three-word chart name uses `OPENAI_SMALL_MODEL`, no reasoning and at most 128 output tokens unless it itself requires an audited retry

Every route is also capped by `OPENAI_MAX_OUTPUT_TOKENS`, so an operator may impose a stricter global ceiling.

When the subject supplied no name, the utility runs in the same chart conversation after the substantive fields. It must return exactly three hyphenated words. Its temporary result is removed from the interpretation-unit map before strict chart assembly, while its call and retry counts remain in provenance.

## Unavailable fields

If every permitted deterministic source for an ordinary generic section is unavailable, the host constructs a deterministic `status: unavailable` section and makes no LLM call.

Specialised fields and synthesis units must retain at least one available deterministic source. Their absence is a calculation or plan error rather than an invitation for the model to improvise.

## Audit and retries

The strict schema parser validates structure first. Local NLP audit then examines every substantive string and string-array item, including specialised romance, sexuality, career, money, compatibility and synthesis fields.

Audit checks include:

- process narration and boilerplate
- disclaimers
- placeholders
- forbidden formatting
- semantic relevance
- duplicate list entries
- near-duplication across interpretation fields
- local source-reference resolution
- source-reference permission and deterministic availability

A failed audit retries only that interpretation unit. The retry receives the exact audit failures and must return the same strict schema. Narrow fields escalate from nano to mini after the first failed audit rather than spending every attempt on the cheaper model. Broad parse retries inside `openai-schema` remain disabled so semantic retry scope stays under host control.

## Transport options

The adapter passes the routed model, reasoning effort, output-token limit, `store: false`, developer instructions and metadata into `OpenAISchema.run(...)`. The library adds the strict JSON schema and active or recovered conversation itself.

Ordinary tests use fake clients or an injected fake `fetch`. They verify the real request shape without contacting OpenAI.
