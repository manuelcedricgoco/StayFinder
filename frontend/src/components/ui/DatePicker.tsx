import { CalendarPopover } from "./CalendarPopover";

interface DatePickerProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function DatePicker({ label, value, onChange, className = "" }: DatePickerProps) {
  return (
    <CalendarPopover
      label={label}
      value={value}
      onChange={onChange}
      className={className}
    />
  );
}
