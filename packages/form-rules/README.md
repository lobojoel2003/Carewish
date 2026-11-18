# @carewish/form-rules

Machine-readable advance directive rules for all 50 U.S. states and the District of Columbia: the documents each state uses, how its forms are laid out, who may witness them, and when a notary is needed. Includes a small engine that checks proposed witnesses.

It is the rules layer of [Carewish](https://github.com/lobojoel2003/Carewish), released under the MIT license so other projects can reuse it.

> **Legal information, not legal advice.** The rules are compiled from state statutes and are marked `needs-review` until a qualified reviewer signs off on each state. When the law is unclear to us, a rule errs on the side of more formality (for example, asking for witnesses and a notary), so following it still produces a valid document. Please [report corrections](https://github.com/lobojoel2003/Carewish/issues/new?template=state_rule_correction.yml).

## Install

```bash
npm install @carewish/form-rules
```

## Use

```ts
import {
  requireState,
  evaluateWitnesses,
  signingChecklist,
  describeStep,
} from '@carewish/form-rules';

const california = requireState('CA');
const directive = california.documents[0]!; // Advance Health Care Directive

// Can my sister and my neighbor witness?
const result = evaluateWitnesses(directive.execution, [
  { name: 'Ana', relationship: 'sibling' },
  { name: 'Ben', relationship: 'none' },
]);
result.ok; // true: only one witness may be a relative or heir, and only Ana is

// Plain-language signing steps, in English or Spanish
for (const step of signingChecklist(directive)) {
  console.log(describeStep(step, california, 'es').join('\n'));
}
```

### API

| Export                                                                    | What it does                                                                                                                           |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `getState(code)` / `requireState(code)`                                   | Rules for one jurisdiction (`undefined` / throws for unknown codes).                                                                   |
| `listStates()`                                                            | All 51 jurisdictions sorted by name.                                                                                                   |
| `getDocument(code, id)`                                                   | One document of a state.                                                                                                               |
| `evaluateWitnesses(execution, candidates)`                                | Checks proposed witnesses. Separates problems with one witness from problems with the group, and hints about witnesses not chosen yet. |
| `evaluateNotary(execution, candidate)`                                    | Checks whether a proposed notary is disqualified.                                                                                      |
| `notaryNeed(execution)`                                                   | `required`, `alternative`, `recommended` or `not-needed`.                                                                              |
| `witnessQuestions(execution)`                                             | Which questions to ask about a witness for this state (so a form only asks what matters).                                              |
| `expandAttributes(candidate)`                                             | Every attribute that applies to a candidate, including ones derived from their relationship.                                           |
| `signingSummary(doc)` / `signingChecklist(doc)`                           | How a document must be signed, as data.                                                                                                |
| `documentsFor(state, { hasAgent, hasWishes })`                            | Which of a state's documents a person needs.                                                                                           |
| `describeStep`, `describeAttribute`, `agentTerm`, `translate`, `localize` | English and Spanish text for all of the above. `locales` holds the i18next-compatible JSON.                                            |

The raw files are also exported: `@carewish/form-rules/states/CA.yaml`, `@carewish/form-rules/schema/state.schema.json` and `@carewish/form-rules/locales/en.json`.

## The data

Each state is one YAML file in [`states/`](./states), validated by [`schema/state.schema.json`](./schema/state.schema.json):

```yaml
code: CA
name: California
adultAge: 18
terminology:
  agent: agent # what the form calls the person who decides for you
documents:
  - id: advance-health-care-directive
    title: Advance Health Care Directive
    kind: combined # power-of-attorney | living-will | combined
    citation: Cal. Prob. Code § 4701
    parts: # the form's own parts, in order, with the fields each holds
      - title: 'Part 1: Power of Attorney for Health Care'
        sections: [principal, agent, alternate-agent, agent-authority]
      - title: 'Part 2: Instructions for Health Care'
        sections: [life-sustaining, nutrition, cpr, pain-relief, values, additional-wishes]
    execution:
      method: witnesses-or-notary # witnesses | notary | witnesses-or-notary | witnesses-and-notary | signature-only
      witnesses:
        count: 2
        minAge: 18
        rules:
          - type: none-may-be # no witness may be any of these
            attributes:
              [agent, healthcare-provider, provider-employee, facility-operator, facility-employee]
          - type: at-least-one-not # at least one witness must be none of these
            attributes: [relative, heir]
      special:
        - id: skilled-nursing-facility
          text:
            en: If you live in a skilled nursing facility, a patient advocate or ombudsman must also sign as a witness…
            es: Si vive en un centro de enfermería especializada…
sources:
  - citation: Cal. Prob. Code §§ 4670–4743
review:
  status: needs-review
  lastChecked: 2026-11-18
```

Witness rules use three rule types (`none-may-be`, `at-least-one-not`, `at-most-one`) over a fixed vocabulary of attributes:

| Attribute                                                                                                          | Meaning                                                                     |
| ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `agent`                                                                                                            | Named as the agent or an alternate                                          |
| `spouse`, `immediate-family`, `relative-within-third-degree`, `blood-relative`, `relative-by-marriage`, `relative` | Derived from the witness's `relationship`                                   |
| `heir`, `beneficiary`, `creditor`, `financially-responsible`                                                       | Money ties: would inherit, gains from the death, has a claim, pays for care |
| `physician`, `attending-physician`, `healthcare-provider`, `provider-employee`                                     | Medical ties                                                                |
| `facility-operator`, `facility-employee`, `insurer-employee`                                                       | Institutional ties                                                          |
| `signed-for-principal`                                                                                             | Signed the form for the person                                              |

## Contributing a correction

1. Edit `states/XX.yaml`. Cite the statute in `sources` or the document's `citation`.
2. Run `pnpm --filter @carewish/form-rules test`. The build validates every file against the schema and runs semantic checks (for example, a group rule needs at least two witnesses).
3. Open a pull request. If you are an attorney or another qualified reviewer, set `review.status: reviewed` and `review.reviewer`.

## License

[MIT](./LICENSE). The Carewish app that uses this library is AGPL-3.0.
