import { useState } from "react";
import { Modal, View, Image, Pressable, StyleSheet, Platform, Alert, ActivityIndicator, Linking, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { colors } from "../theme/colors";
import { AppText as Text } from "./AppText";

export function QrPreviewModal({
  visible,
  qrUrl,
  title,
  onClose,
}: {
  visible: boolean;
  qrUrl: string;
  title: string;
  onClose: () => void;
}) {
  const { width } = useWindowDimensions();
  const [downloading, setDownloading] = useState(false);
  const size = Math.min(width - 64, 420);

  async function handleDownload() {
    if (Platform.OS === "web") {
      Linking.openURL(qrUrl);
      return;
    }

    setDownloading(true);
    try {
      const ext = qrUrl.split(".").pop()?.split("?")[0] || "jpg";
      const localUri = `${FileSystem.cacheDirectory}${title.replace(/\s+/g, "-")}-qr.${ext}`;
      const { uri } = await FileSystem.downloadAsync(qrUrl, localUri);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        Alert.alert("Sharing not available", "Your device doesn't support sharing files.");
      }
    } catch {
      Alert.alert("Download failed", "Could not save the QR code. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          <Image source={{ uri: qrUrl }} style={{ width: size, height: size }} resizeMode="contain" />

          <Pressable style={styles.downloadButton} onPress={handleDownload} disabled={downloading}>
            {downloading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="download-outline" size={18} color="#fff" />
                <Text style={styles.downloadText}>Download</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", alignItems: "center", justifyContent: "center", padding: 24 },
  panel: { backgroundColor: "#fff", borderRadius: 20, padding: 20, alignItems: "center", gap: 16, width: "100%" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%" },
  title: { fontSize: 16, fontWeight: "700", color: colors.text },
  downloadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: "100%",
  },
  downloadText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
