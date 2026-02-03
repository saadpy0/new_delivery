Food Delivery Limiter App Development Plan
This plan outlines the phased development of an iOS app using React Native and Supabase, focusing on Revenue Cat integration, auth/database setup, and MVP features.

Phase 1: Revenue Cat Integration and Payment Workflow
Initialize React Native project with Revenue Cat SDK.
Configure basic subscription offerings (tiers to be decided later).
Implement purchase and restore flows for premium features.
Test in-app purchases on iOS sandbox environment.
Phase 2: Auth with Database
Create Supabase project and set up auth providers.
Implement user authentication (sign up, login, logout) in React Native.
Design and create database tables for users, delivery orders, budgets, and habits.
Integrate Supabase auth and DB client in the app.
Phase 3: App MVP
Build main UI components: dashboard for spending tracking, budget settings, order history.
Implement delivery order tracking (manual entry or integrations).
Add hard-block functionality with overrides (e.g., charity payment).
Develop spending reports, habit streaks, and home-cooking reminders.
Test MVP on iOS device/simulator.
Tech Stack
Frontend: React Native (iOS only)
Backend: Supabase (auth, database)
Payments: Revenue Cat
Assumptions
No specific subscription tiers defined yet; basic setup for future expansion.
Manual order entry for MVP; potential API integrations later.
Focus on core features first; advanced friction/tools in iterations.
