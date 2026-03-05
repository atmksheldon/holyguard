import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DashboardScreen } from '../screens/DashboardScreen';
import { MapScreen } from '../screens/MapScreen';
import { TeamScreen } from '../screens/TeamScreen';
import InviteMembersScreen from '../screens/InviteMembersScreen';
import { ChannelManagementScreen } from '../screens/ChannelManagementScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { DirectMessagesScreen } from '../screens/DirectMessagesScreen';
import { UserDirectoryScreen } from '../screens/UserDirectoryScreen';
import { DirectMessageChatScreen } from '../screens/DirectMessageChatScreen';
import { ResourcesScreen } from '../screens/ResourcesScreen';
import { CreateResourceScreen } from '../screens/CreateResourceScreen';
import { ResourceDetailScreen } from '../screens/ResourceDetailScreen';
import { WatchlistScreen } from '../screens/WatchlistScreen';
import { CreateWatchlistEntryScreen } from '../screens/CreateWatchlistEntryScreen';
import { WatchlistDetailScreen } from '../screens/WatchlistDetailScreen';
import { AdminReviewScreen } from '../screens/AdminReviewScreen';
import { DemoSelectorScreen } from '../screens/DemoSelectorScreen';
import { DemoSchoolGuardScreen } from '../screens/DemoSchoolGuardScreen';
import { DemoCompanyGuardScreen } from '../screens/DemoCompanyGuardScreen';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme';

const Tab = createBottomTabNavigator();
const TeamStack = createStackNavigator();
const DashboardStack = createStackNavigator();
const DMStack = createStackNavigator();
const ResourcesStack = createStackNavigator();
const WatchlistStack = createStackNavigator();

const TeamNavigator = () => {
  return (
    <TeamStack.Navigator screenOptions={{ headerShown: false }}>
      <TeamStack.Screen name="TeamMain" component={TeamScreen} />
      <TeamStack.Screen
        name="InviteMembers"
        component={InviteMembersScreen}
        options={{ headerShown: true, title: '' }}
      />
      <TeamStack.Screen
        name="ChannelManagement"
        component={ChannelManagementScreen}
      />
    </TeamStack.Navigator>
  );
};

const DashboardNavigator = () => {
  return (
    <DashboardStack.Navigator screenOptions={{ headerShown: false }}>
      <DashboardStack.Screen name="DashboardMain" component={DashboardScreen} />
      <DashboardStack.Screen name="Settings" component={SettingsScreen} />
      <DashboardStack.Screen name="DemoSelector" component={DemoSelectorScreen} />
      <DashboardStack.Screen name="DemoSchoolGuard" component={DemoSchoolGuardScreen} />
      <DashboardStack.Screen name="DemoCompanyGuard" component={DemoCompanyGuardScreen} />
      <DashboardStack.Screen name="CreateWatchlistEntry" component={CreateWatchlistEntryScreen} />
    </DashboardStack.Navigator>
  );
};

const DMNavigator = () => {
  return (
    <DMStack.Navigator screenOptions={{ headerShown: false }}>
      <DMStack.Screen name="DirectMessagesMain" component={DirectMessagesScreen} />
      <DMStack.Screen name="UserDirectory" component={UserDirectoryScreen} />
      <DMStack.Screen name="DirectMessageChat" component={DirectMessageChatScreen} />
    </DMStack.Navigator>
  );
};

const ResourcesNavigator = () => {
  return (
    <ResourcesStack.Navigator screenOptions={{ headerShown: false }}>
      <ResourcesStack.Screen name="ResourcesMain" component={ResourcesScreen} />
      <ResourcesStack.Screen name="CreateResource" component={CreateResourceScreen} />
      <ResourcesStack.Screen name="ResourceDetail" component={ResourceDetailScreen} />
    </ResourcesStack.Navigator>
  );
};

const WatchlistNavigator = () => {
  return (
    <WatchlistStack.Navigator screenOptions={{ headerShown: false }}>
      <WatchlistStack.Screen name="WatchlistMain" component={WatchlistScreen} />
      <WatchlistStack.Screen name="CreateWatchlistEntry" component={CreateWatchlistEntryScreen} />
      <WatchlistStack.Screen name="WatchlistDetail" component={WatchlistDetailScreen} />
    </WatchlistStack.Navigator>
  );
};

export const AppNavigator = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  return (
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.colors.surfaceDark,
            paddingBottom: 5,
            paddingTop: 5,
            height: 60,
          },
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.textSecondary,
        }}
      >
        <Tab.Screen
          name="Dashboard"
          component={DashboardNavigator}
          options={{
            tabBarLabel: 'Home',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="shield-home" color={color} size={size} />
            ),
          }}
        />
        <Tab.Screen
          name="Map"
          component={MapScreen}
          options={{
            tabBarLabel: 'Network',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="map-marker-radius" color={color} size={size} />
            ),
          }}
        />
        <Tab.Screen
          name="Watchlist"
          component={WatchlistNavigator}
          options={{
            tabBarLabel: 'Watchlist',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="shield-alert" color={color} size={size} />
            ),
          }}
        />
        <Tab.Screen
          name="DirectMessages"
          component={DMNavigator}
          options={{
            tabBarLabel: 'Messages',
            tabBarIcon: ({ color, size}) => (
              <MaterialCommunityIcons name="message-text" color={color} size={size} />
            ),
          }}
        />
        <Tab.Screen
          name="Resources"
          component={ResourcesNavigator}
          options={{
            tabBarLabel: 'Resources',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="book-open-variant" color={color} size={size} />
            ),
          }}
        />
        <Tab.Screen
          name="Team"
          component={TeamNavigator}
          options={{
            tabBarLabel: 'Team',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="forum" color={color} size={size} />
            ),
          }}
        />
        {isSuperAdmin && (
          <Tab.Screen
            name="AdminReview"
            component={AdminReviewScreen}
            options={{
              tabBarLabel: 'Review',
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons name="shield-check" color={color} size={size} />
              ),
            }}
          />
        )}
      </Tab.Navigator>
  );
};
