import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../lib/AuthProvider";
import { LoginScreen } from "../screens/LoginScreen";
import { SignUpScreen } from "../screens/SignUpScreen";
import { SignUpSuccessScreen } from "../screens/SignUpSuccessScreen";
import { PendingApprovalScreen } from "../screens/PendingApprovalScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { PayScreen } from "../screens/PayScreen";
import { HistoryScreen } from "../screens/HistoryScreen";
import { MaintenanceScreen } from "../screens/MaintenanceScreen";
import { MessagesScreen } from "../screens/MessagesScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { ScheduleViewingScreen } from "../screens/ScheduleViewingScreen";
import { CustomTabBar } from "./CustomTabBar";

const Tab = createBottomTabNavigator();
const AuthStack = createNativeStackNavigator();
const RootStack = createNativeStackNavigator();

function AuthStackNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
      <AuthStack.Screen name="SignUpSuccess" component={SignUpSuccessScreen} />
    </AuthStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator tabBar={(props) => <CustomTabBar {...props} />} screenOptions={{ headerShown: false }}>
      {/* Exactly 5 tabs, no hidden/reserved slots — Payments (position 3) is the true center.
          Every screen renders its own AppHeader (same design, page-specific title) instead of
          a native stack header. */}
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Maintenance" component={MaintenanceScreen} />
      <Tab.Screen name="Payments" component={PayScreen} />
      <Tab.Screen name="HistoryTab" component={HistoryScreen} />
      <Tab.Screen name="Messages" component={MessagesScreen} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { session, loading, approvalStatus } = useAuth();

  if (loading || (session && approvalStatus === null)) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  // Self-signup (SignUpScreen) lands here pending admin review — see 0022_tenant_approval.sql.
  // Every other signup path (admin invite) is pre-approved. No navigator needed here (sign-out
  // is the only action), so this renders standalone rather than inside NavigationContainer.
  if (session && approvalStatus !== "approved") {
    return <PendingApprovalScreen status={approvalStatus as "pending" | "rejected"} />;
  }

  return (
    <NavigationContainer>
      {session ? (
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          <RootStack.Screen name="MainTabs" component={MainTabs} />
          {/* Reached via the avatar in AppHeader, not the bottom tab bar — kept as a stack
              screen above the tabs so it never reserves a slot in the tab bar's layout.
              ProfileScreen renders its own AppHeader (with a back button) instead of a native
              header, matching every other screen's design. */}
          <RootStack.Screen name="Profile" component={ProfileScreen} options={{ presentation: "modal" }} />
          <RootStack.Screen name="ScheduleViewing" component={ScheduleViewingScreen} options={{ presentation: "modal" }} />
        </RootStack.Navigator>
      ) : (
        <AuthStackNavigator />
      )}
    </NavigationContainer>
  );
}
