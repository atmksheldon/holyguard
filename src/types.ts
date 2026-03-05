export interface Alert {
    id: string;
    title: string;
    location: string;
    timestamp: string; // ISO string or relative time for display
    type: 'alert' | 'warning' | 'info';
    category?: string; // Incident type: Trespass, Theft, etc.
    details?: string;
    imageUrl?: string; // Legacy single image (backward compat)
    imageUrls?: string[]; // Multiple photos
    description?: string;
    reporterName?: string;
    reporterId?: string;
    latitude?: number;
    longitude?: number;
    updatedAt?: any;
    updatedBy?: string;
    updatedByName?: string;
    alertLevel?: 'yellow' | 'red';
    policeIncidentNumber?: string;
}

export interface WatchlistEntry {
    id: string;
    name: string;
    licensePlate?: string;
    physicalDescription?: string;
    status: 'active' | 'resolved' | 'monitoring';
    date: string;
    location?: string;
    latitude?: number;
    longitude?: number;
    imageUrls: string[];
    organizationId: string;
    createdBy: string;
    createdByName?: string;
    linkedAlertId?: string;
    createdAt: any;
    updatedAt?: any;
    notes?: string;
}

export interface UserProfile {
    id: string;
    name: string;
    role: 'admin' | 'security' | 'member' | 'super_admin';
    organizationId: string;
    emailVerified: boolean;
    organizationStatus?: 'pending' | 'verified' | 'rejected';
    organizationName?: string;
}

export interface VerificationCheck {
    status: 'pending' | 'passed' | 'failed' | 'skipped';
    score: number;
    details?: string;
    checkedAt?: any;
}

export interface VerificationChecks {
    googlePlaces: VerificationCheck & { placeId?: string };
    einVerification: VerificationCheck & { nonprofitName?: string };
    emailDomain: VerificationCheck & { domain?: string };
    phoneSms: VerificationCheck;
    totalScore: number;
    autoApproved: boolean;
    reviewedBy?: string;
    reviewedAt?: any;
}
