# Component Architecture Rules

When working with Firecrawl components in the components-new directory:

## Directory Structure
- Place raw, unstyled base components in `/components/ui`
- Place composed, reusable components in `/components/shared` (must be used in 2+ places)
- Place page-specific components in `/components/app/[page-name]`
- ShadCN UI components go in `/components/ui/shadcn`
- Framer Motion primitives go in `/components/ui/motion`

## Component Guidelines

### UI Primitives (/ui)
- Keep components raw and minimally styled
- No app-specific styling or business logic
- Examples: base button, motion fade-in, base input

### Shared Components (/shared)
- Must be used in multiple places (2+ locations)
- Follow fire design system (heat colors, rounded-12, orange glows)
- Examples: SlateButton, HeatButton, DashboardCard, FlameBackground
- Organized by type: buttons/, cards/, effects/, icons/, layout/, modals/

### App Components (/app)
- Only used in single page/route
- Named specifically for their context
- Examples: OverviewChart (dashboard), SettingsSidebar (settings)

## Fire Design System
- Use heat scale colors: `heat-4` to `heat-200`
- Apply scale animation on click: `active:scale-[0.98]`
- Use standard border radius: `rounded-12`
- Add orange glow effects where appropriate

## Import Patterns
```tsx
// Primitives
import { Button } from '@/components/ui/shadcn/button';
import { FadeIn } from '@/components/ui/motion/fade-in';

// Shared components
import { SlateButton } from '@/components/shared/buttons/slate-button';
import { FlameBackground } from '@/components/shared/effects/flame-background';
import { DashboardCard } from '@/components/shared/cards/dashboard-card';

// Page-specific
import { UsageChart } from '@/components/app/dashboard/overview/usage-chart';

// Shared features
import { TeamSwitcher } from '@/components/shared/teams/team-switcher';
import { BillingBanner } from '@/components/shared/billing/billing-banner';
```

## Component Creation Checklist
1. Determine scope: Is it used in multiple places? > `/shared`, Single page? > `/app`
2. Check for existing similar components to extend/compose
3. Follow fire design conventions (colors, animations, spacing)
4. Export properly in relevant index.ts for clean imports
5. Document props with TypeScript interfaces and clear descriptions