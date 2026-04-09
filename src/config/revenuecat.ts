import Purchases, { PurchasesOffering, CustomerInfo } from 'react-native-purchases';
import { REVENUECAT_API_KEY } from './keys';
import { logger } from '../utils/logger';

export const PRODUCT_IDS = {
  INDIVIDUAL: '001',
  TEAM: '002',
  ENTERPRISE: '003',
};

export const PLAN_CONFIG = {
  individual: {
    productId: PRODUCT_IDS.INDIVIDUAL,
    name: 'Individual',
    price: '$9.99/mo',
    seats: 3,
    description: 'Up to 3 team members',
  },
  team: {
    productId: PRODUCT_IDS.TEAM,
    name: 'Team',
    price: '$49.99/mo',
    seats: 15,
    description: 'Up to 15 team members',
  },
  enterprise: {
    productId: PRODUCT_IDS.ENTERPRISE,
    name: 'Enterprise',
    price: '$99.99/mo',
    seats: 30,
    description: 'Up to 30 team members',
  },
} as const;

export const initRevenueCat = async (userId: string) => {
  try {
    Purchases.configure({ apiKey: REVENUECAT_API_KEY, appUserID: userId });
    logger.log('RevenueCat initialized for user:', userId);
  } catch (error) {
    logger.error('RevenueCat init error:', error);
  }
};

export const getOfferings = async (): Promise<PurchasesOffering | null> => {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current;
  } catch (error) {
    logger.error('Error fetching offerings:', error);
    return null;
  }
};

export const getCustomerInfo = async (): Promise<CustomerInfo | null> => {
  try {
    return await Purchases.getCustomerInfo();
  } catch (error) {
    logger.error('Error fetching customer info:', error);
    return null;
  }
};

export const hasActiveSubscription = async (): Promise<boolean> => {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return typeof customerInfo.entitlements.active['active'] !== 'undefined';
  } catch (error) {
    logger.error('Error checking subscription:', error);
    return false;
  }
};
