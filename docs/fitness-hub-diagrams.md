# Fitness Hub AI Diagrams

These diagrams reflect the current code in:

- `artifacts/gymapp`
- `artifacts/admin`
- `artifacts/api-server`
- `lib/db/src/schema`

They focus on three things:

- what the app does
- how users and staff move through it
- what phases the app moves through during real use

## 1. System Functionality Map

```mermaid
flowchart LR
  %% Current system map derived from the mobile app, admin app, API routes, and DB schema.

  subgraph Mobile["GymOS Mobile App (Expo)"]
    Home["Home dashboard"]
    Nutrition["Nutrition tracking\nIndian food log + water"]
    Workout["Workout hub\nsessions + AI suggestions"]
    Schedule["Schedule\nclass browse + enrollment"]
    Coach["AI Coach chat"]
    Profile["Profile + onboarding targets"]
    Local["AsyncStorage contexts\nprofile, nutrition, workout, schedule, chat"]
  end

  subgraph Admin["Admin Web (React + Vite)"]
    Dashboard["Owner dashboard"]
    Classes["Class management"]
    Members["Member directory"]
    Settings["Gym settings"]
  end

  subgraph API["Express API"]
    PublicClasses["/api/classes"]
    Profiles["/api/profiles\nsync + me"]
    WorkoutsApi["/api/workouts\nmembers, templates, assign, complete"]
    AdminApi["/api/admin\nclasses, members, settings, dashboard"]
    AiApi["/api/ai\nanalyze-food, chat, workout-suggestion"]
  end

  DB[("Postgres + Drizzle")]
  Clerk[("Clerk Auth + role metadata")]
  Gemini[("Gemini AI")]

  Home --> Local
  Nutrition --> Local
  Workout --> Local
  Schedule --> Local
  Coach --> Local
  Profile --> Local

  Profile --> Profiles
  Schedule --> PublicClasses
  Workout --> WorkoutsApi
  Nutrition --> AiApi
  Coach --> AiApi

  Dashboard --> AdminApi
  Classes --> AdminApi
  Members --> AdminApi
  Settings --> AdminApi

  Mobile --> Clerk
  Admin --> Clerk
  Profiles --> DB
  PublicClasses --> DB
  WorkoutsApi --> DB
  AdminApi --> DB
  WorkoutsApi --> Clerk
  AdminApi --> Clerk
  AiApi --> Gemini

  classDef app fill:#1f2937,stroke:#ff6b00,color:#ffffff,stroke-width:2px;
  classDef svc fill:#fff7ed,stroke:#fb923c,color:#7c2d12,stroke-width:1.5px;
  classDef store fill:#eff6ff,stroke:#60a5fa,color:#1e3a8a,stroke-width:1.5px;

  class Home,Nutrition,Workout,Schedule,Coach,Profile,Dashboard,Classes,Members,Settings app;
  class PublicClasses,Profiles,WorkoutsApi,AdminApi,AiApi svc;
  class DB,Clerk,Gemini,Local store;
```

What this shows:

- the mobile app is the daily operating surface for members, trainers, and owners
- the admin web app is owner-only and focuses on management workflows
- the API is the bridge between UI, database, Clerk, and Gemini
- some member experience is local-first through AsyncStorage, while management flows are server-backed

## 2. Role-Based App Flow

```mermaid
flowchart TB
  Start["Open app"] --> Gate{"Signed in with Clerk?"}
  Gate -- "No" --> Auth["Sign in / Sign up"]
  Auth --> Onboarding["Complete onboarding\npersonal + health + goals + diet + role"]
  Gate -- "Yes" --> Tabs["Enter mobile tabs"]
  Onboarding --> Targets["Calculate targets\ncalories, protein, carbs, fat"]
  Targets --> Tabs

  Tabs --> Sync["Profile sync to API\nPOST /api/profiles/sync"]
  Sync --> Role{"Selected role?"}

  Role -- "Member" --> Member["Member mode"]
  Role -- "Trainer" --> Trainer["Trainer mode"]
  Role -- "Owner" --> Owner["Owner mode"]

  Member --> MemberFeatures["Home, Nutrition, Workout,\nSchedule, AI Coach, Progress"]
  Trainer --> TrainerFeatures["All member features\n+ create templates\n+ assign workouts\n+ manage classes"]
  Owner --> OwnerFeatures["All trainer features\n+ admin web access"]

  OwnerFeatures --> AdminWeb["Admin web panel"]
  AdminWeb --> Dashboard["Dashboard stats"]
  AdminWeb --> AdminClasses["Manage classes"]
  AdminWeb --> AdminMembers["View members"]
  AdminWeb --> AdminSettings["Update gym settings"]

  classDef phase fill:#fff7ed,stroke:#ff6b00,color:#7c2d12,stroke-width:1.5px;
  classDef role fill:#ecfeff,stroke:#0891b2,color:#164e63,stroke-width:1.5px;

  class Start,Gate,Auth,Onboarding,Targets,Tabs,Sync phase;
  class Member,Trainer,Owner,MemberFeatures,TrainerFeatures,OwnerFeatures,AdminWeb,Dashboard,AdminClasses,AdminMembers,AdminSettings role;
```

What this shows:

- everyone starts with Clerk auth and onboarding
- onboarding is where the role is chosen
- role decides whether the user only consumes plans, also manages workouts/classes, or additionally gets owner web admin

## 3. Trainer-to-Member Workout Flow

```mermaid
sequenceDiagram
  participant T as Trainer or Owner (Mobile)
  participant API as Express API
  participant DB as Postgres
  participant C as Clerk
  participant M as Member (Mobile)

  T->>API: POST /api/profiles/sync
  API->>DB: upsert trainer or owner profile

  T->>API: POST /api/workouts/templates
  API->>DB: save workout template

  T->>API: GET /api/workouts/members
  API->>DB: read member profiles
  API->>C: enrich member identity details
  API-->>T: member list

  T->>API: POST /api/workouts/assign
  API->>DB: create workout assignment
  API-->>T: assignment created

  M->>API: POST /api/workouts/assigned/bind
  API->>DB: bind placeholder assignment to Clerk user

  M->>API: GET /api/workouts/assigned?memberId=self
  API->>DB: fetch active assigned workouts
  API-->>M: assigned template + exercises

  M->>M: start workout session locally
  M->>API: PATCH /api/workouts/assigned/:id/complete
  API->>DB: set completedAt
  API-->>M: completion confirmed
```

What this shows:

- trainer and owner users act as program creators
- members act as program consumers and completers
- assignments are stored server-side so completion can be tracked

## 4. Class Scheduling and Enrollment Flow

```mermaid
flowchart LR
  OwnerTrainer["Owner or Trainer"] --> CreateClass["Create or edit class"]
  CreateClass --> AdminApi["Admin route or manage-class screen"]
  AdminApi --> ClassDb[("gym_classes table")]

  ClassDb --> PublicFeed["GET /api/classes"]
  PublicFeed --> ScheduleTab["Schedule tab"]
  ScheduleTab --> Browse["Browse week and day"]
  Browse --> Choice{"Seats available?"}

  Choice -- "Yes" --> Enroll["Enroll in class"]
  Enroll --> LocalEnroll["Update local enrolled IDs"]
  Enroll --> Capacity["Increase enrolled count"]

  Choice -- "No" --> Full["Show class full state"]

  LocalEnroll --> DailyUse["Member sees enrolled state"]
  Capacity --> DailyUse
  OwnerTrainer --> EditClass["Edit existing class"]
  EditClass --> AdminApi
```

What this shows:

- classes are authored by staff and published from the database
- members discover classes through the schedule tab
- enrollment is part public-feed driven and part local state driven in the mobile app

## 5. App Phases

```mermaid
stateDiagram-v2
  [*] --> SignedOut

  SignedOut --> Authenticated: Clerk sign in or sign up
  Authenticated --> Onboarding: first run or onboarding incomplete
  Authenticated --> ActiveShell: returning user

  Onboarding --> TargetsComputed: complete onboarding form
  TargetsComputed --> ActiveShell: save profile locally

  ActiveShell --> ProfileSynced: POST /api/profiles/sync

  ProfileSynced --> MemberPhase: role = member
  ProfileSynced --> TrainerPhase: role = trainer
  ProfileSynced --> OwnerPhase: role = owner

  MemberPhase --> AssignedWorkoutPhase: fetch assigned workouts
  AssignedWorkoutPhase --> WorkoutDone: complete assigned workout
  WorkoutDone --> MemberPhase

  TrainerPhase --> TemplatePhase: create workout templates
  TemplatePhase --> AssignmentPhase: assign workout to member
  AssignmentPhase --> TrainerPhase

  OwnerPhase --> AdminPhase: open admin web
  OwnerPhase --> ClassOpsPhase: create or update classes
  AdminPhase --> OwnerPhase
  ClassOpsPhase --> OwnerPhase
```

Interpretation:

- phase 1 is access
- phase 2 is onboarding and target generation
- phase 3 is role activation through profile sync
- phase 4 becomes role-specific usage
- phase 5 is outcome tracking, such as assigned workout completion or owner operations

## Quick Read

- `member` is the main daily fitness user
- `trainer` adds programming and assignment power
- `owner` gets the full operational layer, including the admin web panel
- AI is used in three places: food analysis, chat coaching, and workout suggestion
- the app mixes local-first fitness tracking with server-backed gym operations
