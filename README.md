# GraceMark Quote Calculator

This is a Next.js application that provides two main features: an Employer of Record (EOR) cost calculator and an Independent Contractor (IC) cost calculator. It also includes a currency converter.

## Features

- **EOR Cost Calculator:** Calculates the total cost of hiring an employee in a specific country, taking into account salary, benefits, and other statutory costs. It uses the Deel and Remote APIs to get the cost estimations.
- **IC Cost Calculator:** Calculates the total cost of hiring an independent contractor, taking into account their pay rate, bill rate, and other fees.
- **Currency Converter:** Converts currencies using the Remote API.

## Getting Started

To get the project up and running, follow these steps:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/gracemark-quote.git
   ```
2. **Install the dependencies:**
   ```bash
   pnpm install
   ```
3. **Create a `.env.local` file** in the root of the project and add the following environment variables:
    ```
    # Provider APIs
    REMOTE_API_TOKEN=your_remote_api_token
    DEEL_ORGANIZATION_TOKEN=your_deel_organization_token

    # Groq LLM (Enhancement Engine)
    # Single key (default)
    GROQ_API_KEY=your_groq_api_key
    # Optional: enable provider-specific keys to spread load (Pass 2)
    GROQ_MULTI_KEY_ENABLED=false
    # Mapping: 1: deel, 2: remote, 3: rivermate, 4: oyster, 5: rippling, 6: skuad, 7: velocity, 8: playroll, 9: omnipresent
    GROQ_API_KEY_1=
    GROQ_API_KEY_2=
    GROQ_API_KEY_3=
    GROQ_API_KEY_4=
    GROQ_API_KEY_5=
    GROQ_API_KEY_6=
    GROQ_API_KEY_7=
    GROQ_API_KEY_8=
    GROQ_API_KEY_9=
    # Optional overrides
    GROQ_MODEL=openai/gpt-oss-20b
    GROQ_TEMPERATURE=0.1
    GROQ_MAX_TOKENS=2048
    GROQ_RATE_LIMIT_RPM=30
    GROQ_REQUEST_TIMEOUT_MS=30000
    # Optional: retry and overall timeout budget
    # Default retries = 1 (total attempts = retries + 1). Set to 0 to disable retries.
    GROQ_MAX_RETRIES=1
    # Caps total time for a single LLM operation across retries (ms)
    GROQ_TOTAL_TIMEOUT_MS=60000
    ```
4. **Run the development server:**
    ```bash
    pnpm dev
    ```
5. **Open your browser** and navigate to `http://localhost:3000`.

## Technologies Used

- [Next.js](https://nextjs.org/) - React framework for building server-side rendered and static web applications.
- [React](https://reactjs.org/) - JavaScript library for building user interfaces.
- [TypeScript](https://www.typescriptlang.org/) - Typed superset of JavaScript that compiles to plain JavaScript.
- [Tailwind CSS](https://tailwindcss.com/) - A utility-first CSS framework for rapid UI development.
- [shadcn/ui](https://ui.shadcn.com/) - A collection of re-usable components built using Radix UI and Tailwind CSS.
- [Deel API](https://developers.deel.com/) - Used for EOR cost estimations.
- [Remote API](https://developer.remote.com/) - Used for EOR cost estimations and currency conversion.

## API Endpoints

### Provider Cost Calculations
- `POST /api/eor-cost` - Deel cost estimation
- `POST /api/remote-cost` - Remote cost estimation
- `POST /api/oyster-cost` - Oyster cost estimation
- `POST /api/rippling-cost` - Rippling cost estimation
- `POST /api/rivermate-cost` - Rivermate cost estimation
- `POST /api/skuad-cost` - Skuad cost estimation
- `POST /api/velocity-cost` - Velocity cost estimation
- `POST /api/ic-cost` - Independent Contractor cost calculation

### Utilities
- `POST /api/currency-converter` - Currency conversion
- `GET /api/eor-validations/[country_code]` - Country-specific EOR validations
- `POST /api/eor-benefits` - Benefits information
- `POST /api/eor-benefits/attachment` - Benefits attachment handling
- `POST /api/categorize-costs` - Cost categorization
- `POST /api/reconciliation` - Cost reconciliation

### Enhancement Engine (LLM)
- `POST /api/enhancement/quote` - Enhance single provider quote
- `POST /api/enhancement/batch` - Enhance multiple quotes
- `GET /api/enhancement/debug` - Debug endpoints

## File Structure

```
app/
├── api/                    # API routes
│   ├── *-cost/            # Provider cost endpoints (7 providers)
│   ├── ic-cost/           # IC cost calculation
│   ├── currency-converter/
│   ├── eor-validations/
│   ├── eor-benefits/
│   ├── categorize-costs/
│   ├── reconciliation/
│   └── enhancement/       # LLM enhancement engine
├── quote/                 # EOR calculator
│   ├── components/
│   └── hooks/            # Provider-specific hooks
└── ic-calculator/         # IC calculator
    ├── components/
    └── hooks/
components/ui/             # shadcn/ui components
lib/                       # Utilities and data
```
