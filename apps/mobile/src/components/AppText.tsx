import { Text as RNText, type TextProps } from "react-native";
import { StyleSheet } from "react-native";

// League Spartan stands in for Century Gothic — that's a commercial Monotype font we can't
// legally bundle, and this is the closest free, open-source geometric-sans match.
const WEIGHT_TO_FONT: Record<string, string> = {
  "400": "LeagueSpartan_400Regular",
  normal: "LeagueSpartan_400Regular",
  "500": "LeagueSpartan_500Medium",
  "600": "LeagueSpartan_600SemiBold",
  "700": "LeagueSpartan_700Bold",
  bold: "LeagueSpartan_700Bold",
  "800": "LeagueSpartan_800ExtraBold",
  "900": "LeagueSpartan_800ExtraBold",
};

// A drop-in replacement for RN's Text that always renders in League Spartan, picking the
// closest loaded weight for whatever fontWeight the caller's style asked for (and stripping
// that fontWeight afterward — mixing a numeric fontWeight with a specific static font file
// makes RN synthetically re-bold it on top of the file's own weight, which looks wrong).
export function AppText({ style, ...props }: TextProps) {
  const flattened = StyleSheet.flatten(style) ?? {};
  const fontFamily = WEIGHT_TO_FONT[String(flattened.fontWeight ?? "400")] ?? "LeagueSpartan_400Regular";

  return <RNText {...props} style={[style, { fontFamily, fontWeight: undefined }]} />;
}
