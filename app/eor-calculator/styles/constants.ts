// Form styling constants
export const FORM_STYLES = {
  // Input field styles
  INPUT_BASE: "h-12 border-2 focus:ring-2 focus:ring-primary/20 transition-all duration-200",
  INPUT_NORMAL: "border-slate-200 focus:border-primary",
  INPUT_ERROR: "border-red-500 focus:border-red-500",
  INPUT_READONLY: "bg-slate-50 text-slate-700",
  
  // Select styles
  SELECT_TRIGGER: "!h-12 border-2 border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200",
  
  // Label styles
  LABEL_BASE: "text-base font-semibold text-slate-700 uppercase tracking-wide",
  LABEL_SM: "text-sm font-medium text-slate-600",
  
  // Container styles
  SECTION_CONTAINER: "bg-white p-6 rounded-lg shadow-md",
  FORM_SPACING: "space-y-6",
  GRID_2_COL: "grid md:grid-cols-2 gap-4",
  GRID_3_COL: "grid md:grid-cols-3 gap-4",
  GRID_4_COL: "grid md:grid-cols-4 gap-4"
} as const

// Button styles
export const BUTTON_STYLES = {
  PRIMARY: "bg-primary text-white hover:bg-primary/90 focus:ring-2 focus:ring-primary/20",
  SECONDARY: "bg-slate-200 text-slate-700 hover:bg-slate-300",
  DANGER: "bg-red-500 text-white hover:bg-red-600"
} as const

// Status styles
export const STATUS_STYLES = {
  SUCCESS: "bg-green-100 text-green-800",
  WARNING: "bg-yellow-100 text-yellow-800", 
  ERROR: "bg-red-100 text-red-800",
  INFO: "bg-blue-100 text-blue-800",
  NEUTRAL: "bg-slate-100 text-slate-800"
} as const

// Icon container styles
export const ICON_STYLES = {
  PRIMARY_BG: "p-2 bg-primary/10 rounded-full",
  ICON_SIZE: "h-5 w-5 text-primary"
} as const