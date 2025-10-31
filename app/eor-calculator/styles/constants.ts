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

// Animation styles for form reveals and transitions
export const ANIMATION_STYLES = {
  // Reveal animations for form sections
  REVEAL_SMOOTH: "transition-all duration-300 ease-in-out",
  REVEAL_FAST: "transition-all duration-200 ease-in-out", 
  REVEAL_SLOW: "transition-all duration-500 ease-in-out",
  
  // Height-based reveals (for expanding content)
  HEIGHT_SMOOTH: "transition-[max-height,opacity] duration-300 ease-in-out overflow-hidden",
  HEIGHT_FAST: "transition-[max-height,opacity] duration-200 ease-in-out overflow-hidden",
  
  // Opacity-based reveals  
  FADE_SMOOTH: "transition-opacity duration-300 ease-in-out",
  FADE_FAST: "transition-opacity duration-200 ease-in-out",
  
  // Combined smooth reveals (opacity + transform)
  SLIDE_FADE_UP: "transition-all duration-300 ease-in-out",
  SLIDE_FADE_DOWN: "transition-all duration-300 ease-in-out",
  
  // Animation states
  VISIBLE_STATE: "opacity-100 max-h-screen translate-y-0",
  HIDDEN_STATE: "opacity-0 max-h-0 -translate-y-2",
  
  // Professional timing variants
  TIMING_PROFESSIONAL: "duration-250 ease-out",
  TIMING_SMOOTH: "duration-300 ease-in-out",
  TIMING_SNAPPY: "duration-150 ease-out",
  
  // Elastic/Rubber band timing functions
  TIMING_BOUNCE_SUBTLE: "duration-400 cubic-bezier(0.68, -0.25, 0.265, 1.25)",
  TIMING_BOUNCE_MEDIUM: "duration-450 cubic-bezier(0.68, -0.55, 0.265, 1.55)", 
  TIMING_BOUNCE_STRONG: "duration-500 cubic-bezier(0.68, -0.8, 0.265, 1.8)",
  
  // Rubber band reveals with elastic timing
  HEIGHT_BOUNCE: "transition-[max-height,opacity,transform] duration-450 cubic-bezier(0.68, -0.55, 0.265, 1.55) overflow-hidden",
  SLIDE_BOUNCE: "transition-all duration-450 cubic-bezier(0.68, -0.55, 0.265, 1.55)",
  SCALE_BOUNCE: "transition-all duration-400 cubic-bezier(0.68, -0.25, 0.265, 1.25)",
  
  // Rubber band animation states  
  BOUNCE_VISIBLE_STATE: "opacity-100 max-h-screen translate-y-0 scale-100",
  BOUNCE_HIDDEN_STATE: "opacity-0 max-h-0 -translate-y-3 scale-95"
} as const