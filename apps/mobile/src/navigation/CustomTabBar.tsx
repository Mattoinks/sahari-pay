import { View, Pressable, StyleSheet } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../theme/colors";
import { AppText as Text } from "../components/AppText";

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Home: "home-outline",
  Maintenance: "construct-outline",
  HistoryTab: "time-outline",
  Messages: "chatbubble-ellipses-outline",
};

const ICONS_ACTIVE: Record<string, keyof typeof Ionicons.glyphMap> = {
  Home: "home",
  Maintenance: "construct",
  HistoryTab: "time",
  Messages: "chatbubble-ellipses",
};

const LABELS: Record<string, string> = {
  Home: "Home",
  Maintenance: "Maintenance",
  HistoryTab: "History",
  Messages: "Messages",
};

// Replaces React Navigation's built-in tab bar entirely. Its default web rendering was
// silently collapsing labels to nothing no matter what style props were passed — this uses
// plain View/Text/Pressable instead, which renders identically on native and react-native-web.
export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  return (
    <View style={styles.bar}>
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        if (route.name === "Payments") {
          return (
            <Pressable key={route.key} onPress={onPress} style={styles.tabItem}>
              <View style={styles.paymentBadgeRing}>
                <LinearGradient
                  colors={[colors.accent, colors.primary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.paymentBadge}
                >
                  <Ionicons name="card" size={24} color="#fff" />
                </LinearGradient>
              </View>
            </Pressable>
          );
        }

        const tint = isFocused ? colors.primary : colors.textMuted;
        return (
          <Pressable key={route.key} onPress={onPress} style={styles.tabItem}>
            <View style={[styles.iconWrap, isFocused && styles.iconWrapActive]}>
              <Ionicons name={isFocused ? ICONS_ACTIVE[route.name] : ICONS[route.name]} size={19} color={tint} />
            </View>
            <Text style={[styles.label, isFocused && styles.labelActive, { color: tint }]}>{LABELS[route.name]}</Text>
            {isFocused && <View style={styles.activeDot} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    height: 70,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 10,
  },
  tabItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2 },
  iconWrap: {
    width: 34,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapActive: { backgroundColor: colors.accentSoft },
  label: { fontSize: 11, fontWeight: "600" },
  labelActive: { fontWeight: "700" },
  activeDot: {
    position: "absolute",
    bottom: 1,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  paymentBadgeRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginTop: -24,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
  },
  paymentBadge: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
  },
});
