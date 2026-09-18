import { useCallback, useEffect, useRef, useState } from "react";
import { View, Image, Pressable, StyleSheet, FlatList, Linking, useWindowDimensions } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import type { Advertisement } from "@tenantpay/shared";
import { supabase } from "../lib/supabase";
import { colors } from "../theme/colors";
import { AppText as Text } from "./AppText";

const AUTO_ADVANCE_MS = 4500;
const ASPECT_RATIO = 1200 / 445; // ~2.7:1, matches the recommended banner asset size

export function AdBanner() {
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const bannerWidth = width - 32; // matches the screen's 16px side padding
  const bannerHeight = bannerWidth / ASPECT_RATIO;
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("advertisements")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });
    setAds(data ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    if (ads.length < 2) return;
    const timer = setInterval(() => {
      setIndex((prev) => {
        const next = (prev + 1) % ads.length;
        listRef.current?.scrollToOffset({ offset: next * bannerWidth, animated: true });
        return next;
      });
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [ads.length, bannerWidth]);

  if (ads.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <FlatList
        ref={listRef}
        data={ads}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / bannerWidth))}
        renderItem={({ item }) => {
          const imageUrl = supabase.storage.from("advertisements").getPublicUrl(item.image_path).data.publicUrl;
          const content = (
            <View style={[styles.slide, { width: bannerWidth, height: bannerHeight }]}>
              <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
              {item.opens_scheduler && (
                <View style={styles.bookBadge}>
                  <Ionicons name="calendar-outline" size={12} color={colors.primary} />
                  <Text style={styles.bookBadgeText}>Book now</Text>
                </View>
              )}
              {item.caption && (
                <View style={styles.captionWrap}>
                  <Text style={styles.captionText} numberOfLines={2}>
                    {item.caption}
                  </Text>
                </View>
              )}
            </View>
          );
          const onPress = item.opens_scheduler
            ? () => navigation.navigate("ScheduleViewing" as never)
            : item.link_url
              ? () => Linking.openURL(item.link_url!)
              : undefined;
          return onPress ? <Pressable onPress={onPress}>{content}</Pressable> : content;
        }}
      />
      {ads.length > 1 && (
        <View style={styles.dotsRow}>
          {ads.map((ad, i) => (
            <View key={ad.id} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 16 },
  slide: {
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  image: { width: "100%", height: "100%", backgroundColor: colors.border },
  bookBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  bookBadgeText: { color: colors.primary, fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
  captionWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  captionText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  dotsRow: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.primary, width: 16 },
});
