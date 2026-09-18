import { TextInput as RNTextInput, StyleSheet, type TextInputProps } from "react-native";

// Same idea as AppText, for input fields — League Spartan Regular by default.
export function AppTextInput({ style, ...props }: TextInputProps) {
  const flattened = StyleSheet.flatten(style) ?? {};
  const isBold = flattened.fontWeight === "700" || flattened.fontWeight === "bold";

  return (
    <RNTextInput
      {...props}
      style={[
        style,
        { fontFamily: isBold ? "LeagueSpartan_700Bold" : "LeagueSpartan_400Regular", fontWeight: undefined },
      ]}
    />
  );
}
