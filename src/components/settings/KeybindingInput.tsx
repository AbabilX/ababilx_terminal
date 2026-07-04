import { TextInput } from "./SettingsField";

interface KeybindingInputProps {
  value: string;
  onChange: (v: string) => void;
}

export function KeybindingInput({ value, onChange }: KeybindingInputProps) {
  return (
    <TextInput
      value={value}
      onChange={onChange}
      className="w-40 font-mono text-xs"
      placeholder="ctrl+t"
    />
  );
}
