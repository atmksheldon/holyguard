# HolyGuard — Product & Technical Overview

**Version 1.0.0 | February 2026**

---

## Executive Summary

HolyGuard is a real-time security coordination platform built for churches, schools, and community organizations. It empowers security teams with instant incident reporting, threat-level classification, suspect watchlisting, team communications, shared resource libraries, and a network-wide map — all within a single mobile application.

The platform is live, fully functional, and ready for deployment via the Apple App Store and Google Play. It is built on a modern, scalable architecture using React Native (Expo) for cross-platform mobile delivery and Google Firebase for backend infrastructure.

---

## Table of Contents

1. [Product Vision](#product-vision)
2. [Core Features](#core-features)
3. [User Roles & Access Control](#user-roles--access-control)
4. [Application Screens](#application-screens)
5. [Alert Level System](#alert-level-system)
6. [Organization Verification](#organization-verification)
7. [Sponsorship & Branding Model](#sponsorship--branding-model)
8. [Technical Architecture](#technical-architecture)
9. [Security Model](#security-model)
10. [Data Model](#data-model)
11. [Cloud Functions](#cloud-functions)
12. [Build & Distribution](#build--distribution)
13. [Current Status](#current-status)
14. [Roadmap](#roadmap)

---

## Product Vision

Houses of worship, schools, and community organizations face a growing need for coordinated security response. HolyGuard addresses this by providing a private, real-time security network that connects team members, surfaces threats immediately, and gives organizations the tools to respond quickly and effectively.

Unlike general-purpose communication apps, HolyGuard is purpose-built for security operations — every feature is designed around the workflow of reporting, classifying, tracking, and responding to incidents.

---

## Core Features

### Incident Reporting
- One-tap camera activation to photograph threats in real time
- Automatic GPS tagging of incident location
- Multi-photo support (up to 5MB per image) with gallery picker
- 10 incident categories: Trespass, Graffiti, Theft, Assault, Suspicious Person, Medical, Fire, Active Threat, Vandalism, Other
- Two-tier alert level classification (Yellow / Red)
- Optional watchlist cross-posting

### Live Alert Feed
- Real-time incident updates pushed to all organization members
- Search by keyword (description, reporter name, category, title)
- Category-based filtering with dropdown selector
- Swipe-to-delete for authorized users
- Tap to view full incident details with photo gallery, GPS coordinates, organization info, and edit history

### Watchlist
- Create and manage persons of interest
- Fields: name, license plate, physical description, status, location, notes, photos
- Three status levels: Active, Monitoring, Resolved
- Linked to originating incident reports
- Search and filter capabilities
- Edit/delete with role-based permissions

### Team Communications
- Channel-based messaging for organization-wide communication
- Default channel auto-loaded on app launch
- Real-time message delivery (last 50 messages per channel)
- Sender identification with name and role badge
- Direct messaging between team members
- User directory for browsing organization members
- Admin-managed channel creation

### Resource Library
- Shared knowledge base for security protocols and reference materials
- 10 resource categories: First Aid, Law Enforcement, Fire Safety, Active Shooter, Cybersecurity, Training, Best Practices, Past Incidents, Equipment, Other
- Photo attachments and detailed descriptions
- Search and category filtering
- Attribution to posting organization and user

### Network Map
- Visual map showing all organizations in the HolyGuard network
- Real-time marker display with coordinate validation
- Auto-fit camera to display all network locations
- Location count overlay

### Organization Management
- Create or join organizations via invite codes
- Admin panel for organization name and address (Google Places integration)
- Multi-step verification process for new organizations
- Admin-only member invitation system

---

## User Roles & Access Control

| Role | Permissions |
|------|------------|
| **Member** | View alerts, submit incidents, view watchlist, use team chat, browse resources, view map |
| **Admin** | All member permissions + edit/delete any alert, manage watchlist entries, create channels, invite members, update organization details, manage resources |
| **Super Admin** | All admin permissions + review and approve/reject pending organizations, access admin review panel |

Role assignment is handled during the invite code process — each invite code carries a predefined role that is applied when the user joins.

---

## Application Screens

### Authentication Flow

| Screen | Purpose |
|--------|---------|
| **Login** | Email/password authentication with validation |
| **Sign Up** | 4-step registration: personal info, organization selection (join via invite or create new), organization details with Google Places address lookup, verification status |
| **Email Verification** | Post-signup email confirmation with resend capability and cooldown timers |
| **Pending Approval** | Displays verification progress while organization is under review, with inline email/phone verification forms |
| **Rejected** | Shows rejection reason and support contact |

### Main Application

| Screen | Purpose |
|--------|---------|
| **Dashboard** | Live incident feed, incident reporting (camera + gallery), search, category filtering, emergency 911 banner |
| **Map** | Network-wide organization map with real-time markers |
| **Watchlist** | Persons of interest management with status filtering and search |
| **Watchlist Detail** | Full entry view with photo carousel, metadata, edit/delete |
| **Create Watchlist Entry** | Form for new persons of interest with photo support |
| **Direct Messages** | DM conversation list |
| **User Directory** | Browse organization members for direct messaging |
| **DM Chat** | One-to-one secure conversations |
| **Resources** | Searchable grid of security resources and protocols |
| **Create Resource** | Post new resources with photo, category, and description |
| **Resource Detail** | Full resource view with organization attribution |
| **Team** | Channel-based team messaging with role badges |
| **Channel Management** | Admin channel creation and management |
| **Invite Members** | Admin invite code generation with expiration and usage limits |
| **Settings** | Account info, password change, organization update, about section, logout |
| **Admin Review** | Super admin panel for reviewing pending organization applications |

### Navigation Structure

The application uses a bottom tab navigator with nested stack navigators:

```
Root
  |-- Auth Stack (Login, Sign Up)
  |-- Email Verification
  |-- Pending Approval
  |-- Rejected
  |-- App Navigator (Bottom Tabs)
       |-- Dashboard (+ Settings, Create Watchlist Entry)
       |-- Map
       |-- Watchlist (+ Create Entry, Detail)
       |-- Direct Messages (+ User Directory, Chat)
       |-- Resources (+ Create, Detail)
       |-- Team (+ Invite Members, Channel Management)
       |-- Admin Review (super_admin only)
```

---

## Alert Level System

HolyGuard implements a two-tier alert severity classification system that allows teams to immediately distinguish between observations and active dangers.

### Yellow Alert — Situational Awareness
- **Use case:** Suspicious activity observed, something worth noting, non-immediate concern
- **Visual indicators:** Amber left border on alert cards, amber "YELLOW" badge, amber "SITUATIONAL AWARENESS" banner in detail view
- **Color:** `#F59E0B` (Amber)

### Red Alert — Imminent Threat
- **Use case:** Active danger requiring immediate response, confirmed threat in progress
- **Visual indicators:** Red left border (thicker), red-tinted card background, red "RED" badge, red "IMMINENT THREAT" banner in detail view
- **Color:** `#B22222` (Firebrick)

### Selection Flow
1. User taps "Report Incident" on the dashboard
2. Camera activates for photo capture (or gallery picker)
3. Incident report modal opens with **alert level selector at the top**
4. Two large buttons: Yellow Alert (eye icon) and Red Alert (octagon icon)
5. Alert level must be selected before the report can be submitted
6. Selected level is stored in Firestore and displayed across all views

### Backward Compatibility
Existing alerts without an `alertLevel` field automatically display as Yellow (situational awareness) across all views.

---

## Organization Verification

New organizations go through an automated + manual verification process to maintain network integrity.

### Automated Checks (up to 100 points)

| Check | Max Points | Method |
|-------|-----------|--------|
| **Google Places** | 30 | Searches for organization by name/address, validates location proximity (~500m), checks for place of worship category |
| **EIN Verification** | 30 | Queries ProPublica Nonprofit API, validates name similarity, checks for religious organization NTEE code |
| **Email Domain** | 20 | Sends 6-digit verification code to organization email, confirms domain ownership |
| **Phone/SMS** | 20 | Verifies organization phone number ownership |

### Approval Thresholds
- **Auto-approved** at 60+ points
- **Manual review** required below 60 points
- Super admins can approve or reject with a written reason

### Verification Status Flow
```
New Organization → Automated Checks → Score Calculated
  |
  |-- Score >= 60 → Auto-Approved → Full Access
  |-- Score < 60 → Pending Review → Super Admin Decision
                                       |-- Approved → Full Access
                                       |-- Rejected → Rejected Screen (with reason)
```

---

## Sponsorship & Branding Model

HolyGuard includes a built-in sponsorship framework that provides monetization opportunities through strategic brand placement without disrupting the security workflow.

### Placement Locations

| Location | Size | Visibility |
|----------|------|-----------|
| **Dashboard Header** | Small (36x18px per logo) | Always visible — top of main screen under HOLYGUARD brand |
| **Incident Feed Footer** | Medium (60x24px per logo) | Visible when scrolling to bottom of alert feed, with "Security Network powered by" label |
| **Settings About Section** | Large (100x80px per logo) | Prominent placement in the About card with "Sponsored By" label |

### Current Sponsors (Demo)
- **Nationwide** — Eagle + blue "N" logo
- **ADT** — Blue octagon logo

All sponsor logos use transparent backgrounds and are rendered side by side at each placement point. The branding model is designed to demonstrate revenue potential to investors while keeping the user interface clean and security-focused.

---

## Technical Architecture

### Frontend
- **Framework:** React Native 0.81.5 via Expo SDK 54
- **Language:** TypeScript 5.9 with strict mode
- **Navigation:** React Navigation 7 (bottom tabs + native stacks)
- **Gestures:** React Native Gesture Handler + Reanimated 4.1
- **Maps:** React Native Maps 1.20
- **Camera:** Expo Camera 17
- **Image Picker:** Expo Image Picker 17
- **Location:** Expo Location 19
- **Local Storage:** AsyncStorage 2.2
- **Address Autocomplete:** Google Places Autocomplete

### Backend
- **Platform:** Google Firebase (holyguard-app project)
- **Authentication:** Firebase Auth (email/password with email verification)
- **Database:** Cloud Firestore (real-time listeners, ordered queries)
- **File Storage:** Firebase Storage (5MB limit, images only)
- **Serverless Functions:** Firebase Cloud Functions (Node.js)
- **Security:** Firestore Security Rules + Storage Security Rules

### Key Technical Decisions
- **Real-time architecture:** Firestore `onSnapshot` listeners provide instant updates across all connected clients without polling
- **Offline resilience:** Long polling enabled for Firestore to handle restrictive network environments common in institutional settings
- **Non-blocking photo capture:** GPS location is fetched in the background after photo capture, so camera response remains instant
- **Backward-compatible data model:** New fields (like `alertLevel`, `imageUrls`) gracefully degrade — older documents without these fields display correctly with sensible defaults
- **Input sanitization:** All user inputs are validated (email format, password strength) and sanitized (HTML tag removal, length limits) before storage

---

## Security Model

### Authentication
- Email/password authentication via Firebase Auth
- Email verification required before accessing the application
- Reauthentication required for sensitive operations (password change, account deletion)
- User session persistence with secure async storage

### Firestore Security Rules

| Collection | Read | Write | Delete |
|-----------|------|-------|--------|
| **users** | All authenticated | Own document only | Own document only |
| **organizations** | All authenticated | Creator + admins (status changes restricted to super_admin) | — |
| **alerts** | All authenticated | Creator for updates | Reporter or admin |
| **team_messages** | All authenticated | Authenticated (500 char limit) | Sender only |
| **watchlist** | All authenticated | Authenticated | Creator or admin |
| **resources** | All authenticated | Authenticated | Poster or admin |
| **channels** | All authenticated | Admin only | Admin only |
| **invite_codes** | — | Admin only (tracked usage/expiration) | — |
| **direct_messages** | Conversation participants | Participants only | — |

### Storage Security Rules
- Maximum file size: 5MB
- Allowed content types: images only (`image/*`)
- Paths restricted to: `incidents/`, `direct_messages/`, `resources/`

### Application-Level Security
- Role-based UI rendering (admin panels hidden from non-admins)
- Input validation with regex patterns and length limits
- HTML injection prevention via sanitization utility
- Credential files excluded from version control (`.gitignore`)

---

## Data Model

### Firestore Collections

**users**
```
{
  id, name, email, role, organizationId,
  emailVerified, createdAt
}
```

**organizations**
```
{
  id, name, address, latitude, longitude,
  status (pending/verified/rejected),
  createdBy, createdAt, rejectionReason?,
  website?, ein?, contactEmail?, contactPhone?
}
  └── verification/checks (subcollection)
      { googlePlaces, einVerification, emailDomain,
        phoneSms, totalScore, autoApproved }
```

**alerts**
```
{
  title, description, category, alertLevel (yellow/red),
  type, imageUrl, imageUrls[], timestamp,
  location (orgId), latitude?, longitude?,
  reporterId, reporterName,
  updatedAt?, updatedBy?, updatedByName?
}
```

**watchlist**
```
{
  name, licensePlate?, physicalDescription?,
  status (active/monitoring/resolved),
  location?, latitude?, longitude?,
  imageUrls[], notes?, linkedAlertId?,
  organizationId, createdBy, createdByName,
  createdAt, updatedAt?
}
```

**team_messages**
```
{
  text, senderId, senderName, senderRole,
  organizationId, channelId, timestamp
}
```

**channels**
```
{
  name, organizationId, isDefault, createdBy, createdAt
}
```

**invite_codes**
```
{
  code (JOIN-XXXX-XXXX), organizationId, organizationName,
  role, createdBy, createdAt, expiresAt,
  maxUses, usedCount, status (active/expired)
}
```

**resources**
```
{
  title, description, category, imageUrl,
  organizationId, organizationName,
  postedBy, postedByName, createdAt
}
```

**direct_messages / conversations / dm_invites**
```
Direct messaging collections for 1-to-1 communication
between organization members
```

---

## Cloud Functions

All serverless functions run on Firebase Cloud Functions (Node.js runtime).

| Function | Trigger | Purpose |
|----------|---------|---------|
| **validateInviteCode** | HTTPS Callable | Validates invite code status, expiration, and usage limits; increments usage counter on success; returns role and organization info |
| **generateInviteCode** | HTTPS Callable | Admin-only; generates unique `JOIN-XXXX-XXXX` code with configurable expiration and max uses |
| **verifyOrganization** | HTTPS Callable | Runs automated verification checks (Google Places, EIN/ProPublica, email, phone); calculates score; auto-approves at 60+ points |
| **sendOrgEmailVerification** | HTTPS Callable | Sends 6-digit verification code to organization contact email |
| **confirmOrgEmail** | HTTPS Callable | Validates email verification code; awards points; recalculates approval score |
| **confirmPhoneVerification** | HTTPS Callable | Validates phone verification; awards points; recalculates approval score |
| **reviewOrganization** | HTTPS Callable | Super admin function to manually approve or reject organizations with written reason |

---

## Build & Distribution

### Build Configuration (EAS Build)

| Profile | Purpose | Configuration |
|---------|---------|--------------|
| **development** | Local development | Development client, internal distribution |
| **preview** | Testing builds | Internal distribution for QA |
| **production** | App Store / Play Store | Auto-incrementing build numbers |

### App Identity
- **Bundle Identifier:** `com.lonestardevops.holyguard`
- **EAS Project ID:** `76276ecb-b99b-4804-a997-8d28e27e7e25`
- **Expo Owner:** `lonestardevops`

### Platform Support
- iOS (App Store)
- Android (Google Play)
- Managed Expo workflow (no native code ejection required)

---

## Current Status

### What's Built and Working
- Complete authentication flow with email verification
- Multi-step organization registration with automated verification
- Real-time incident reporting with camera, GPS, multi-photo, and 10 categories
- Two-tier alert level classification (Yellow / Red)
- Live alert feed with search, filtering, and detail views
- Incident editing and deletion with role-based permissions
- Watchlist management (create, edit, delete, status tracking)
- Channel-based team messaging with role badges
- Direct messaging between team members
- Resource library with categories, search, and photo support
- Network map with real-time organization markers
- Admin tools: invite code generation, channel management, organization review
- Sponsor branding placements (header, feed footer, settings)
- Firestore security rules covering all collections
- Cloud Functions for verification, invitations, and admin operations
- Privacy policy and terms of service
- EAS Build configuration for development, preview, and production

### Key Metrics
- **93 files** in the codebase
- **30,000+ lines** of application code
- **18 screens** across auth and main application flows
- **5 reusable components** for incident display and reporting
- **7 Cloud Functions** handling verification and admin operations
- **10 Firestore collections** with comprehensive security rules

---

## Roadmap

Potential future enhancements based on the current architecture:

- **Push notifications** for Red Alerts and team messages
- **Offline mode** with Firestore persistence for areas with poor connectivity
- **Analytics dashboard** for incident trends and response times
- **Multi-organization networking** for cross-org alert sharing
- **Video support** in incident reports
- **Geofencing** for automatic alerts when entering/leaving organization premises
- **Integration APIs** for third-party security systems
- **Scheduled patrols** with GPS tracking and checkpoint verification
- **Incident resolution workflows** with status tracking and after-action reports
- **White-label deployment** for enterprise security companies (CompanyGuard, SchoolGuard variants)

---

*HolyGuard — Protecting What Matters Most*
