# Munshi — Personal Finance Coach for India

> *The accountant who remembers you.*

Munshi is a private, zero-cost personal finance coach and modern *bahi-khata* designed for Indian households. It parses messy Indian bank SMS messages and statements, categorizes expenditures, audits recurring subscriptions ("quiet leaks"), runs deterministic multi-month goal projections, and delivers a voice-enabled dispatch from your future self.

---

## Architecture & Views

```
Overview  ──►  Paste  ──►  Ledger  ──►  Quiet leaks  ──►  Plan  ──►  Future You
(Home)         (Intake)    (Journal)   (Subscriptions)   (Course)   (Voice & Letter)
```

1. **Overview (`/overview` or `/`)**:
   - Modern fintech dashboard with greeting in Fraunces 28px.
   - 4 KPI cards: Spent this month, Left this month, Goal progress ring, Subscriptions per year.
   - Recharts Donut chart with category palette & center total label.
   - Cash Flow grouped bar chart (Monthly In vs Out).
   - "Munshi says" insight card highlighting pacing drift and actionable savings.
   - Recent transactions with category chips and avatars.

2. **Paste (`/paste`)**:
   - Two-column intake desk with segmented tabs (Paste texts / Upload file).
   - Live client-side SMS detection counter.
   - Drag-and-drop CSV statement parser scanning past bank preambles.
   - Real 3-step progress checklist (Reading messages → Sorting into categories → Looking for subscriptions).
   - Supported bank formats guide and privacy notice.

3. **Ledger (`/ledger`)**:
   - 56px high transaction rows with merchant avatars and category chips.
   - Category combobox popover: fixing any category creates a rule, flashes affected rows in primary tint for 1.2s, and triggers a Sonner toast with an 8-second **Undo** action.
   - Search input, category multi-filter, type filter (All / Money out / Money in).
   - Slide-in right drawer with complete transaction details, original raw message, copy button, and merchant history.
   - Client-side CSV export.

4. **Quiet leaks (`/leaks`)**:
   - Audits weekly, monthly, and yearly subscriptions.
   - Annual recurring commitment count-up with a stacked category color share bar.
   - Detects price hikes (e.g. Hotstar ₹149 → ₹299), unused companion memberships (e.g. Swiggy One with ≤1 order in 3 months), and overlapping streaming services.
   - Segmented Keep / Cancel controls with live savings calculation.
   - Sticky bottom bar to port savings directly into the Plan.

5. **Plan (`/plan`)**:
   - Mid-month spend pacing drift alerts with calculation popovers.
   - Grouped cards for monthly income, editable fixed costs with `+` / `-` steppers, and goal milestone parameters.
   - Recharts area/line chart plotting status-quo, plan trajectory with subtle gradient fill, and what-if scenarios.
   - Top category sliders (-50% to +50%) with live monthly savings effects.
   - Rent stepper (₹500 increments) and one-click presets.

6. **Future You (`/letter`)**:
   - 120px CSS gradient orb that animates softly and pulses during audio playback.
   - Paper-toned letter card (`#FBF8F1`) in Fraunces 21px with interactive sentence-level highlight tracking and click-to-seek.
   - Speech controls: Play/Pause, speed (0.9x, 1x, 1.25x), voice tones (Warm, Calm, Deep), and download testimony.
   - Conversational voice & text dialogue with speech recognition (`en-IN`), typing indicators, and instant simulation answers.

---

## Design System & Tokens

- **Palette**:
  - Canvas: `#F6F4EF`
  - Surface: `#FFFFFF`
  - Border: `#E7E2D8`
  - Ink: `#14201B`
  - Muted: `#5E6B64`
  - Primary Deep Green: `#0E5A44` (tint `#E6F2EC`)
  - Accent Saffron: `#E8890C` (tint `#FDF1DD`)
  - Danger: `#C0392B` (tint `#FBEAE7`)
  - Success: `#1B7F5C`
- **Typography**: Inter for all UI, Fraunces for editorial greetings and the Future You letter. Tabular numbers enabled across all numerical and currency displays.
- **Controls & Radiuses**: Cards `14px`, controls `10px`, focus ring `2px` with `2px` offset.

---

## Privacy & Security Guarantees

- **Zero-Cost & Database-Free**: No database, no paid services. State is maintained in browser `localStorage`.
- **Stateless Backend**: Route handlers (`app/api/*`) are purely stateless, accepting data in request bodies (capped at 300 KB).
- **Client-Side Privacy**: Raw SMS, account numbers, and complete transaction lists are never logged or sent to LLMs. Only aggregate summary figures are passed for letter generation.
- **Graceful Fallback**: App remains 100% operational offline or when Gemini API keys are absent.

---

## Local Development

### 1. Requirements
- Node.js 18+ (tested on Node 20 and Node 24)
- npm 9+

### 2. Setup
1. Clone or navigate to the workspace:
   ```bash
   git clone https://github.com/saiesh10/Munshi-Personal-Finance-Coach.git
   cd Munshi-Personal-Finance-Coach
   ```
2. Copy the environment configuration:
   ```bash
   cp .env.example .env.local
   ```
3. *(Optional)* Add a free Gemini API key from [Google AI Studio](https://aistudio.google.com/).
4. Install dependencies:
   ```bash
   npm install
   ```
5. Run the development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

---

## Testing

### Unit Test Suite (`node:test`)
Run all 29 unit tests across 9 domain suites:
```bash
npm test
```

### Production Build Verification
```bash
npm run build
```

### End-to-End Smoke Tests
Verify all 8 API endpoints on a live instance:
```bash
npm run smoke
```
