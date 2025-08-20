import React from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FORM_STYLES } from "../../styles/constants"

interface BaseFormFieldProps {
  label: string
  htmlFor?: string
  error?: string | null
  className?: string
  required?: boolean
}

interface InputFormFieldProps extends BaseFormFieldProps {
  type: "input"
  value: string
  onChange: (value: string) => void
  placeholder?: string
  readOnly?: boolean
  disabled?: boolean
  onBlur?: () => void
}

interface SelectFormFieldProps extends BaseFormFieldProps {
  type: "select"
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  options: Array<{ value: string; label: string }>
}

type FormFieldProps = InputFormFieldProps | SelectFormFieldProps

export const FormField = ({ label, htmlFor, error, className = "", required, ...props }: FormFieldProps) => {
  const inputClasses = `h-12 border-2 focus:ring-2 focus:ring-primary/20 transition-all duration-200 ${
    error ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-primary'
  } ${props.type === 'input' && props.readOnly ? 'bg-slate-50 text-slate-700' : ''}`

  const labelClasses = FORM_STYLES.LABEL_BASE

  return (
    <div className={`space-y-2 ${className}`}>
      <Label 
        htmlFor={htmlFor}
        className={labelClasses}
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      
      {props.type === "input" && (
        <Input
          id={htmlFor}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder={props.placeholder}
          readOnly={props.readOnly}
          disabled={props.disabled}
          onBlur={props.onBlur}
          className={inputClasses}
        />
      )}

      {props.type === "select" && (
        <Select
          value={props.value}
          onValueChange={props.onChange}
          disabled={props.disabled}
        >
          <SelectTrigger className={`!${inputClasses}`}>
            <SelectValue placeholder={props.placeholder} />
          </SelectTrigger>
          <SelectContent>
            {props.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <div className="h-6">
        {error && (
          <p className="text-red-500 text-sm mt-1">{error}</p>
        )}
      </div>
    </div>
  )
}