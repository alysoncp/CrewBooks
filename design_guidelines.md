# Design Guidelines: Tax & Finance Management App for Film/TV Industry

## Design Approach

**Selected Framework**: Design System Approach drawing from modern financial SaaS applications (QuickBooks Online, Wave, FreshBooks) combined with Linear's clean typography and spatial relationships.

**Rationale**: This is a utility-focused, information-dense productivity tool where clarity, efficiency, and data entry optimization are paramount. Users need to quickly input financial data, review calculations, and understand their tax position.

## Core Design Principles

1. **Data Clarity First**: Financial information must be immediately scannable and understandable
2. **Efficient Data Entry**: Forms should minimize friction and cognitive load
3. **Trust & Professionalism**: Visual treatment reinforces financial competency and security
4. **Mobile-Ready Foundation**: Design for touch targets and smaller viewports from the start

## Typography System

**Font Stack**:
- Primary: Inter (Google Fonts) - for UI elements, body text, and data
- Monospace: JetBrains Mono - for financial figures, amounts, and calculations

**Hierarchy**:
- Page Headers: 2xl to 3xl, semibold
- Section Headers: xl, semibold  
- Card Titles: lg, medium
- Body Text: base, regular
- Financial Data: lg to xl, medium (monospace)
- Helper Text: sm, regular
- Labels: sm, medium

## Layout System

**Spacing Units**: Use Tailwind spacing primitives of 2, 3, 4, 6, 8, 12, 16, 24
- Component padding: p-4 to p-6
- Card spacing: p-6 on desktop, p-4 on mobile
- Section gaps: gap-6 to gap-8
- Form field spacing: space-y-4
- Dashboard widget gaps: gap-6

**Grid System**:
- Dashboard: 3-column grid on desktop (grid-cols-3), 1-column on mobile
- Transaction lists: Full-width single column with alternating row treatment
- Forms: 2-column on desktop for related fields, single column on mobile

**Container Strategy**:
- Main content area: max-w-7xl with responsive padding (px-4 md:px-6 lg:px-8)
- Forms and data entry: max-w-2xl for focused input experience
- Full-width tables: w-full with horizontal scroll on mobile

## Component Library

### Navigation
- **Top Navigation Bar**: Fixed header with app logo, user profile dropdown, notification icon
- **Sidebar Navigation**: Collapsible on mobile, persistent on desktop with icon + label pattern
  - Dashboard, Income, Expenses, Receipts, Tax Calculator, Optimization Tool, Profile sections
  - Active state: subtle background treatment and medium weight text

### Dashboard Widgets
- **Metric Cards**: Display key financial figures (Total Income, Total Expenses, Net Income, Tax Owed)
  - Layout: Icon or small graphic + Label + Large number (monospace) + Trend indicator
  - Card style: Subtle border, rounded corners (rounded-lg), shadow-sm
- **Chart Containers**: Monthly/yearly views with consistent padding and clear axis labels

### Data Entry Forms
- **Input Fields**: 
  - Label above input, helper text below
  - Consistent height (h-10 to h-12)
  - Focus states clearly indicated
  - Prefix symbols for currency ($, %)
- **Date Pickers**: Calendar icon + formatted date display
- **Category Dropdowns**: Searchable select with industry-specific categories
- **Amount Inputs**: Right-aligned numbers in monospace font
- **Photo Upload**: 
  - Large drop zone with dashed border
  - Thumbnail preview grid (grid-cols-3 gap-4)
  - Individual image cards with remove option

### Transaction Lists
- **Table Layout**: 
  - Columns: Date, Description, Category, Amount, Actions
  - Sticky header on scroll
  - Row hover state for interaction affordance
  - Zebra striping for scanability (subtle)
- **Mobile Cards**: Stack transaction details vertically with clear hierarchy

### Tax Calculator Module
- **Two-Panel Layout**: 
  - Left: Input parameters (income, expenses, filing status)
  - Right: Live calculation results with breakdown
- **Filing Status Toggle**: Clear radio buttons for Personal Only vs. Personal + Corporate
- **Results Display**: Hierarchical breakdown showing calculations step-by-step

### Optimization Tool
- **Comparison View**: Side-by-side cards showing different dividend/salary split scenarios
- **Slider Control**: Interactive slider to adjust ratio with live updates
- **Recommendation Badge**: Highlight optimal strategy

### Profile Section
- **Settings Cards**: Grouped by category (Account Info, Tax Settings, Subscription Tier)
- **Subscription Tier Display**: Clear feature comparison with current tier highlighted

## Interaction Patterns

- **Loading States**: Skeleton screens for data tables, spinner for calculations
- **Empty States**: Friendly illustrations with clear CTAs ("Add your first receipt")
- **Error Handling**: Inline validation messages, toast notifications for system errors
- **Confirmation Dialogs**: Modal overlays for destructive actions (delete transaction)

## Responsive Behavior

**Breakpoints**:
- Mobile: < 768px (single column, stacked navigation)
- Tablet: 768px - 1024px (condensed sidebar, 2-column forms)
- Desktop: > 1024px (full layout with persistent sidebar)

**Mobile Optimizations**:
- Bottom navigation for primary actions
- Swipe gestures for transaction actions
- Touch-friendly targets (min h-12)
- Camera integration for receipt capture

## Accessibility Requirements

- Consistent form field implementation across all input types
- Proper heading hierarchy (h1 → h2 → h3)
- ARIA labels for icon-only buttons
- Keyboard navigation for all interactive elements
- Sufficient contrast ratios for financial data readability
- Screen reader support for chart data (data tables as fallback)

## Images

No hero images required for this application interface. All visuals should be functional:
- Empty state illustrations (simple line drawings)
- Receipt photo thumbnails (user-uploaded)
- User profile avatars
- Category icons for expense types