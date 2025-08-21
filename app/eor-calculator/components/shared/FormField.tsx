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

interface CheckboxGroupFormFieldProps extends BaseFormFieldProps {
  type: "checkbox-group"
  value: string | null
  onChange: (value: string | null) => void
  options: Array<{ value: string; label: string }>
  disabled?: boolean
}

type FormFieldProps = InputFormFieldProps | SelectFormFieldProps | CheckboxGroupFormFieldProps

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

      {props.type === "checkbox-group" && (
        <div className="flex gap-4 mt-2">
          {props.options.map((option) => (
            <label 
              key={option.value}
              className="flex items-center gap-2 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={props.value === option.value}
                onChange={(e) => {
                  if (e.target.checked) {
                    props.onChange(option.value)
                  } else {
                    props.onChange(null)
                  }
                }}
                disabled={props.disabled}
                className="w-4 h-4 text-primary border-2 border-slate-300 rounded focus:ring-2 focus:ring-primary/20"
              />
              <span className="text-sm font-medium text-slate-700">{option.label}</span>
            </label>
          ))}
        </div>
      )}

      <div className="h-6">
        {error && (
          <p className="text-red-500 text-sm mt-1">{error}</p>
        )}
      </div>
    </div>
  )
}