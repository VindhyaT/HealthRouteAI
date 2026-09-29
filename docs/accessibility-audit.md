# Frontend accessibility audit

Scope: source/semantic review, automated Chrome keyboard interaction, and contrast calculations for selected theme colors. This is not a complete WCAG conformance assessment or a human screen-reader evaluation.

## Improvements made

- Added a visible, associated label for the assistant question and a heading association for its section.
- Connected registration password guidance and password errors through `aria-describedby`.
- Named authentication forms and added an announced connecting status.
- Added a programmatic HTML label for admin search.
- Named record action buttons with the affected record (for example, “Edit Cardiology”). Updated existing test selectors accordingly.
- Return focus to the mobile menu button when Escape closes its navigation, avoiding focus remaining in hidden content.
- Use a light focus outline on the dark assistant surface, retaining a dark outline inside its white recommendation cards.
- Mark redundant decorative icons `aria-hidden`; no content images requiring alternative text were found in the reviewed UI.

## Existing behavior verified

- Skip link moves keyboard focus to main content.
- Sign-in dialog initial focus, Tab containment, Escape close, and trigger focus restoration.
- Delete dialog name/description, initial Cancel focus, Escape cancellation, and trigger focus restoration.
- Admin editor initial field focus.
- Field errors, invalid states, error associations, and first-invalid-field focus.
- Native buttons, links, inputs, select controls, details/summary, and dialog elements support keyboard interaction.
- Existing visible focus rules and reduced-motion styles remain in place.
- No positive tabindex ordering introduced.

## Verification

Production build passed. Four Chrome scenarios passed in `accessibility.spec.ts` and `validation.spec.ts`, using controlled API responses. These tests verify UI behavior; they do not certify screen-reader output or measure every rendered color combination.

Selected contrast ratios calculated from CSS colors:

| Pair | Ratio |
| --- | --- |
| Body text / page background | 12.15:1 |
| Muted text / white | 6.04:1 |
| Primary button text / teal | 6.98:1 |
| Error text / error background | 7.28:1 |
| Assistant label / dark panel | 7.07:1 |
| Light focus ring / dark panel | 5.97:1 |
| Standard focus ring / white | 4.30:1 |

Follow-up: manual VoiceOver/NVDA use, full rendered contrast scanning, high-contrast mode, and physical-device testing remain outside this audit.
