import { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";

// A soft "waiting" cue — an entrance pop for the icon plus a looping radar-style ring behind it.
// Used wherever the app tells someone to sit tight (signup confirmation, pending approval).
export function PulsingIcon({
  icon,
  color = colors.primary,
  size = 40,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
  size?: number;
}) {
  const entrance = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(entrance, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }).start();

    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1800,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [entrance, pulse]);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });

  return (
    <View style={[styles.wrap, { width: size * 2.2, height: size * 2.2 }]}>
      <Animated.View
        style={[
          styles.ring,
          {
            width: size * 2,
            height: size * 2,
            borderRadius: size,
            backgroundColor: color,
            opacity: ringOpacity,
            transform: [{ scale: ringScale }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.iconWrap,
          {
            width: size * 1.6,
            height: size * 1.6,
            borderRadius: size * 0.8,
            backgroundColor: colors.accentSoft,
            opacity: entrance,
            transform: [{ scale: entrance }],
          },
        ]}
      >
        <Ionicons name={icon} size={size * 0.75} color={color} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute" },
  iconWrap: { alignItems: "center", justifyContent: "center" },
});
